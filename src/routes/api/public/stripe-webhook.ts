import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { planForAmount } from "@/lib/pricing";

// Stripe webhook: grants paid access ONLY for signature-verified, live-mode events.
// - invoice.paid: each paid subscription invoice (39 kr/month or 349 kr/year) grants access to
//   the end of the period it paid for, plus a few days while Stripe retries a failed renewal.
// - checkout.session.completed: earlier one-time 499 SEK purchases, which grant lifetime access.
// Test-mode events never grant access. A cancelled subscription simply stops producing invoices,
// so access ends when the last paid period does.

// Grace after a period ends, covering Stripe's automatic retries of a declined renewal.
const RENEWAL_GRACE_MS = 3 * 24 * 60 * 60 * 1000;

const Metadata = z.record(z.string()).nullable().optional();
const Invoice = z.object({
  id: z.string().min(1).max(255),
  livemode: z.boolean(),
  status: z.string().nullable().optional(),
  amount_paid: z.number(),
  currency: z.string(),
  customer: z.string().nullable().optional(),
  // Older Stripe API versions put the subscription on the invoice itself, newer ones under parent.
  subscription: z.string().nullable().optional(),
  subscription_details: z.object({ metadata: Metadata }).nullable().optional(),
  parent: z
    .object({ subscription_details: z.object({ subscription: z.string().nullable().optional(), metadata: Metadata }).nullable().optional() })
    .nullable()
    .optional(),
  lines: z.object({ data: z.array(z.object({ period: z.object({ end: z.number() }) })) }),
});
const Session = z.object({
  id: z.string().min(1).max(255),
  livemode: z.boolean(),
  payment_status: z.string(),
  amount_total: z.number().nullable(),
  currency: z.string().nullable(),
  client_reference_id: z.string().uuid().nullable(),
});

async function verifySignature(body: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=", 2) as [string, string]));
  const t = Number(parts["t"]);
  const v1 = parts["v1"];
  if (!t || !v1 || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${body}`));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (expected.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/stripe-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["STRIPE_WEBHOOK_SECRET"];
        if (!secret) return new Response("Not configured", { status: 503 });
        const header = request.headers.get("stripe-signature");
        const body = await request.text();
        if (!header || !(await verifySignature(body, header, secret))) {
          return new Response("Invalid signature", { status: 400 });
        }
        const event = JSON.parse(body) as { type?: string; data?: { object?: unknown } };
        if (event.type === "invoice.paid") return storeInvoice(event.data?.object);
        if (event.type !== "checkout.session.completed") return new Response("ignored");
        const parsed = Session.safeParse(event.data?.object);
        if (!parsed.success) return new Response("ignored");
        const s = parsed.data;
        // Test mode is acknowledged but never grants access.
        if (!s.livemode) return new Response("test mode ignored");
        if (s.payment_status !== "paid" || s.amount_total !== 49900 || s.currency !== "sek" || !s.client_reference_id) {
          return new Response("ignored");
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.from("verified_payments").upsert(
          { user_id: s.client_reference_id, provider: "stripe", provider_reference: s.id, amount_cents: 49900, currency: "SEK", environment: "live", plan: "lifetime" },
          { onConflict: "provider_reference", ignoreDuplicates: true },
        );
        if (error) return new Response("Storage failed", { status: 500 });
        return new Response("ok");
      },
    },
  },
});

async function storeInvoice(object: unknown) {
  const parsed = Invoice.safeParse(object);
  if (!parsed.success) return new Response("ignored");
  const invoice = parsed.data;
  if (!invoice.livemode) return new Response("test mode ignored");
  if (invoice.status && invoice.status !== "paid") return new Response("ignored");
  if (invoice.currency !== "sek") return new Response("ignored");

  const details = invoice.parent?.subscription_details ?? null;
  const subscription = details?.subscription ?? invoice.subscription ?? null;
  const metadata = details?.metadata ?? invoice.subscription_details?.metadata ?? {};
  if (!subscription) return new Response("ignored");

  // Only the exact plan prices grant access. Anything else (a coupon, a changed price) is left for a person to look at.
  const plan = planForAmount(invoice.amount_paid, null);
  if (!plan) return new Response("unexpected amount ignored");

  const periodEnd = Math.max(...invoice.lines.data.map((line) => line.period.end));
  if (!Number.isFinite(periodEnd)) return new Response("ignored");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // The account set at checkout travels on the subscription. Fall back to an earlier invoice of it.
  let userId = z.string().uuid().safeParse(metadata?.["user_id"]).data ?? null;
  if (!userId) {
    const { data: earlier } = await supabaseAdmin
      .from("verified_payments")
      .select("user_id")
      .eq("provider_subscription", subscription)
      .limit(1)
      .maybeSingle();
    userId = earlier?.user_id ?? null;
  }
  if (!userId) return new Response("no account ignored");

  const { error } = await supabaseAdmin.from("verified_payments").upsert(
    {
      user_id: userId,
      provider: "stripe",
      provider_reference: invoice.id,
      amount_cents: invoice.amount_paid,
      currency: "SEK",
      environment: "live",
      plan,
      access_until: new Date(periodEnd * 1000 + RENEWAL_GRACE_MS).toISOString(),
      provider_customer: invoice.customer ?? null,
      provider_subscription: subscription,
    },
    { onConflict: "provider_reference", ignoreDuplicates: true },
  );
  // A failure makes Stripe send the event again later, so nothing paid is lost.
  if (error) return new Response("Storage failed", { status: 500 });
  return new Response("ok");
}

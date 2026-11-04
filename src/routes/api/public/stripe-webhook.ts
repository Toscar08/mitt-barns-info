import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Stripe webhook: grants paid access ONLY for signature-verified, live-mode,
// fully paid 499 SEK checkout sessions. Test-mode events never grant access.
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
          { user_id: s.client_reference_id, provider: "stripe", provider_reference: s.id, amount_cents: 49900, currency: "SEK", environment: "live" },
          { onConflict: "provider_reference", ignoreDuplicates: true },
        );
        if (error) return new Response("Storage failed", { status: 500 });
        return new Response("ok");
      },
    },
  },
});

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PLANS } from "@/lib/pricing";

// Stripe Checkout for the monthly or yearly subscription.
// Access is granted exclusively by the signature-verified webhook that stores each paid live
// invoice; the checkout response itself never grants access.
const ALLOWED_ORIGINS = /^(https:\/\/[a-z0-9-]+\.lovable\.app|http:\/\/localhost(?::\d+))$/;

const NAMES = {
  monthly: { name: "Barnmappen – månadsvis", description: "Din privata Barnmappen. Förnyas varje månad, avsluta när du vill." },
  yearly: { name: "Barnmappen – årsvis", description: "Din privata Barnmappen. Förnyas varje år, avsluta när du vill." },
} as const;

async function stripe(path: string, body: URLSearchParams) {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("Betalningen är inte ansluten ännu. Försök igen senare.");
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json()) as { url?: string; error?: { message?: string } };
  if (!res.ok || !json.url) throw new Error(json.error?.message ?? "Kunde inte nå betalningen. Försök igen.");
  return json.url;
}

export const createStripeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ origin: z.string().url(), plan: z.enum(["monthly", "yearly"]).default("yearly") }).parse(input),
  )
  .handler(async ({ data, context }) => {
    if (!ALLOWED_ORIGINS.test(data.origin)) {
      throw new Error("Ogiltig sidadress. Ladda om sidan och försök igen.");
    }
    // One subscription per account: someone who already pays manages it in the billing portal instead.
    const access = await context.supabase.rpc("get_my_campaign_access");
    const status = (access.data as { status?: string } | null)?.status;
    if (status === "paid" || status === "complimentary") {
      throw new Error("Du har redan åtkomst. Ändra eller avsluta din prenumeration under Inställningar.");
    }

    const plan = PLANS[data.plan];
    const body = new URLSearchParams({
      mode: "subscription",
      client_reference_id: context.userId,
      // Carried on every future invoice, so renewals reach the right account.
      "subscription_data[metadata][user_id]": context.userId,
      "subscription_data[metadata][plan]": data.plan,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "sek",
      "line_items[0][price_data][unit_amount]": String(plan.amount),
      "line_items[0][price_data][recurring][interval]": plan.interval,
      "line_items[0][price_data][tax_behavior]": "inclusive",
      "line_items[0][price_data][product_data][name]": NAMES[data.plan].name,
      "line_items[0][price_data][product_data][description]": NAMES[data.plan].description,
      locale: "sv",
      success_url: `${data.origin}/installningar?betalt=1`,
      cancel_url: `${data.origin}/kop`,
    });
    return { url: await stripe("checkout/sessions", body) };
  });

/** Opens Stripe's own page where the customer changes plan, updates the card or cancels. */
export const createBillingPortal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ origin: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!ALLOWED_ORIGINS.test(data.origin)) {
      throw new Error("Ogiltig sidadress. Ladda om sidan och försök igen.");
    }
    // RLS lets the user read only their own payments.
    const { data: row } = await context.supabase
      .from("verified_payments")
      .select("provider_customer")
      .eq("user_id", context.userId)
      .not("provider_customer", "is", null)
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!row?.provider_customer) throw new Error("Ingen prenumeration hittades på kontot.");
    const body = new URLSearchParams({ customer: row.provider_customer, return_url: `${data.origin}/installningar` });
    return { url: await stripe("billing_portal/sessions", body) };
  });

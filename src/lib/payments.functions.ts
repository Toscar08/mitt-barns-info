import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Creates a Stripe Checkout session (499 SEK, one-time payment).
// Access is granted exclusively by the signature-verified webhook that stores a
// live-mode payment; the checkout response itself never grants access.
const ALLOWED_ORIGINS = /^https:\/\/([a-z0-9-]+\.lovable\.app|localhost(?::\d+)?)$/;

export const createStripeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ origin: z.string().url() }).parse(input))
  .handler(async ({ data, context }) => {
    if (!ALLOWED_ORIGINS.test(data.origin)) {
      throw new Error("Ogiltig sidadress. Ladda om sidan och försök igen.");
    }
    const key = process.env["STRIPE_SECRET_KEY"];
    if (!key) throw new Error("Betalningen är inte ansluten ännu. Försök igen senare.");
    const body = new URLSearchParams({
      mode: "payment",
      client_reference_id: context.userId,
      "line_items[0][quantity]": "1",
      "line_items[0][price_data][currency]": "sek",
      "line_items[0][price_data][unit_amount]": "49900",
      "line_items[0][price_data][product_data][name]": "Barnmappen",
      "line_items[0][price_data][product_data][description]": "Livstidsåtkomst till din privata Barnmappen",
      success_url: `${data.origin}/installningar`,
      cancel_url: `${data.origin}/kop`,
    });
    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const json = (await res.json()) as { url?: string; error?: { message?: string } };
    if (!res.ok || !json.url) throw new Error(json.error?.message ?? "Kunde inte starta betalningen. Försök igen.");
    return { url: json.url };
  });

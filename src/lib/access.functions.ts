import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Access = z.object({
  status: z.enum(["paid", "trial", "complimentary", "paused", "launch_pending"]),
  serverNow: z.string(), launchStartedAt: z.string().nullable(),
  trialStartsAt: z.string().nullable(), trialEndsAt: z.string().nullable(),
  remainingSeconds: z.number(), isAdmin: z.boolean(),
  // Added with subscriptions (migration 0006). Optional, so the page works before the migration is applied.
  paidPlan: z.enum(["lifetime", "monthly", "yearly"]).nullable().optional(),
  paidUntil: z.string().nullable().optional(),
});
export type AccountAccess = z.infer<typeof Access>;
export const getAccountAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("get_my_campaign_access");
    if (error) throw new Error("Kunde inte kontrollera åtkomsten. Försök igen.");
    return Access.parse(data);
  });
export const startCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Uses server time; the database refuses a second start.
    const result = await context.supabase.rpc("start_launch_campaign", { launch_at: new Date(Date.now() - 1000).toISOString() });
    if (result.error) throw new Error("Starten kunde inte sparas. Kontrollera tid, behörighet och att kampanjen inte redan startat.");
    return result.data;
  });
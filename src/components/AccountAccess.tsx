import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAccountAccess, startCampaign } from "@/lib/access.functions";
import { createBillingPortal } from "@/lib/payments.functions";
import { kronor, PLANS, yearlyPerMonth } from "@/lib/pricing";
import { toast } from "sonner";
import { usePrefs } from "@/lib/prefs";
import { Button } from "@/components/ui/button";

export function useAccountAccess() {
  const fetchAccess = useServerFn(getAccountAccess);
  const query = useQuery({ queryKey: ["account-access"], queryFn: () => fetchAccess(), refetchOnWindowFocus: "always" });
  const [expired, setExpired] = useState(false);
  useEffect(() => {
    setExpired(false);
    if (query.data?.status !== "trial") return;
    const delay = query.data.remainingSeconds * 1000;
    // Re-arm long deadlines rather than overflowing browser timer limits.
    const timer = setTimeout(() => {
      if (delay <= 2147483647) setExpired(true);
      void query.refetch();
    }, Math.min(delay, 2147483647));
    return () => clearTimeout(timer);
  }, [query.dataUpdatedAt]);
  return { ...query, data: expired && query.data ? { ...query.data, status: "paused" as const, remainingSeconds: 0 } : query.data };
}
function LaunchStarter() {
  const start = useServerFn(startCampaign);
  const qc = useQueryClient();
  const { lang } = usePrefs();
  const sv = lang === "sv";
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!confirm(sv ? "Starta lanseringen nu? Detta kan bara göras en gång." : "Start the launch now? This can only be done once.")) return;
    setBusy(true);
    try { await start(); await qc.invalidateQueries({ queryKey: ["account-access"] }); }
    catch (e) { alert(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }
  return <div className="well space-y-3 p-4 text-sm">
    <p>{sv ? "Endast för administratör: tryck här direkt efter den första riktiga publiceringen. 30-dagarsfönstret räknas från detta exakta klockslag." : "Admin only: press right after the first real publication. The 30-day window starts at this exact time."}</p>
    <Button onClick={go} disabled={busy}>{sv ? "Starta lanseringen nu" : "Start launch now"}</Button>
  </div>;
}
export function AccountAccess() {
  const access = useAccountAccess();
  const { lang, locale } = usePrefs();
  const sv = lang === "sv";
  const a = access.data;
  if (!a) return <p className="surface p-6 text-sm text-muted-foreground">{access.error ? (sv ? "Åtkomsten kunde inte kontrolleras." : "Access could not be checked.") : (sv ? "Kontrollerar åtkomst…" : "Checking access…")}</p>;
  const labels = { paid: sv ? "Betald åtkomst" : "Paid access", complimentary: sv ? "Kostnadsfri åtkomst utan slutdatum" : "Complimentary access with no expiry", trial: sv ? "Gratis åtkomst" : "Free access", paused: sv ? "Åtkomst pausad" : "Access paused", launch_pending: sv ? "Lanseringen har inte startat" : "Launch has not started" };
  const date = (value: string) => new Date(value).toLocaleString(locale, { dateStyle: "long", timeStyle: "short" });
  // Trial dates say nothing about an account that has paid or been given access outright.
  const timed = !["paid", "complimentary"].includes(a.status);
  return <section className="surface space-y-4 p-6">
    <h2 className="text-xl">{labels[a.status]}</h2>
    {!timed && <p className="text-sm text-muted-foreground">{sv ? "Alla funktioner är upplåsta." : "All features are unlocked."}</p>}
    {a.status === "paid" && <Subscription plan={a.paidPlan ?? null} until={a.paidUntil ?? null} />}
    {timed && a.trialStartsAt && a.trialEndsAt && <dl className="space-y-2 text-sm">
      <div><dt className="text-muted-foreground">{sv ? "Gratisperiodens start" : "Trial starts"}</dt><dd>{date(a.trialStartsAt)}</dd></div>
      <div><dt className="text-muted-foreground">{sv ? "Gratisperiodens slut" : "Trial ends"}</dt><dd>{date(a.trialEndsAt)}</dd></div>
      {a.status === "trial" && <div><dt className="text-muted-foreground">{sv ? "Återstår" : "Remaining"}</dt><dd>{Math.floor(a.remainingSeconds / 86400)} {sv ? "dagar" : "days"}, {Math.floor(a.remainingSeconds % 86400 / 3600)} {sv ? "timmar" : "hours"}, {Math.floor(a.remainingSeconds % 3600 / 60)} {sv ? "minuter" : "minutes"}</dd></div>}
    </dl>}
    {timed && <p className="text-sm text-muted-foreground">{sv ? "När gratisperioden löper ut pausas barnmappar, dokument och assistenten. Dina uppgifter raderas inte. Åtkomsten återställs först efter verifierad betalning." : "When the trial expires, folders, documents and the assistant pause. Your data is not deleted. Access resumes only after verified payment."}</p>}
    {a.isAdmin && !a.launchStartedAt && <LaunchStarter />}
    {a.status === "trial" && <p className="text-sm">{sv ? `Fortsätt efter gratisperioden från ${yearlyPerMonth} kr/mån.` : `Continue after the trial from ${yearlyPerMonth} kr/mo.`} <Link to="/kop" className="link-line font-medium text-accent">{sv ? "Se priser" : "See prices"}</Link></p>}
    {a.status === "paused" && <Button asChild variant="pop"><Link to="/kop">{sv ? `Fortsätt från ${yearlyPerMonth} kr/mån` : `Continue from ${yearlyPerMonth} kr/mo`}</Link></Button>}
  </section>;
}

/** Plan, next renewal and the way to change or cancel it, which Stripe's own page handles. */
function Subscription({ plan, until }: { plan: "lifetime" | "monthly" | "yearly" | null; until: string | null }) {
  const { lang, locale } = usePrefs();
  const sv = lang === "sv";
  const portal = useServerFn(createBillingPortal);
  const [busy, setBusy] = useState(false);

  if (!plan || plan === "lifetime") {
    return <p className="text-sm text-muted-foreground">{sv ? "Livstidsåtkomst – inget mer att betala." : "Lifetime access – nothing more to pay."}</p>;
  }

  async function manage() {
    setBusy(true);
    try {
      const { url } = await portal({ data: { origin: window.location.origin } });
      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  const price = `${kronor(PLANS[plan].amount)} kr/${plan === "yearly" ? (sv ? "år" : "yr") : sv ? "mån" : "mo"}`;
  // The stored end includes a few days of grace for retried payments; show the paid period itself.
  const renews = until ? new Date(new Date(until).getTime() - 3 * 24 * 60 * 60 * 1000).toLocaleDateString(locale, { dateStyle: "long" }) : null;
  return (
    <div className="space-y-3">
      <dl className="space-y-2 text-sm">
        <div><dt className="text-muted-foreground">{sv ? "Prenumeration" : "Subscription"}</dt><dd>{plan === "yearly" ? (sv ? "Årsvis" : "Yearly") : sv ? "Månadsvis" : "Monthly"} · {price}</dd></div>
        {renews && <div><dt className="text-muted-foreground">{sv ? "Betald till och med" : "Paid through"}</dt><dd>{renews}</dd></div>}
      </dl>
      <p className="text-xs text-muted-foreground">{sv ? "Förnyas automatiskt. Avslutar du gäller den perioden ut." : "Renews automatically. If you cancel, it runs to the end of the period."}</p>
      <Button variant="outline" onClick={() => void manage()} disabled={busy}>
        {sv ? "Hantera prenumeration" : "Manage subscription"}
      </Button>
    </div>
  );
}

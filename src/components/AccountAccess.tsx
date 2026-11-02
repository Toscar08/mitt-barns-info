import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { getAccountAccess, startCampaign } from "@/lib/access.functions";
import { usePrefs } from "@/lib/prefs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
export function AccountAccess() {
  const access = useAccountAccess();
  const { lang, locale } = usePrefs();
  const sv = lang === "sv";
  const start = useServerFn(startCampaign);
  const queryClient = useQueryClient();
  const [launchAt, setLaunchAt] = useState("");
  const [busy, setBusy] = useState(false);
  const a = access.data;
  if (!a) return <p>{access.error ? (sv ? "Åtkomsten kunde inte kontrolleras." : "Access could not be checked.") : (sv ? "Kontrollerar åtkomst…" : "Checking access…")}</p>;
  const labels = { paid: sv ? "Betald åtkomst" : "Paid access", trial: sv ? "Gratis åtkomst" : "Free access", paused: sv ? "Åtkomst pausad" : "Access paused", launch_pending: sv ? "Lanseringen har inte startat" : "Launch has not started" };
  const date = (value: string) => new Date(value).toLocaleString(locale);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!window.confirm(sv ? "Är detta den faktiska första publiceringstiden? Starten kan inte ändras eller återställas." : "Is this the actual first publication time? This cannot be changed or reset.")) return;
    setBusy(true);
    try {
      await start({ data: { launchAt: new Date(launchAt).toISOString() } });
      await queryClient.invalidateQueries({ queryKey: ["account-access"] });
      toast.success(sv ? "Lanseringsstart sparad" : "Launch start saved");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Error"); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 border-b border-border pb-8">
    <h2 className="font-display text-2xl">{labels[a.status]}</h2>
    {a.trialStartsAt && a.trialEndsAt && <dl className="space-y-2 text-sm">
      <div><dt className="text-muted-foreground">{sv ? "Gratisperiodens start" : "Trial starts"}</dt><dd>{date(a.trialStartsAt)}</dd></div>
      <div><dt className="text-muted-foreground">{sv ? "Gratisperiodens slut" : "Trial ends"}</dt><dd>{date(a.trialEndsAt)}</dd></div>
      {a.status === "trial" && <div><dt className="text-muted-foreground">{sv ? "Återstår" : "Remaining"}</dt><dd>{Math.floor(a.remainingSeconds / 86400)} {sv ? "dagar" : "days"}, {Math.floor(a.remainingSeconds % 86400 / 3600)} {sv ? "timmar" : "hours"}, {Math.floor(a.remainingSeconds % 3600 / 60)} {sv ? "minuter" : "minutes"}</dd></div>}
    </dl>}
    {a.status !== "paid" && <p className="text-sm text-muted-foreground">{sv ? "När gratisperioden löper ut pausas barnmappar, dokument och assistenten. Dina uppgifter raderas inte. Åtkomsten återställs först efter verifierad betalning." : "When the trial expires, folders, documents and the assistant pause. Your data is not deleted. Access resumes only after verified payment."}</p>}
    {a.status === "paused" && <Button asChild><Link to="/kop">{sv ? "Köp åtkomst" : "Buy access"}</Link></Button>}
    {a.isAdmin && !a.launchStartedAt && <form onSubmit={submit} className="space-y-3 border-t border-border pt-6">
      <h3 className="font-medium">{sv ? "Administrera lansering" : "Launch administration"}</h3>
      <p className="text-sm text-muted-foreground">{sv ? "Efter första publiceringen: ange den faktiska publiceringstiden. Sparas en enda gång. Tiden anges i din lokala tidszon." : "After first publication, enter its actual time. Saved once only. Enter your local time."}</p>
      <Label htmlFor="launch-at">{sv ? "Första publiceringstid" : "First publication time"}</Label>
      <Input id="launch-at" type="datetime-local" required value={launchAt} onChange={e => setLaunchAt(e.target.value)} />
      <Button disabled={busy} type="submit">{sv ? "Spara permanent lanseringsstart" : "Save permanent launch start"}</Button>
    </form>}
  </section>;
}
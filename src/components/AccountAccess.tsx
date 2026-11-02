import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getAccountAccess } from "@/lib/access.functions";
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
export function AccountAccess() {
  const access = useAccountAccess();
  const { lang, locale } = usePrefs();
  const sv = lang === "sv";
  const a = access.data;
  if (!a) return <p>{access.error ? (sv ? "Åtkomsten kunde inte kontrolleras." : "Access could not be checked.") : (sv ? "Kontrollerar åtkomst…" : "Checking access…")}</p>;
  const labels = { paid: sv ? "Betald åtkomst" : "Paid access", trial: sv ? "Gratis åtkomst" : "Free access", paused: sv ? "Åtkomst pausad" : "Access paused", launch_pending: sv ? "Lanseringen har inte startat" : "Launch has not started" };
  const date = (value: string) => new Date(value).toLocaleString(locale);
  return <section className="space-y-4 border-b border-border pb-8">
    <h2 className="font-display text-2xl">{labels[a.status]}</h2>
    {a.trialStartsAt && a.trialEndsAt && <dl className="space-y-2 text-sm">
      <div><dt className="text-muted-foreground">{sv ? "Gratisperiodens start" : "Trial starts"}</dt><dd>{date(a.trialStartsAt)}</dd></div>
      <div><dt className="text-muted-foreground">{sv ? "Gratisperiodens slut" : "Trial ends"}</dt><dd>{date(a.trialEndsAt)}</dd></div>
      {a.status === "trial" && <div><dt className="text-muted-foreground">{sv ? "Återstår" : "Remaining"}</dt><dd>{Math.floor(a.remainingSeconds / 86400)} {sv ? "dagar" : "days"}, {Math.floor(a.remainingSeconds % 86400 / 3600)} {sv ? "timmar" : "hours"}, {Math.floor(a.remainingSeconds % 3600 / 60)} {sv ? "minuter" : "minutes"}</dd></div>}
    </dl>}
    {a.status !== "paid" && <p className="text-sm text-muted-foreground">{sv ? "När gratisperioden löper ut pausas barnmappar, dokument och assistenten. Dina uppgifter raderas inte. Åtkomsten återställs först efter verifierad betalning." : "When the trial expires, folders, documents and the assistant pause. Your data is not deleted. Access resumes only after verified payment."}</p>}
    {a.status === "paused" && <Button asChild><Link to="/kop">{sv ? "Köp åtkomst" : "Buy access"}</Link></Button>}
  </section>;
}
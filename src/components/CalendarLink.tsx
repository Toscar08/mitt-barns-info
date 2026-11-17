import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { connectCalendar, disconnectCalendar, syncCalendar } from "@/lib/calendar.functions";
import { usePrefs } from "@/lib/prefs";

export function CalendarLink({ childId }: { childId: string }) {
  const { lang } = usePrefs();
  const sv = lang !== "en";
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const connect = useServerFn(connectCalendar);
  const sync = useServerFn(syncCalendar);
  const disconnect = useServerFn(disconnectCalendar);

  const cal = useQuery({
    queryKey: ["child_calendar", childId],
    queryFn: async () => {
      const { data } = await supabase.from("child_calendars").select("last_synced_at").eq("child_id", childId).maybeSingle();
      return data;
    },
  });

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      const r = (await fn()) as { imported?: number };
      toast.success(r?.imported !== undefined ? `${ok} (${r.imported})` : ok);
      setUrl("");
      qc.invalidateQueries({ queryKey: ["child_calendar", childId] });
      qc.invalidateQueries({ queryKey: ["tasks", childId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fel");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="surface mt-4 p-6">
      <h2 className="text-xl">{sv ? "Koppla extern kalender" : "Connect external calendar"}</h2>
      {cal.data ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-muted-foreground">
            {sv ? "Kalender kopplad. Senast hämtad: " : "Calendar connected. Last synced: "}
            {cal.data.last_synced_at ? new Date(cal.data.last_synced_at).toLocaleString(sv ? "sv-SE" : "en-GB") : "–"}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy} onClick={() => run(() => sync({ data: { childId } }), sv ? "Uppdaterad" : "Synced")}>
              {sv ? "Hämta nya händelser" : "Sync now"}
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => run(() => disconnect({ data: { childId } }), sv ? "Kalendern borttagen" : "Calendar removed")}>
              {sv ? "Ta bort koppling" : "Disconnect"}
            </Button>
          </div>
        </div>
      ) : (
        <form
          className="mt-3 space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (url.trim()) run(() => connect({ data: { childId, url } }), sv ? "Kalender kopplad" : "Calendar connected");
          }}
        >
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {sv ? (
              <>
                <li>Google Kalender (dator): Inställningar → välj kalendern → "Hemlig adress i iCal-format".</li>
                <li>iPhone: Kalender-appen → Kalendrar → (i) → Delad kalender → Offentlig kalender → dela länk.</li>
                <li>Klistra in länken här nedan.</li>
              </>
            ) : (
              <>
                <li>Google Calendar (desktop): Settings → pick calendar → "Secret address in iCal format".</li>
                <li>iPhone: Calendar app → Calendars → (i) → Public Calendar → share link.</li>
                <li>Paste the link below.</li>
              </>
            )}
          </ol>
          <Label htmlFor="ical-url">{sv ? "Kalenderlänk (.ics)" : "Calendar link (.ics)"}</Label>
          <Input id="ical-url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://calendar.google.com/calendar/ical/.../basic.ics" />
          <p className="text-xs text-muted-foreground">
            {sv
              ? "Tips: använd en egen kalender för barnet – inte hela din privata eller jobbkalender. Länken sparas bara i ditt konto."
              : "Tip: use a separate calendar for the child, not your whole private or work calendar. The link is stored only in your account."}
          </p>
          <Button type="submit" disabled={busy}>{sv ? "Koppla kalender" : "Connect calendar"}</Button>
        </form>
      )}
    </section>
  );
}

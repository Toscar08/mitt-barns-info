import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const WINDOW_DAYS = 90;
const MAX_EVENTS = 300;

function normalizeUrl(raw: string): URL {
  const url = new URL(raw.trim().replace(/^webcal:\/\//i, "https://"));
  if (url.protocol !== "https:") throw new Error("Länken måste börja med https:// eller webcal://");
  const host = url.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    /^[\d.]+$/.test(host) ||
    host.includes(":")
  )
    throw new Error("Ogiltig kalenderlänk");
  return url;
}

// Offset (ms) of a time zone at a given UTC instant.
function tzOffset(tz: string, utc: number): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(new Date(utc));
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - utc;
  } catch {
    return 0;
  }
}

function parseDate(value: string, tz: string): number | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?/);
  if (!m) return null;
  const local = Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!, +(m[4] ?? 9), +(m[5] ?? 0), +(m[6] ?? 0));
  if (m[7]) return local;
  return local - tzOffset(tz, local);
}

type Ev = { uid: string; title: string; start: number };

export function parseIcs(text: string, from: number, to: number): Ev[] {
  const lines = text.replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  const out: Ev[] = [];
  let cur: any = null;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { cur = {}; continue; }
    if (line === "END:VEVENT" && cur) {
      const tzid = /TZID=([^;:]+)/.exec(cur.DTSTART?.params ?? "")?.[1] ?? "Europe/Stockholm";
      const start = cur.DTSTART ? parseDate(cur.DTSTART.value, tzid) : null;
      const title = (cur.SUMMARY?.value ?? "Händelse").replace(/\\n/g, " ").replace(/\\([,;\\])/g, "$1").slice(0, 200);
      const uid = (cur.UID?.value ?? title).slice(0, 200);
      if (start !== null && cur.STATUS?.value !== "CANCELLED") {
        const rule = cur.RRULE?.value;
        if (rule) {
          const r: any = Object.fromEntries(rule.split(";").map((p: string) => p.split("=")));
          const step = ({ DAILY: 1, WEEKLY: 7 } as Record<string, number>)[r.FREQ];
          if (step) {
            const interval = (Number(r.INTERVAL) || 1) * step * 86400000;
            const until = r.UNTIL ? parseDate(r.UNTIL, tzid) ?? to : to;
            const count = Number(r.COUNT) || Infinity;
            let t = start;
            for (let i = 0; i < count && t <= Math.min(until, to) && i < 1000; i++, t += interval) {
              if (t >= from) out.push({ uid: `${uid}#${t}`, title, start: t });
            }
          } else if (start >= from && start <= to) out.push({ uid, title, start });
        } else if (start >= from && start <= to) out.push({ uid, title, start });
      }
      cur = null;
      continue;
    }
    if (!cur) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const [name = "", ...params] = line.slice(0, idx).split(";");
    if (!cur[name]) cur[name] = { params: params.join(";"), value: line.slice(idx + 1) };
  }
  return out.sort((a, b) => a.start - b.start).slice(0, MAX_EVENTS);
}

async function syncChild(supabase: any, userId: string, childId: string, rawUrl: string) {
  const url = normalizeUrl(rawUrl);
  // Checks what the name points to, and every redirect, before anything is fetched.
  const { fetchPublicText } = await import("@/lib/safe-fetch.server");
  const text = await fetchPublicText(url, "text/calendar");
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("Länken är inte en kalender (.ics).");
  const now = Date.now();
  const events = parseIcs(text, now - 86400000, now + WINDOW_DAYS * 86400000);

  const del = await supabase.from("tasks").delete().eq("child_id", childId).not("external_uid", "is", null);
  if (del.error) throw new Error("Kunde inte uppdatera kalendern.");
  if (events.length) {
    const ins = await supabase.from("tasks").insert(
      events.map((e) => ({
        user_id: userId, child_id: childId, title: `📅 ${e.title}`,
        due_at: new Date(e.start).toISOString(), external_uid: e.uid,
      })),
    );
    if (ins.error) throw new Error("Kunde inte spara kalenderhändelserna.");
  }
  await supabase.from("child_calendars").update({ last_synced_at: new Date().toISOString() }).eq("child_id", childId);
  return { imported: events.length };
}

export const connectCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ childId: z.string().uuid(), url: z.string().min(8).max(2000) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    normalizeUrl(data.url);
    const { error } = await supabase
      .from("child_calendars")
      .upsert({ child_id: data.childId, user_id: userId, url: data.url.trim() });
    if (error) throw new Error("Kunde inte spara länken.");
    return syncChild(supabase, userId, data.childId, data.url);
  });

export const syncCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ childId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row } = await supabase.from("child_calendars").select("url").eq("child_id", data.childId).maybeSingle();
    if (!row) throw new Error("Ingen kalender kopplad.");
    return syncChild(supabase, userId, data.childId, row.url);
  });

export const disconnectCalendar = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ childId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await supabase.from("tasks").delete().eq("child_id", data.childId).not("external_uid", "is", null);
    await supabase.from("child_calendars").delete().eq("child_id", data.childId);
    return { ok: true };
  });

/**
 * "Write it, and it gets filed": turns a parent's free text into suggestions for where each fact
 * belongs in a child's folder. Shared by the server function (which asks the AI and falls back to
 * the rules below) and by the review step, which shows every suggestion before anything is saved.
 */

export const CHILD_FIELDS = [
  "birth_date",
  "personal_number",
  "blood_type",
  "allergies",
  "medications",
  "clothing_size",
  "shoe_size",
  "school",
  "school_class",
  "passport_number",
  "passport_expiry",
  "notes",
] as const;

export type ChildField = (typeof CHILD_FIELDS)[number];

/** Free-text fields collect values. Every other field holds one value, which a new one replaces. */
export const APPENDING: readonly ChildField[] = ["allergies", "medications", "notes"];

export const ENTRY_CATEGORIES = ["contacts", "calendar", "custom"] as const;
export type EntryCategory = (typeof ENTRY_CATEGORIES)[number];

export type QuickItem =
  | { kind: "field"; childId: string | null; field: ChildField; value: string }
  | { kind: "entry"; childId: string | null; category: EntryCategory; title: string; content: string | null }
  | { kind: "task"; childId: string | null; title: string; dueAt: string | null };
// `dueAt` is local wall-clock time ("2026-12-01T09:00"), like a datetime-local input. The browser
// turns it into an instant when saving, because only it knows the family's time zone.

export type ChildRef = { id: string; name: string };

export const MAX_ITEMS = 12;

/** What a free-text field holds after `value` is added to `existing`. Never duplicates a value. */
export function merged(field: ChildField, existing: string | null | undefined, value: string) {
  const current = (existing ?? "").trim();
  if (!APPENDING.includes(field) || !current) return value;
  if (current.toLowerCase().includes(value.toLowerCase())) return current;
  return field === "notes" ? `${current}\n${value}` : `${current}, ${value}`;
}

// ---------------------------------------------------------------------------------------------
// Rule-based sorting. Used when the AI is unreachable. It only files what it is sure about;
// everything else is kept as a note, so nothing the parent wrote is lost or misplaced silently.
// ---------------------------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  jan: 0, januari: 0, january: 0,
  feb: 1, februari: 1, february: 1,
  mar: 2, mars: 2, march: 2,
  apr: 3, april: 3,
  maj: 4, may: 4,
  jun: 5, juni: 5, june: 5,
  jul: 6, juli: 6, july: 6,
  aug: 7, augusti: 7, august: 7,
  sep: 8, sept: 8, september: 8,
  okt: 9, oktober: 9, oct: 9, october: 9,
  nov: 10, november: 10,
  dec: 11, december: 11,
};

const WEEKDAY =
  /\b(måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag|monday|tuesday|wednesday|thursday|friday|saturday|sunday)(?:ar|s)?\b/i;

const PHONE = /(?:\+\d{2}[\s-]?|\b0)\d(?:[\s-]?\d){5,10}\b/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/;

// A new fact usually starts with one of these after "och"/"and".
const FACT_START =
  "(?:har|går|är|tar|bär|heter|behöver|ska|kom ihåg|glöm inte|boka|köp|ring|has|goes|is|takes|wears|needs|remember|book|buy|call)";

const pad = (n: number) => String(n).padStart(2, "0");

function isoDate(year: number, month: number, day: number) {
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

type DateHit = { iso: string; raw: string };

/** Finds one date in the text. `future` picks the next occurrence when the year is left out. */
function findDate(text: string, now: Date, future: boolean): DateHit | null {
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) {
    const value = isoDate(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    if (value) return { iso: value, raw: iso[0] };
  }

  const resolveYear = (month: number, day: number, year?: string) => {
    if (year) return Number(year.length === 2 ? `20${year}` : year);
    if (!future) return null;
    const thisYear = new Date(now.getFullYear(), month, day);
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return thisYear >= today ? now.getFullYear() : now.getFullYear() + 1;
  };

  const named = text.match(/\b(\d{1,2})(?::[ae])?\s+([a-zåäö]{3,9})\.?(?:\s+(\d{4}))?/i);
  if (named) {
    const month = MONTHS[named[2]!.toLowerCase()];
    if (month !== undefined) {
      const year = resolveYear(month, Number(named[1]), named[3]);
      const value = year === null ? null : isoDate(year, month, Number(named[1]));
      if (value) return { iso: value, raw: named[0] };
    }
  }

  const numeric = text.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2}|\d{4}))?\b/);
  if (numeric && Number(numeric[1]) <= 31 && Number(numeric[2]) <= 12) {
    const year = resolveYear(Number(numeric[2]) - 1, Number(numeric[1]), numeric[3]);
    const value = year === null ? null : isoDate(year, Number(numeric[2]) - 1, Number(numeric[1]));
    if (value) return { iso: value, raw: numeric[0] };
  }

  const relative = text.match(/\b(i ?dag|today|i ?morgon|tomorrow)\b/i);
  if (relative && future) {
    const offset = /morgon|tomorrow/i.test(relative[0]) ? 1 : 0;
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
    return { iso: isoDate(date.getFullYear(), date.getMonth(), date.getDate())!, raw: relative[0] };
  }
  return null;
}

function findTime(text: string) {
  const exact = text.match(/\b(?:kl\.?\s*)?([01]?\d|2[0-3])[:.]([0-5]\d)\b/i);
  if (exact) return { time: `${pad(Number(exact[1]))}:${exact[2]}`, raw: exact[0] };
  const hour = text.match(/\b(?:kl\.?|klockan|at)\s*([01]?\d|2[0-3])\b/i);
  if (hour) return { time: `${pad(Number(hour[1]))}:00`, raw: hour[0] };
  return null;
}

const tidy = (value: string) =>
  value
    .replace(/\s+/g, " ")
    .replace(/^[\s,:;–-]+|[\s,:;.!–-]+$/g, "")
    .trim();

const capitalise = (value: string) => (value ? value.charAt(0).toUpperCase() + value.slice(1) : value);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Stops a captured value where the next fact begins ("nötter, skostorlek 31" → "nötter"). */
function untilNextFact(value: string) {
  return tidy(
    value.split(
      /,?\s*(?:och\s+|and\s+)?\b(?:skostorlek|klädstorlek|blodgrupp|personnummer|passnummer|medicin\w*|shoe size|clothing size|blood type|passport)\b/i,
    )[0] ?? "",
  );
}

type FieldRule = { field: ChildField; patterns: RegExp[]; clean?: (value: string) => string };

const SIZE = "(\\d{2}(?:[.,]5)?)";
const CLOTHES = "(\\d{2,3}(?:\\s?[/–-]\\s?\\d{2,3})?|\\b[XSML]{1,4}\\b)";

const FIELD_RULES: FieldRule[] = [
  {
    field: "shoe_size",
    patterns: [
      new RegExp(`(?:skostorlek|storlek (?:i|på) skor|skor i storlek|shoe size)\\D{0,10}?${SIZE}`, "i"),
      new RegExp(`(?:storlek|stl|size)\\s*${SIZE}\\s*(?:i|på|in)\\s*(?:skor|shoes)`, "i"),
      new RegExp(`${SIZE}\\s*(?:i|in)\\s*(?:skor|skostorlek|shoes)`, "i"),
    ],
  },
  {
    field: "clothing_size",
    patterns: [
      new RegExp(`(?:klädstorlek|storlek (?:i|på) kläder|kläder i storlek|clothing size|clothes size)\\D{0,10}?${CLOTHES}`, "i"),
      new RegExp(`(?:storlek|stl|size)\\s*${CLOTHES}\\s*(?:i|på|in)\\s*(?:kläder|clothes)`, "i"),
      new RegExp(`${CLOTHES}\\s*(?:i|in)\\s*(?:kläder|klädstorlek|clothes)`, "i"),
    ],
  },
  {
    field: "blood_type",
    patterns: [
      /(?:blodgrupp|blood (?:type|group))\s*(?:är|is|:|-)?\s*((?:AB|A|B|0|O)\s?(?:rh\s?)?(?:\+|-|−|pos\w*|neg\w*)?)(?![a-zåäö])/i,
    ],
    clean: (value) => value.toUpperCase().replace(/\s+/g, " "),
  },
  {
    field: "allergies",
    patterns: [
      // "Inga kända allergier" is the answer itself, not a note about something else.
      /^(?:har\s+|has\s+)?((?:inga|no)(?:\s+(?:kända|known))?\s+allerg(?:ier|ies))$/i,
      /(?:allergisk|överkänslig|allergic)\s+(?:mot|för|to)\s+(.+)/i,
      /(?:tål inte|can(?:'|’|no)t (?:have|eat|tolerate))\s+(.+)/i,
      /allerg(?:ier|i|ies|y)\s*(?:är|is|are|:|-|mot|to)?\s*(.+)/i,
    ],
    clean: untilNextFact,
  },
  {
    field: "medications",
    patterns: [
      /medicin(?:erar med|erna|er|en)?\s*(?:är|heter|:|-)?\s*(.+)/i,
      /medications?\s*(?:is|are|:|-)?\s*(.+)/i,
      /(?:tar|takes)\s+(.+?\d+\s?(?:mg|ml|µg|mcg|g|st|tablett\w*|tablets?)\b.*)/i,
    ],
    clean: untilNextFact,
  },
  {
    field: "school",
    patterns: [
      /(?:går|goes)\s+(?:på|i|to|at)\s+(.*?(?:skolan|skola|förskolan|förskola|dagis|fritids|gymnasi\w*|preschool|school|kindergarten|nursery)[^,]*?)(?=,|\s+(?:i\s+|in\s+)?(?:klass|avdelning|class|group)\b|$)/i,
      /(?:skolan|skola|förskolan|förskola|school|preschool)\s*(?:är|heter|is|:|-)\s*([^,]+)/i,
    ],
  },
  {
    field: "school_class",
    // A class needs a digit ("2B") and a preschool group a proper name, or "simklass på" would match.
    patterns: [
      /(?<![\p{L}])(?:klass|årskurs|class|grade|year)\s*(?:är|is|:|-)?\s*(\d{1,2}\s?\p{L}?)(?![\p{L}\d])/iu,
      /(?<![\p{L}])[Aa]vdelning(?:en)?\s*(?:är|heter|:|-)?\s*(\p{Lu}[\p{L}\d-]{1,20})/u,
    ],
  },
  {
    field: "passport_number",
    patterns: [/pass(?:nummer|nr|et|port)?(?:\s+number)?\s*(?:är|har nummer|is|:|-)?\s*([A-Z]{0,2}\d{6,9})\b/i],
    clean: (value) => value.toUpperCase(),
  },
  {
    field: "personal_number",
    patterns: [/(?:personnummer|personnr|pnr|personal (?:id(?:entity)? )?number)\s*(?:är|is|:|-)?\s*(\d{6}(?:\d{2})?[-+ ]?\d{4})\b/i],
  },
];

const TASK_LEAD =
  /^(?:kom ihåg att|glöm inte att|att göra:?|todo:?|måste|behöver|remember to|don(?:'|’)t forget to|need to|must)\s+(.+)/i;
const TASK_VERB =
  /^(?:boka|köpa|köp|ringa|ring|lämna|hämta|betala|anmäl|anmäla|skicka|fixa|förnya|beställ|beställa|book|buy|call|pay|send|renew|order)\b/i;

function splitClauses(text: string, children: ChildRef[]) {
  // A new fact starts at "och har …", and also where the next child is named.
  const names = children.map((child) => `${escapeRegExp(child.name)}s?(?![\\p{L}])`);
  const next = [`${FACT_START}\\b`, ...names].join("|");
  return text
    .split(/(?<=[.!?])\s+(?=[A-ZÅÄÖ])|[;\n]+/)
    .flatMap((part) => part.split(new RegExp(`,?\\s+(?:och|samt|and)\\s+(?=${next})`, "iu")))
    .map(tidy)
    .filter((part) => part.length > 1);
}

/** Removes the child's own name and a leading helper verb, so titles read as headings. */
function withoutSubject(clause: string, children: ChildRef[]) {
  let rest = clause;
  for (const child of children) {
    rest = rest.replace(new RegExp(`^${escapeRegExp(child.name)}s?(?![\\p{L}])\\s*`, "iu"), "");
  }
  return tidy(rest.replace(/^(?:hon|han|hen|she|he|they)\s+/i, "").replace(/^(?:har|är|has|is)\s+/i, ""));
}

function childOf(clause: string, children: ChildRef[], previous: string | null) {
  const named = children.filter((child) =>
    new RegExp(`(?<![\\p{L}])${escapeRegExp(child.name)}s?(?![\\p{L}])`, "iu").test(clause),
  );
  if (named.length === 1) return named[0]!.id;
  if (named.length > 1) return null;
  return previous ?? (children.length === 1 ? children[0]!.id : null);
}

export function sortWithRules(text: string, children: ChildRef[], now: Date = new Date()): QuickItem[] {
  const items: QuickItem[] = [];
  let previous: string | null = null;

  for (const clause of splitClauses(text, children)) {
    const childId = childOf(clause, children, previous);
    if (childId) previous = childId;
    const before = items.length;

    for (const rule of FIELD_RULES) {
      for (const pattern of rule.patterns) {
        const match = clause.match(pattern);
        const value = match?.[1] ? (rule.clean ?? tidy)(match[1]) : "";
        if (value) {
          items.push({ kind: "field", childId, field: rule.field, value: value.slice(0, 300) });
          break;
        }
      }
    }

    if (/\bpass/i.test(clause) && /går ut|giltigt|gäller|expire|valid/i.test(clause)) {
      const date = findDate(clause, now, true);
      if (date) items.push({ kind: "field", childId, field: "passport_expiry", value: date.iso });
    }
    if (/född|födelsedatum|födelsedag|born|birthday|date of birth/i.test(clause)) {
      const date = findDate(clause, now, false);
      if (date) items.push({ kind: "field", childId, field: "birth_date", value: date.iso });
    }
    if (items.length > before) continue;

    const body = withoutSubject(clause, children);
    if (!body) continue;

    const contact = body.match(PHONE) ?? body.match(EMAIL);
    if (contact?.index !== undefined) {
      const lead = tidy(body.slice(0, contact.index).replace(/\b(?:har nummer|har telefon|telefonnummer|telefon|tel|nummer|mobil|phone|number|på|at)\s*$/i, ""));
      const rest = tidy(body.slice(contact.index));
      items.push({ kind: "entry", childId, category: "contacts", title: capitalise(lead) || "Kontakt", content: rest });
      continue;
    }

    const lead = body.match(TASK_LEAD);
    if (lead || TASK_VERB.test(body)) {
      const date = findDate(body, now, true);
      const time = date ? findTime(body.replace(date.raw, " ")) : null;
      let title = lead ? lead[1]! : body;
      if (date) title = title.replace(date.raw, " ");
      if (time) title = title.replace(time.raw, " ");
      title = tidy(title.replace(/\b(?:senast|innan|före|den|by|before|on)\s*$/i, "").replace(/\b(?:senast|by)\b\s*(?=$|[,.])/i, ""));
      const dueAt = date ? `${date.iso}T${time?.time ?? "09:00"}` : null;
      items.push({ kind: "task", childId, title: capitalise(tidy(title)), dueAt });
      continue;
    }

    const weekday = body.match(WEEKDAY);
    if (weekday?.index !== undefined) {
      const activity = tidy(body.slice(0, weekday.index).replace(/\b(?:på|varje|every|on)\s*$/i, "").replace(/^(?:går på|tränar|spelar|goes to|plays)\s+/i, ""));
      items.push({
        kind: "entry",
        childId,
        category: "calendar",
        title: capitalise(activity) || capitalise(weekday[0]),
        content: tidy(body.slice(weekday.index)),
      });
      continue;
    }

    const labelled = body.match(/^([^:]{2,40}):\s*(.+)$/);
    if (labelled) {
      items.push({ kind: "entry", childId, category: "custom", title: capitalise(tidy(labelled[1]!)), content: tidy(labelled[2]!) });
    } else {
      const words = body.split(" ");
      items.push({
        kind: "entry",
        childId,
        category: "custom",
        title: capitalise(words.slice(0, 5).join(" ")) + (words.length > 5 ? "…" : ""),
        content: words.length > 5 ? body : null,
      });
    }
  }

  return items.slice(0, MAX_ITEMS);
}

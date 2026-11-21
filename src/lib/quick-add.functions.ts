import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { canUseApp } from "@/lib/app-access";
import {
  CHILD_FIELDS,
  ENTRY_CATEGORIES,
  MAX_ITEMS,
  sortWithRules,
  type ChildRef,
  type QuickItem,
} from "@/lib/quick-add";

const SortInput = z.object({
  text: z.string().min(2).max(600),
  // The family's own calendar date, so "imorgon" means their tomorrow and not the server's.
  today: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  lang: z.enum(["sv", "en"]).default("sv"),
});

export type SortResult = { items: QuickItem[]; source: "ai" | "rules" };

// What the model may hand back. Children are referred to by their number in the prompt,
// so no database ids travel to the AI provider.
const child = z.number().int().nullable().optional();
const AiItem = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("field"), child, field: z.enum(CHILD_FIELDS), value: z.string().trim().min(1).max(300) }),
  z.object({
    kind: z.literal("entry"),
    child,
    category: z.enum(ENTRY_CATEGORIES),
    title: z.string().trim().min(1).max(120),
    content: z.string().trim().max(1000).nullable().optional(),
  }),
  z.object({
    kind: z.literal("task"),
    child,
    title: z.string().trim().min(1).max(200),
    due: z.string().trim().nullable().optional(),
  }),
]);

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_TIME = /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}:\d{2}))?/;

function fromAi(raw: string, children: ChildRef[]): QuickItem[] | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  const list = (parsed as { items?: unknown } | null)?.items;
  if (!Array.isArray(list)) return null;

  const idOf = (number: number | null | undefined) =>
    children[(number ?? 0) - 1]?.id ?? (children.length === 1 ? children[0]!.id : null);

  const items: QuickItem[] = [];
  for (const candidate of list) {
    const result = AiItem.safeParse(candidate);
    if (!result.success) continue;
    const item = result.data;
    const childId = idOf(item.child);
    if (item.kind === "field") {
      const dated = item.field === "birth_date" || item.field === "passport_expiry";
      if (dated && !DATE.test(item.value)) continue;
      items.push({ kind: "field", childId, field: item.field, value: item.value });
    } else if (item.kind === "entry") {
      items.push({ kind: "entry", childId, category: item.category, title: item.title, content: item.content || null });
    } else {
      const due = item.due?.match(DATE_TIME);
      items.push({ kind: "task", childId, title: item.title, dueAt: due ? `${due[1]}T${due[2] ?? "09:00"}` : null });
    }
  }
  return items.slice(0, MAX_ITEMS);
}

function instructions(children: ChildRef[], today: string) {
  return [
    "You file a parent's short note into their children's folders in the app Barnmappen.",
    'Reply with JSON only, no prose and no code fence: {"items":[...]}.',
    "",
    "Each item is exactly one of:",
    `{"kind":"field","child":N,"field":"${CHILD_FIELDS.join("|")}","value":"..."}`,
    '{"kind":"entry","child":N,"category":"contacts|calendar|custom","title":"short heading","content":"details or null"}',
    '{"kind":"task","child":N,"title":"...","due":"YYYY-MM-DDTHH:mm or null"}',
    "",
    "Where things go:",
    "- field: a personal detail. shoe_size and clothing_size hold just the size. allergies and medications hold just the substance or drug with dose. school is the school or preschool name, school_class the class or group. birth_date and passport_expiry are YYYY-MM-DD. notes is a short general remark about the child.",
    "- entry/contacts: a person or place to reach: doctor, dentist, clinic, teacher, coach, relative. Title is who, content is phone, address and the like.",
    "- entry/calendar: a recurring activity or a fixed time and place. Title is the activity, content is when and where.",
    "- entry/custom: anything else worth keeping, such as routines or favourite food.",
    "- task: something to do. Give a due time only if the note states one; use 09:00 when only a date is given.",
    "",
    "Hard rules:",
    "- Use only what the note says. Never invent, guess or add anything. Keep the parent's own wording for values.",
    "- One fact per item. Split a note that holds several facts.",
    "- child is the number of the child the fact is about. If the note does not make that clear and there are several children, use null.",
    "- Write titles in the language of the note.",
    '- If nothing in the note can be saved, reply {"items":[]}.',
    "",
    `Today's date: ${today}`,
    "Children:",
    ...children.map((kid, index) => `${index + 1} = ${kid.name}`),
  ].join("\n");
}

export const sortQuickNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => SortInput.parse(input))
  .handler(async ({ data, context }): Promise<SortResult> => {
    const { supabase } = context;
    if (!(await canUseApp(supabase))) throw new Error("Åtkomst pausad. Betalning krävs för att använda assistenten.");

    // RLS limits this to the signed-in user's own children. Only names go to the AI, never the folders.
    const kids = await supabase.from("children").select("id, name").order("created_at", { ascending: true });
    if (kids.error) throw new Error("Kunde inte läsa dina mappar. Försök igen.");
    const children: ChildRef[] = kids.data ?? [];
    if (children.length === 0) return { items: [], source: "rules" };

    const today = data.today ?? new Date().toISOString().slice(0, 10);
    const rules = (): SortResult => ({
      items: sortWithRules(data.text, children, new Date(`${today}T12:00:00`)),
      source: "rules",
    });

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return rules();

    try {
      const { createOpenAI } = await import("@ai-sdk/openai");
      const { streamText } = await import("ai");
      const lovable = createOpenAI({
        baseURL: "https://ai.gateway.lovable.dev/v1",
        apiKey,
        headers: {
          "Lovable-API-Key": apiKey,
          "X-Lovable-AIG-SDK": "vercel-ai-sdk",
        },
      });
      // Same model and options as the assistant, which is known to work through the gateway.
      const result = streamText({
        model: lovable.responses("openai/gpt-6-astra"),
        providerOptions: {
          openai: {
            forceReasoning: true,
            reasoningEffort: "low",
            reasoningSummary: "auto",
            store: false,
          },
        },
        system: instructions(children, today),
        prompt: data.text,
      });
      const items = fromAi((await result.text).trim(), children);
      // An unreadable reply is no reason to fail: the rules still file what they are sure about.
      return items ? { items, source: "ai" } : rules();
    } catch (error) {
      console.error("quick add error", error);
      return rules();
    }
  });

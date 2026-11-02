import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AskInput = z.object({
  childId: z.string().uuid().optional(),
  question: z.string().min(2).max(500),
  lang: z.enum(["sv", "en"]).default("sv"),
});

const NOT_FOUND = {
  sv: "Jag hittar inte den informationen i Barnmappen.",
  en: "I can't find that information in Barnmappen.",
};

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const access = await supabase.rpc("has_account_access");
    if (access.error || access.data !== true) throw new Error("Åtkomst pausad. Betalning krävs för att använda assistenten.");
    const lang = data.lang;

    // RLS limits every query to the signed-in user's own rows.
    let childQuery = supabase.from("children").select("*");
    if (data.childId) childQuery = childQuery.eq("id", data.childId);
    const kids = await childQuery;
    const list = kids.data ?? [];
    if (list.length === 0) {
      return { answer: NOT_FOUND[lang] };
    }
    const ids = list.map((k) => k.id);
    const [entries, tasks, documents] = await Promise.all([
      supabase.from("entries").select("child_id, category, title, content, updated_at").in("child_id", ids),
      supabase.from("tasks").select("child_id, title, due_at, done").in("child_id", ids),
      supabase.from("documents").select("child_id, name, created_at").in("child_id", ids),
    ]);

    const build = (c: (typeof list)[number]) => {
      const es = (entries.data ?? []).filter((e) => e.child_id === c.id);
      return [
      `##### CHILD: ${c.name} #####`,
      "[PERSONAL DETAILS]",
      `Name: ${c.name}`,
      c.birth_date ? `Date of birth: ${c.birth_date}` : null,
      c.personal_number ? `Personal ID number: ${c.personal_number}` : null,
      c.blood_type ? `Blood type: ${c.blood_type}` : null,
      c.allergies ? `Allergies: ${c.allergies}` : null,
      c.medications ? `Medication: ${c.medications}` : null,
      c.care_contacts ? `Care contacts: ${c.care_contacts}` : null,
      c.clothing_size ? `Clothing size: ${c.clothing_size}` : null,
      c.shoe_size ? `Shoe size: ${c.shoe_size}` : null,
      c.passport_number ? `Passport number: ${c.passport_number}` : null,
      c.passport_expiry ? `Passport valid until: ${c.passport_expiry}` : null,
      c.school ? `School / preschool: ${c.school}` : null,
      c.school_class ? `Class / group: ${c.school_class}` : null,
      c.notes ? `About the child: ${c.notes}` : null,
      "",
      "[CONTACTS]",
      ...es.filter((e) => e.category === "contacts").map((e) => `- ${e.title}: ${e.content ?? ""}`.trim()),
      "",
      "[CALENDAR AND ACTIVITIES]",
      ...es.filter((e) => e.category === "calendar").map((e) => `- ${e.title}: ${e.content ?? ""}`.trim()),
      ...(tasks.data ?? []).filter((t) => t.child_id === c.id).map(
        (t) => `- Task: ${t.title}${t.due_at ? ` (due ${t.due_at})` : ""}${t.done ? " [done]" : ""}`,
      ),
      "",
      "[OWN INFORMATION]",
      ...es.filter((e) => e.category !== "contacts" && e.category !== "calendar").map((e) => `- ${e.title}: ${e.content ?? ""}`.trim()),
      "",
      "[DOCUMENTS]",
      ...(documents.data ?? []).filter((d) => d.child_id === c.id).map((d) => `- ${d.name}`),
      "",
      ]
        .filter((line) => line !== null)
        .join("\n");
    };
    const contextText = list.map(build).join("\n");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { answer: NOT_FOUND[lang] };
    }

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

    try {
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
        system: [
          "You answer questions about the children in this family's Barnmappen, using ONLY the folder content below.",
          "- If several children exist and the question is ambiguous, answer for each child by name.",
          "Hard rules:",
          "- Never use general knowledge, never guess, never assume, never invent anything.",
          "- Answer extremely short and direct: the fact itself, ideally a few words or one short sentence.",
          "- Do not restate the question, do not add preamble, lists or explanations.",
          "- You may combine facts from several parts of the folder, but keep the answer short.",
          "- Understand natural language: match the meaning even if the wording differs from the folder.",
          `- If the answer is not in the folder, reply exactly: "${NOT_FOUND[lang]}" and nothing else.`,
          lang === "sv"
            ? "- Always answer in Swedish."
            : "- Always answer in English.",
          `Today's date: ${new Date().toISOString().slice(0, 10)}`,
          "",
          "=== CHILD FOLDER CONTENT ===",
          contextText,
        ].join("\n"),
        prompt: data.question,
      });

      const answer = (await result.text).trim();
      return { answer: answer || NOT_FOUND[lang] };
    } catch (error) {
      console.error("assistant error", error);
      return { answer: NOT_FOUND[lang] };
    }
  });

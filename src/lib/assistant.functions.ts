import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const AskInput = z.object({
  childId: z.string().uuid(),
  question: z.string().min(2).max(500),
});

export const askAssistant = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AskInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const [child, entries, tasks, documents] = await Promise.all([
      supabase.from("children").select("*").eq("id", data.childId).maybeSingle(),
      supabase
        .from("entries")
        .select("category, title, content, updated_at")
        .eq("child_id", data.childId),
      supabase.from("tasks").select("title, due_at, done").eq("child_id", data.childId),
      supabase.from("documents").select("name, created_at").eq("child_id", data.childId),
    ]);

    if (!child.data) {
      return { answer: "Jag hittar ingen mapp för det barnet." };
    }

    const c = child.data;
    const contextText = [
      `Barn: ${c.name}`,
      c.birth_date ? `Födelsedatum: ${c.birth_date}` : null,
      c.blood_type ? `Blodgrupp: ${c.blood_type}` : null,
      c.allergies ? `Allergier: ${c.allergies}` : null,
      c.medications ? `Mediciner: ${c.medications}` : null,
      c.care_contacts ? `Vårdkontakter: ${c.care_contacts}` : null,
      c.notes ? `Övrig information: ${c.notes}` : null,
      "",
      "Anteckningar och information:",
      ...(entries.data ?? []).map(
        (e) => `- [${e.category}] ${e.title}: ${e.content ?? ""}`.trim(),
      ),
      "",
      "Uppgifter:",
      ...(tasks.data ?? []).map(
        (t) =>
          `- ${t.title}${t.due_at ? ` (senast ${new Date(t.due_at).toLocaleString("sv-SE")})` : ""}${t.done ? " [klar]" : ""}`,
      ),
      "",
      "Dokument i mappen:",
      ...(documents.data ?? []).map((d) => `- ${d.name}`),
    ]
      .filter((line) => line !== null)
      .join("\n");

    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) {
      return { answer: "AI-assistenten är inte tillgänglig just nu." };
    }

    const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
    const { streamText } = await import("ai");

    const gateway = createOpenAICompatible({
      name: "lovable",
      baseURL: "https://ai.gateway.lovable.dev/v1",
      headers: { "Lovable-API-Key": apiKey },
    });

    try {
      const result = streamText({
        model: gateway("google/gemini-3.7-flash"),
        system: [
          "Du är en hjälpsam assistent i en app där föräldrar samlar information om sina barn.",
          "Svara kort, vänligt och på svenska.",
          "Använd ENDAST informationen nedan. Om svaret inte finns där, säg att informationen inte är inlagd ännu.",
          "Dagens datum: " + new Date().toISOString().slice(0, 10),
          "",
          "=== INFORMATION I BARNETS MAPP ===",
          contextText,
        ].join("\n"),
        prompt: data.question,
      });

      return { answer: await result.text };
    } catch (error) {
      console.error("assistant error", error);
      return {
        answer:
          "Assistenten kunde inte svara just nu. Försök gärna igen om en liten stund.",
      };
    }
  });

import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Fingerprint, FolderOpen, KeyRound, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { PrivateGate, useWorkspace } from "@/components/PrivateGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { askAssistant } from "@/lib/assistant.functions";
import { biometricEnrolled, biometricSupported, enrollBiometric } from "@/lib/biometric";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/_authenticated/fraga")({
  head: () => ({
    meta: [
      { title: "Fråga Barnmappen" },
      { name: "description", content: "Ställ en fråga och få svar direkt från din egen Barnmapp." },
      { property: "og:title", content: "Fråga Barnmappen" },
      { property: "og:description", content: "Snabba svar från din egen Barnmapp." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: () => (
    <PrivateGate>
      <AskPage />
    </PrivateGate>
  ),
});

function AskPage() {
  const { lang, t } = usePrefs();
  const sv = lang === "sv";
  const ask = useServerFn(askAssistant);
  const workspace = useWorkspace();
  const [question, setQuestion] = useState("");
  const [asked, setAsked] = useState<string | null>(null);
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [canBio, setCanBio] = useState(false);

  const ws = workspace.data;
  useEffect(() => {
    if (!ws?.hasPin || biometricEnrolled(ws.id)) return;
    void biometricSupported().then(setCanBio);
  }, [ws]);

  const quick = sv
    ? ["När är nästa träning?", "Vad heter tränaren?", "Vilken tid börjar skolan?"]
    : ["When is the next practice?", "What's the coach's name?", "What time does school start?"];

  async function run(q: string) {
    const text = q.trim();
    if (text.length < 2) return;
    setLoading(true);
    setAsked(text);
    setAnswer(null);
    try {
      const res = await ask({ data: { question: text, lang } });
      setAnswer(res.answer);
      setQuestion("");
    } catch {
      toast.error(t("ai.error"));
    } finally {
      setLoading(false);
    }
  }

  async function enroll() {
    if (!ws) return;
    try {
      if (await enrollBiometric(ws.id, ws.displayName || "Barnmappen")) {
        setCanBio(false);
        toast.success(sv ? "Face ID / fingeravtryck är på." : "Face ID / fingerprint enabled.");
      }
    } catch {
      toast.error(sv ? "Det gick inte att aktivera." : "Couldn't enable it.");
    }
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <AppHeader />
      <main className="mx-auto max-w-xl px-5 pb-16 pt-10">
        <h1 className="font-display text-4xl">{sv ? "Vad vill du veta?" : "What do you want to know?"}</h1>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(question);
          }}
          className="mt-6 flex gap-2"
        >
          <Input
            autoFocus
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={sv ? "Skriv din fråga…" : "Type your question…"}
            className="h-12 text-base"
            enterKeyHint="send"
            maxLength={500}
          />
          <Button type="submit" className="h-12 px-4" disabled={loading || question.trim().length < 2} aria-label={sv ? "Fråga" : "Ask"}>
            <Send className="size-5" aria-hidden />
          </Button>
        </form>
        <div className="mt-4 flex flex-wrap gap-2">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => run(q)}
              disabled={loading}
              className="rounded-full border border-border bg-card px-4 py-2 text-sm hover:bg-secondary"
            >
              {q}
            </button>
          ))}
        </div>

        {(loading || answer) && (
          <div className="surface mt-8 p-5">
            {asked && <p className="text-sm text-muted-foreground">{asked}</p>}
            <p className="mt-2 text-lg">{loading ? (sv ? "Letar i Barnmappen…" : "Searching Barnmappen…") : answer}</p>
            {!loading && <p className="mt-3 text-xs text-muted-foreground">{t("ai.disclaimer")}</p>}
          </div>
        )}

        <div className="mt-10 space-y-3">
          {ws && !ws.hasPin && (
            <Link to="/installningar" className="flex items-center gap-2 text-sm text-accent hover:underline">
              <KeyRound className="size-4" aria-hidden />
              {sv ? "Skapa en 4-siffrig snabbkod för att låsa upp snabbare" : "Create a 4-digit quick code to unlock faster"}
            </Link>
          )}
          {canBio && (
            <button type="button" onClick={enroll} className="flex items-center gap-2 text-sm text-accent hover:underline">
              <Fingerprint className="size-4" aria-hidden />
              {sv ? "Lås upp med Face ID / fingeravtryck nästa gång" : "Unlock with Face ID / fingerprint next time"}
            </button>
          )}
          <Link to="/barn" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <FolderOpen className="size-4" aria-hidden />
            {sv ? "Öppna barnens mappar" : "Open the children's folders"}
          </Link>
        </div>
      </main>
    </div>
  );
}

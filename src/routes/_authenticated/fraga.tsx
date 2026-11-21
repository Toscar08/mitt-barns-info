import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ChevronRight, Fingerprint, FolderOpen, KeyRound, Rocket, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { AskBar } from "@/components/AskBar";
import { PrivateGate, useWorkspace } from "@/components/PrivateGate";
import { askAssistant } from "@/lib/assistant.functions";
import { biometricEnrolled, biometricSupported, enrollBiometric, removeBiometric, saveBiometricSecret } from "@/lib/biometric";
import { registerUnlockDevice } from "@/lib/workspace.functions";
import { useChildren } from "@/lib/children";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/_authenticated/fraga")({
  // A question to start from, e.g. the one the quick start suggests. It is filled in, never sent unasked.
  validateSearch: (search: Record<string, unknown>): { q?: string | undefined } => ({
    q: typeof search["q"] === "string" ? search["q"].slice(0, 200) : undefined,
  }),
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

const row =
  "group row flex w-full cursor-pointer items-center gap-3 px-5 py-4 text-left active:bg-foreground/8";

function AskPage() {
  const { lang, t } = usePrefs();
  const sv = lang === "sv";
  const ask = useServerFn(askAssistant);
  const registerDevice = useServerFn(registerUnlockDevice);
  const workspace = useWorkspace();
  const children = useChildren();
  const noChildren = children.data?.length === 0;
  const { q } = Route.useSearch();
  const [question, setQuestion] = useState(q ?? "");
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
        // The server must know this device too, or Face ID could not unlock the folders.
        try {
          const { secret } = await registerDevice();
          if (secret) saveBiometricSecret(ws.id, secret);
        } catch (error) {
          removeBiometric();
          throw error;
        }
        setCanBio(false);
        toast.success(sv ? "Face ID / fingeravtryck är på." : "Face ID / fingerprint enabled.");
      }
    } catch {
      toast.error(sv ? "Det gick inte att aktivera." : "Couldn't enable it.");
    }
  }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-2xl px-4 pt-[min(14vh,7rem)] pb-16 sm:px-6">
        <div className="rise text-center">
          <span className="mx-auto grid size-12 place-content-center rounded-full bg-accent/15 text-accent">
            <Sparkles className="size-6" aria-hidden />
          </span>
          <h1 className="mt-4 text-4xl sm:text-5xl">{sv ? "Vad vill du veta?" : "What do you want to know?"}</h1>
        </div>
        <div className="rise mt-8 [--i:1]">
          <AskBar
            autoFocus
            value={question}
            onChange={setQuestion}
            onSubmit={() => void run(question)}
            placeholder={sv ? "Skriv din fråga…" : "Type your question…"}
            label={sv ? "Fråga" : "Ask"}
            loading={loading}
          />
        </div>
        <div className="rise mt-4 flex flex-wrap justify-center gap-2 [--i:2]">
          {quick.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => run(q)}
              disabled={loading}
              className="glass pressable cursor-pointer rounded-full px-4 py-2 text-sm hover:-translate-y-0.5 hover:border-accent/40 hover:bg-[var(--glass-hover)] hover:text-accent disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>

        {(loading || answer) && (
          <div className="surface pop mt-8 p-6" aria-live="polite">
            {asked && <p className="text-sm text-muted-foreground">{asked}</p>}
            <p className={loading ? "mt-2 animate-pulse text-lg text-muted-foreground" : "mt-2 text-lg whitespace-pre-wrap"}>
              {loading ? (sv ? "Letar i Barnmappen…" : "Searching Barnmappen…") : answer}
            </p>
            {!loading && <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">{t("ai.disclaimer")}</p>}
          </div>
        )}

        <div className="surface rise mt-10 divide-y divide-border overflow-hidden text-sm [--i:3]">
          {noChildren && (
            <Link to="/snabbstart" className={row}>
              <Rocket className="size-4 text-accent" aria-hidden />
              <span className="flex-1">
                <span className="block font-medium">{sv ? "Lägg in ditt första barn" : "Add your first child"}</span>
                <span className="block text-muted-foreground">
                  {sv ? "Snabbstarten tar under en minut. Sedan har assistenten något att svara på." : "The quick start takes under a minute. Then the assistant has something to answer from."}
                </span>
              </span>
              <ChevronRight className="size-4 text-muted-foreground transition-[transform,color] duration-200 ease-out group-hover:translate-x-1 group-hover:text-accent" aria-hidden />
            </Link>
          )}
          {ws && !ws.hasPin && (
            <Link to="/installningar" className={row}>
              <KeyRound className="size-4 text-accent" aria-hidden />
              <span className="flex-1">{sv ? "Skapa en 4-siffrig snabbkod för att låsa upp snabbare" : "Create a 4-digit quick code to unlock faster"}</span>
              <ChevronRight className="size-4 text-muted-foreground transition-[transform,color] duration-200 ease-out group-hover:translate-x-1 group-hover:text-accent" aria-hidden />
            </Link>
          )}
          {canBio && (
            <button type="button" onClick={enroll} className={row}>
              <Fingerprint className="size-4 text-accent" aria-hidden />
              <span className="flex-1">{sv ? "Lås upp med Face ID / fingeravtryck nästa gång" : "Unlock with Face ID / fingerprint next time"}</span>
              <ChevronRight className="size-4 text-muted-foreground transition-[transform,color] duration-200 ease-out group-hover:translate-x-1 group-hover:text-accent" aria-hidden />
            </button>
          )}
          <Link to="/barn" className={row}>
            <FolderOpen className="size-4 text-accent" aria-hidden />
            <span className="flex-1">{sv ? "Öppna barnens mappar" : "Open the children's folders"}</span>
            <ChevronRight className="size-4 text-muted-foreground transition-[transform,color] duration-200 ease-out group-hover:translate-x-1 group-hover:text-accent" aria-hidden />
          </Link>
        </div>
      </main>
    </div>
  );
}

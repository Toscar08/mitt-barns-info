import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { useWorkspace } from "@/components/PrivateGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeSlug } from "@/lib/slug";
import { activateWorkspace, checkSlug } from "@/lib/workspace.functions";
import { usePrefs } from "@/lib/prefs";

type Search = { code?: string | undefined };

export const Route = createFileRoute("/_authenticated/aktivera")({
  validateSearch: (s: Record<string, unknown>): Search => ({
    code: typeof s["code"] === "string" ? (s["code"] as string) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Aktivera din sida – Barnmappen" },
      { name: "description", content: "Aktivera din privata Barnmappen-sida med din aktiveringskod." },
      { property: "og:title", content: "Aktivera din sida – Barnmappen" },
      { property: "og:description", content: "Aktivera din privata sida med aktiveringskoden." },
    ],
  }),
  component: ActivatePage,
});

const errors = {
  sv: {
    code_unknown: "Koden finns inte. Kontrollera stavningen.",
    code_used: "Koden har redan använts.",
    taken: "Adressnamnet är upptaget.",
    reserved: "Det namnet går inte att använda.",
    format: "Använd 3–30 tecken: a–z, 0–9 och bindestreck.",
  },
  en: {
    code_unknown: "That code does not exist. Check the spelling.",
    code_used: "This code has already been used.",
    taken: "That address is taken.",
    reserved: "That name can't be used.",
    format: "Use 3–30 characters: a–z, 0–9 and hyphens.",
  },
} as const;

function ActivatePage() {
  const { code: initialCode } = Route.useSearch();
  const { lang } = usePrefs();
  const sv = lang === "sv";
  const E = errors[lang];
  const workspace = useWorkspace();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activate = useServerFn(activateWorkspace);
  const check = useServerFn(checkSlug);

  const [code, setCode] = useState(initialCode ?? "");
  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [slugState, setSlugState] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const value = normalizeSlug(slug);
    if (value.length < 3) {
      setSlugState(null);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await check({ data: { slug: value } });
      setSlugState(res.available ? "ok" : (res.reason ?? "taken"));
    }, 400);
    return () => clearTimeout(timer);
  }, [slug, check]);

  if (workspace.data) return <Navigate to="/f/$slug" params={{ slug: workspace.data.slug }} replace />;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const res = await activate({ data: { code, slug, displayName } });
      if (!res.ok) {
        toast.error(E[res.error as keyof typeof E] ?? res.error);
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
      toast.success(sv ? "Din sida är aktiverad!" : "Your site is activated!");
      navigate({ to: "/installningar" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const normalized = normalizeSlug(slug);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-lg px-6 py-12">
        <KeyRound className="size-8 text-accent" aria-hidden />
        <h1 className="mt-4 font-display text-3xl">{sv ? "Aktivera din privata sida" : "Activate your private site"}</h1>
        <p className="mt-2 text-muted-foreground">
          {sv
            ? "Koden behövs bara en gång. Därefter loggar du in som vanligt."
            : "The code is only needed once. After that you sign in as usual."}
        </p>
        <form onSubmit={submit} className="mt-8 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="code">{sv ? "Aktiveringskod" : "Activation code"}</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BM-XXXX-XXXX-XXXX"
              required
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">{sv ? "Adressnamn" : "Address name"}</Label>
            <Input id="slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="familj-a" required />
            <p className="text-sm text-muted-foreground">
              barnmappen.se/f/<span className="text-foreground">{normalized || "…"}</span>
              {slugState === "ok" && <span className="ml-2 text-accent">{sv ? "Ledigt" : "Available"}</span>}
              {slugState && slugState !== "ok" && (
                <span className="ml-2 text-destructive">{E[slugState as keyof typeof E]}</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {sv
                ? "Adressen är inte hemlig – sidan kräver alltid inloggning."
                : "The address isn't secret – the site always requires sign-in."}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dn">{sv ? "Namn på sidan (valfritt)" : "Site name (optional)"}</Label>
            <Input id="dn" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={sv ? "Familjen Andersson" : "The Andersons"} />
          </div>
          <Button type="submit" className="w-full" disabled={busy || slugState !== "ok" || code.length < 6}>
            {sv ? "Aktivera" : "Activate"}
          </Button>
        </form>
        <p className="mt-6 text-sm text-muted-foreground">
          {sv ? "Har du ingen kod?" : "No code?"}{" "}
          <Link to="/kop" className="text-accent underline-offset-4 hover:underline">
            {sv ? "Köp åtkomst" : "Buy access"}
          </Link>
        </p>
      </main>
    </div>
  );
}

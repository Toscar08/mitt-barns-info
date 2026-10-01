import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Check, FolderHeart } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PrefToggles } from "@/components/PrefToggles";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { createTestPurchase } from "@/lib/workspace.functions";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/kop")({
  head: () => ({
    meta: [
      { title: "Köp Barnmappen – din privata barnsida" },
      { name: "description", content: "Köp åtkomst till din egen privata sida för dina barns information, dokument och kalender." },
      { property: "og:title", content: "Köp Barnmappen" },
      { property: "og:description", content: "Din egen privata sida för allt som rör dina barn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuyPage,
});

function BuyPage() {
  const { lang } = usePrefs();
  const sv = lang === "sv";
  const purchase = useServerFn(createTestPurchase);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  async function buy() {
    setBusy(true);
    try {
      const res = await purchase();
      setCode(res.code);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  }

  const features = sv
    ? ["Egen privat adress", "Obegränsat antal barnprofiler", "Dokument upp till 25 MB per fil", "AI-assistent som svarar utifrån din information", "Export och återställning", "PIN-lås och installation som app"]
    : ["Your own private address", "Unlimited child profiles", "Documents up to 25 MB each", "AI assistant answering from your info", "Export and restore", "PIN lock and installable app"];

  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <FolderHeart className="size-5 text-accent" aria-hidden />
          <span className="font-display text-xl">Barnmappen</span>
        </Link>
        <PrefToggles />
      </header>
      <main className="mx-auto max-w-xl px-6 py-12">
        <h1 className="font-display text-4xl">{sv ? "Skaffa din egen Barnmapp" : "Get your own Barnmappen"}</h1>
        <div className="mt-8 rounded-2xl border border-border bg-card p-8">
          <p className="font-display text-3xl">
            495 kr <span className="text-base text-muted-foreground">{sv ? "/ år" : "/ year"}</span>
          </p>
          <ul className="mt-6 space-y-3">
            {features.map((f) => (
              <li key={f} className="flex gap-3">
                <Check className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                {f}
              </li>
            ))}
          </ul>

          <div className="mt-6 rounded-lg bg-secondary p-4 text-sm text-secondary-foreground">
            {sv
              ? "Testläge: betalning är inte kopplad ännu. Du får en aktiveringskod utan att något dras."
              : "Test mode: payments aren't connected yet. You get an activation code without being charged."}
          </div>

          {code ? (
            <div className="mt-6 space-y-4 text-center">
              <p className="text-sm text-muted-foreground">{sv ? "Din aktiveringskod" : "Your activation code"}</p>
              <p className="font-mono text-2xl tracking-wider">{code}</p>
              <img
                className="mx-auto rounded-lg bg-white p-2"
                width={180}
                height={180}
                alt={sv ? "QR-kod för aktivering" : "Activation QR code"}
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(`${window.location.origin}/aktivera?code=${code}`)}`}
              />
              <Button asChild className="w-full">
                <Link to="/aktivera" search={{ code }}>{sv ? "Aktivera nu" : "Activate now"}</Link>
              </Button>
            </div>
          ) : signedIn === false ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                {sv ? "Skapa först ett konto, sedan genomför du köpet." : "Create an account first, then complete the purchase."}
              </p>
              <Button asChild className="w-full">
                <Link to="/auth">{sv ? "Skapa konto / logga in" : "Create account / sign in"}</Link>
              </Button>
            </div>
          ) : (
            <Button className="mt-6 w-full" onClick={buy} disabled={busy || signedIn === null}>
              {sv ? "Köp (testläge)" : "Buy (test mode)"}
            </Button>
          )}
        </div>
      </main>
    </div>
  );
}

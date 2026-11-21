import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { PrivateGate, rememberUnlocked, useWorkspace } from "@/components/PrivateGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { myActivationCode, setPin, updateWorkspace } from "@/lib/workspace.functions";
import { usePrefs } from "@/lib/prefs";
import { AccountAccess } from "@/components/AccountAccess";
import { DeleteAccount } from "@/components/DeleteAccount";

export const Route = createFileRoute("/_authenticated/installningar")({
  validateSearch: (search: Record<string, unknown>): { betalt?: boolean | undefined } => ({
    betalt: search["betalt"] === 1 || search["betalt"] === "1" || search["betalt"] === true ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Inställningar – Barnmappen" },
      { name: "description", content: "Hantera adress, namn och PIN-kod för din privata sida." },
      { property: "og:title", content: "Inställningar – Barnmappen" },
      { property: "og:description", content: "Hantera din privata sida." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PrivateGate>
      <SettingsPage />
    </PrivateGate>
  ),
});

function SettingsPage() {
  const { lang } = usePrefs();
  const sv = lang === "sv";
  const workspace = useWorkspace();
  const queryClient = useQueryClient();
  const save = useServerFn(updateWorkspace);
  const savePin = useServerFn(setPin);
  const fetchCode = useServerFn(myActivationCode);
  const code = useQuery({ queryKey: ["activation-code"], queryFn: () => fetchCode() });

  // Back from Stripe. The payment reaches us through the webhook a moment later, so look again a few times.
  const { betalt } = Route.useSearch();
  const navigate = useNavigate();
  useEffect(() => {
    if (!betalt) return;
    toast.success(sv ? "Tack! Din prenumeration är på väg att aktiveras." : "Thank you! Your subscription is being activated.");
    const timers = [2000, 5000, 10000, 20000].map((ms) =>
      setTimeout(() => void queryClient.invalidateQueries({ queryKey: ["account-access"] }), ms),
    );
    void navigate({ to: "/installningar", search: {}, replace: true });
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [betalt]);

  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pin, setPinValue] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (workspace.data) {
      setSlug(workspace.data.slug);
      setDisplayName(workspace.data.displayName ?? "");
    }
  }, [workspace.data]);

  const ws = workspace.data;
  if (!ws) return null;
  const address = `${typeof window !== "undefined" ? window.location.origin : ""}/f/${ws.slug}`;

  async function copyAddress() {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error(sv ? "Kunde inte kopiera adressen." : "Couldn't copy the address.");
    }
  }

  async function saveInfo(event: React.FormEvent) {
    event.preventDefault();
    const res = await save({ data: { slug, displayName } });
    if (!res.ok) {
      toast.error(sv ? "Adressnamnet är upptaget eller ogiltigt." : "Address is taken or invalid.");
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    toast.success(sv ? "Sparat" : "Saved");
  }

  async function submitPin(remove: boolean) {
    try {
      await savePin({ data: { pin: remove ? "" : pin } });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      return;
    }
    if (!remove && ws) rememberUnlocked(ws.id);
    setPinValue("");
    await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    toast.success(remove ? (sv ? "PIN-kod borttagen" : "PIN removed") : sv ? "PIN-kod sparad" : "PIN saved");
  }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="rise mx-auto max-w-2xl space-y-5 px-4 py-8 sm:px-6">
        <h1 className="text-3xl sm:text-4xl">{sv ? "Inställningar" : "Settings"}</h1>
        <AccountAccess />

        <section className="surface space-y-2 p-6">
          <h2 className="text-xl">{sv ? "Din adress" : "Your address"}</h2>
          <div className="well flex items-center gap-2 py-1.5 pr-1.5 pl-3.5">
            <p className="min-w-0 flex-1 font-mono text-sm break-all">{address}</p>
            <Button type="button" variant="ghost" size="sm" className="shrink-0" onClick={copyAddress}>
              {copied ? <Check className="text-accent" aria-hidden /> : <Copy aria-hidden />}
              <span aria-live="polite">{copied ? (sv ? "Kopierad" : "Copied") : sv ? "Kopiera" : "Copy"}</span>
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {sv
              ? "Spara som bokmärke eller installera som app via webbläsarens meny (\"Lägg till på hemskärmen\")."
              : "Bookmark it or install it as an app via your browser menu (\"Add to Home Screen\")."}
          </p>
        </section>

        <form onSubmit={saveInfo} className="surface space-y-4 p-6">
          <h2 className="text-xl">{sv ? "Namn och adress" : "Name and address"}</h2>
          <div className="space-y-2">
            <Label htmlFor="s-slug">{sv ? "Adressnamn" : "Address name"}</Label>
            <Input id="s-slug" value={slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="s-name">{sv ? "Namn på sidan" : "Site name"}</Label>
            <Input id="s-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <Button type="submit">{sv ? "Spara" : "Save"}</Button>
        </form>

        <section className="surface space-y-4 p-6">
          <h2 className="text-xl">{sv ? "PIN-kod" : "PIN code"}</h2>
          <p className="text-sm text-muted-foreground">
            {ws.hasPin
              ? sv
                ? "PIN-kod är aktiv. Den krävs efter inloggning i varje ny flik."
                : "PIN is active. It's required after sign-in in each new tab."
              : sv
                ? "Lägg till en PIN-kod (4–8 siffror) som extra lås."
                : "Add a PIN (4–8 digits) as an extra lock."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Input
              inputMode="numeric"
              type="password"
              maxLength={8}
              value={pin}
              onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
              aria-label="PIN"
              className="max-w-40"
            />
            <Button onClick={() => submitPin(false)} disabled={pin.length < 4}>
              {ws.hasPin ? (sv ? "Byt" : "Change") : sv ? "Spara" : "Save"}
            </Button>
            {ws.hasPin && (
              <Button variant="outline" onClick={() => submitPin(true)}>
                {sv ? "Ta bort" : "Remove"}
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {sv
              ? "Med PIN-kod på kan du också låsa upp med Face ID eller fingeravtryck. Det slår du på från Fråga-sidan."
              : "With a PIN set you can also unlock with Face ID or fingerprint. Turn it on from the Ask page."}
          </p>
        </section>

        {code.data && (
          <section className="surface space-y-2 p-6">
            <h2 className="text-xl">{sv ? "Aktiveringskod" : "Activation code"}</h2>
            <p className="font-mono">{code.data.code}</p>
            <p className="text-sm text-muted-foreground">{sv ? "Använd – behövs inte för inloggning." : "Used – not needed to sign in."}</p>
          </section>
        )}

        <DeleteAccount hasPin={ws.hasPin} />
      </main>
    </div>
  );
}

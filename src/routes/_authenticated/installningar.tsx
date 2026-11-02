import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AppHeader } from "@/components/AppHeader";
import { PrivateGate, useWorkspace } from "@/components/PrivateGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { myActivationCode, setPin, updateWorkspace } from "@/lib/workspace.functions";
import { usePrefs } from "@/lib/prefs";
import { AccountAccess } from "@/components/AccountAccess";

export const Route = createFileRoute("/_authenticated/installningar")({
  head: () => ({
    meta: [
      { title: "Inställningar – Barnmappen" },
      { name: "description", content: "Hantera adress, namn och PIN-kod för din privata sida." },
      { property: "og:title", content: "Inställningar – Barnmappen" },
      { property: "og:description", content: "Hantera din privata sida." },
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

  const [slug, setSlug] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [pin, setPinValue] = useState("");

  useEffect(() => {
    if (workspace.data) {
      setSlug(workspace.data.slug);
      setDisplayName(workspace.data.displayName ?? "");
    }
  }, [workspace.data]);

  const ws = workspace.data;
  if (!ws) return null;
  const address = `${typeof window !== "undefined" ? window.location.origin : ""}/f/${ws.slug}`;

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
    await savePin({ data: { pin: remove ? "" : pin } });
    setPinValue("");
    await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    toast.success(remove ? (sv ? "PIN-kod borttagen" : "PIN removed") : sv ? "PIN-kod sparad" : "PIN saved");
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-2xl space-y-10 px-6 py-10">
        <h1 className="font-display text-3xl">{sv ? "Inställningar" : "Settings"}</h1>
        <AccountAccess />

        <section className="space-y-2 rounded-xl border border-border bg-card p-6">
          <h2 className="font-display text-xl">{sv ? "Din adress" : "Your address"}</h2>
          <p className="break-all font-mono text-sm">{address}</p>
          <p className="text-sm text-muted-foreground">
            {sv
              ? "Spara som bokmärke eller installera som app via webbläsarens meny (\"Lägg till på hemskärmen\")."
              : "Bookmark it or install it as an app via your browser menu (\"Add to Home Screen\")."}
          </p>
        </section>

        <form onSubmit={saveInfo} className="space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="font-display text-xl">{sv ? "Namn och adress" : "Name and address"}</h2>
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

        <section className="space-y-4 rounded-xl border border-border bg-card p-6">
          <h2 className="font-display text-xl">{sv ? "PIN-kod" : "PIN code"}</h2>
          <p className="text-sm text-muted-foreground">
            {ws.hasPin
              ? sv
                ? "PIN-kod är aktiv. Den krävs efter inloggning i varje ny flik."
                : "PIN is active. It's required after sign-in in each new tab."
              : sv
                ? "Lägg till en PIN-kod (4–8 siffror) som extra lås."
                : "Add a PIN (4–8 digits) as an extra lock."}
          </p>
          <div className="flex gap-2">
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
              ? "Face ID/Touch ID och BankID är planerat men inte aktiverat ännu."
              : "Face ID/Touch ID and BankID are planned but not enabled yet."}
          </p>
        </section>

        {code.data && (
          <section className="space-y-2 rounded-xl border border-border bg-card p-6">
            <h2 className="font-display text-xl">{sv ? "Aktiveringskod" : "Activation code"}</h2>
            <p className="font-mono">{code.data.code}</p>
            <p className="text-sm text-muted-foreground">{sv ? "Använd – behövs inte för inloggning." : "Used – not needed to sign in."}</p>
          </section>
        )}
      </main>
    </div>
  );
}

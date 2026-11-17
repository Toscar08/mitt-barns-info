import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LoaderCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { lockWorkspace } from "@/components/PrivateGate";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { deleteMyAccount } from "@/lib/account.functions";
import { usePrefs } from "@/lib/prefs";

const copy = {
  sv: {
    heading: "Radera konto",
    lead: "Tar bort ditt konto och all information om dina barn för gott.",
    open: "Radera mitt konto",
    title: "Radera kontot för gott?",
    gone: "Det här försvinner och går inte att få tillbaka:",
    goneList: ["Alla barnmappar med uppgifter, anteckningar och uppgifter att göra", "Alla uppladdade dokument", "Kalenderkopplingar, PIN-kod och din privata adress", "Inloggningen"],
    kept: "Kvitton på eventuella köp sparas i sju år enligt bokföringslagen, utan innehåll från mapparna. Ett köp följer inte med till ett nytt konto.",
    backup: "Vill du spara något? Säkerhetskopiera varje barnmapp först.",
    word: "RADERA",
    type: (word: string) => `Skriv ${word} för att bekräfta`,
    pin: "Din PIN-kod",
    confirm: "Radera kontot",
    cancel: "Avbryt",
    done: "Ditt konto och all information är raderade.",
    errors: {
      pin_required: "Skriv din PIN-kod.",
      wrong_pin: "Fel PIN-kod.",
      locked: "För många fel försök. Koden är spärrad en stund – försök igen senare.",
      failed: "Kontot kunde inte raderas. Inget har tagits bort från dina mappar. Försök igen eller kontakta oss.",
    },
  },
  en: {
    heading: "Delete account",
    lead: "Removes your account and all information about your children for good.",
    open: "Delete my account",
    title: "Delete the account for good?",
    gone: "This is removed and cannot be recovered:",
    goneList: ["All child folders with details, notes and tasks", "All uploaded documents", "Calendar links, PIN code and your private address", "The login"],
    kept: "Receipts for any purchase are kept for seven years under Swedish bookkeeping law, with nothing from the folders. A purchase does not carry over to a new account.",
    backup: "Want to keep something? Back up each child folder first.",
    word: "DELETE",
    type: (word: string) => `Type ${word} to confirm`,
    pin: "Your PIN code",
    confirm: "Delete the account",
    cancel: "Cancel",
    done: "Your account and all information have been deleted.",
    errors: {
      pin_required: "Enter your PIN code.",
      wrong_pin: "Wrong PIN code.",
      locked: "Too many wrong attempts. The code is locked for a while – try again later.",
      failed: "The account could not be deleted. Try again or contact us.",
    },
  },
} as const;

export function DeleteAccount({ hasPin }: { hasPin: boolean }) {
  const { lang } = usePrefs();
  const c = copy[lang];
  const remove = useServerFn(deleteMyAccount);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready = typed.trim().toUpperCase() === c.word && (!hasPin || pin.length >= 4);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      const result = await remove({ data: { confirm: c.word, pin: hasPin ? pin : undefined } });
      if (!result.ok) {
        setError(c.errors[result.error]);
        setPin("");
        return;
      }
      // The login no longer exists. Drop everything this browser still holds about it.
      await queryClient.cancelQueries();
      queryClient.clear();
      lockWorkspace();
      await supabase.auth.signOut({ scope: "local" }).catch(() => undefined);
      toast.success(c.done);
      void navigate({ to: "/", replace: true });
    } catch {
      setError(c.errors.failed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface space-y-3 border-destructive/25 p-6">
      <h2 className="text-xl">{c.heading}</h2>
      <p className="text-sm text-muted-foreground">{c.lead}</p>
      <Button
        variant="ghost"
        className="-ml-2 text-destructive hover:bg-destructive/10"
        onClick={() => {
          setTyped("");
          setPin("");
          setError(null);
          setOpen(true);
        }}
      >
        <Trash2 aria-hidden />
        {c.open}
      </Button>

      <AlertDialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <AlertDialogContent className="max-w-md">
          <form onSubmit={submit} className="grid gap-4">
            <AlertDialogHeader>
              <AlertDialogTitle>{c.title}</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3 text-sm text-muted-foreground">
                  <p>{c.gone}</p>
                  <ul className="list-disc space-y-1 pl-5 text-left text-foreground">
                    {c.goneList.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                  <p>{c.kept}</p>
                  <p className="font-medium text-foreground">{c.backup}</p>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="space-y-2">
              <Label htmlFor="delete-word">{c.type(c.word)}</Label>
              <Input
                id="delete-word"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                value={typed}
                onChange={(event) => setTyped(event.target.value)}
              />
            </div>
            {hasPin && (
              <div className="space-y-2">
                <Label htmlFor="delete-pin">{c.pin}</Label>
                <Input
                  id="delete-pin"
                  type="password"
                  inputMode="numeric"
                  autoComplete="off"
                  maxLength={8}
                  value={pin}
                  onChange={(event) => setPin(event.target.value.replace(/\D/g, ""))}
                  className="max-w-40"
                />
              </div>
            )}
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <AlertDialogFooter>
              <AlertDialogCancel type="button" disabled={busy}>
                {c.cancel}
              </AlertDialogCancel>
              <Button type="submit" variant="destructive" disabled={!ready || busy}>
                {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : <Trash2 aria-hidden />}
                {c.confirm}
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

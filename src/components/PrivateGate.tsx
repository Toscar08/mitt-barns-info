import { useQuery } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { LockKeyhole } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMyWorkspace, unlockWithPin } from "@/lib/workspace.functions";
import { usePrefs } from "@/lib/prefs";

const UNLOCK_KEY = "barnmappen.unlocked";

export function useWorkspace() {
  const fetchWorkspace = useServerFn(getMyWorkspace);
  return useQuery({ queryKey: ["workspace"], queryFn: () => fetchWorkspace() });
}

export function lockWorkspace() {
  sessionStorage.removeItem(UNLOCK_KEY);
}

export function PrivateGate({ children }: { children: ReactNode }) {
  const workspace = useWorkspace();
  const { lang } = usePrefs();
  const unlock = useServerFn(unlockWithPin);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (workspace.data && sessionStorage.getItem(UNLOCK_KEY) === workspace.data.id) setUnlocked(true);
  }, [workspace.data]);

  if (workspace.isLoading) {
    return <div className="min-h-screen bg-background" />;
  }
  if (workspace.error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-muted-foreground">
        {workspace.error.message}
      </div>
    );
  }
  if (!workspace.data) return <Navigate to="/aktivera" replace />;
  if (!workspace.data.hasPin || unlocked) return <>{children}</>;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const res = await unlock({ data: { pin } });
      if (res.ok) {
        sessionStorage.setItem(UNLOCK_KEY, workspace.data!.id);
        setUnlocked(true);
      } else {
        setError(true);
        setLocked("locked" in res && !!res.locked);
        setPin("");
      }
    } finally {
      setBusy(false);
    }
  }

  const sv = lang === "sv";
  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6">
      <form onSubmit={submit} className="w-full max-w-xs space-y-5 text-center">
        <LockKeyhole className="mx-auto size-8 text-accent" aria-hidden />
        <h1 className="font-display text-2xl">{sv ? "Ange din PIN-kod" : "Enter your PIN"}</h1>
        <Input
          autoFocus
          inputMode="numeric"
          type="password"
          autoComplete="off"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="text-center text-2xl tracking-[0.5em]"
          aria-label="PIN"
        />
        {error && (
          <p className="text-sm text-destructive">{locked ? (sv ? "För många försök. Vänta 15 minuter." : "Too many attempts. Wait 15 minutes.") : sv ? "Fel PIN-kod." : "Wrong PIN."}</p>
        )}
        <Button type="submit" className="w-full" disabled={busy || pin.length < 4}>
          {sv ? "Lås upp" : "Unlock"}
        </Button>
      </form>
    </main>
  );
}

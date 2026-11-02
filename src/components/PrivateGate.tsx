import { useQuery } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Fingerprint, LockKeyhole } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { biometricEnrolled, verifyBiometric } from "@/lib/biometric";
import { getMyWorkspace, unlockWithPin } from "@/lib/workspace.functions";
import { usePrefs } from "@/lib/prefs";
import { AccountAccess, useAccountAccess } from "@/components/AccountAccess";
import { AppHeader } from "@/components/AppHeader";

const UNLOCK_KEY = "barnmappen.unlocked";
const ACTIVE_KEY = "barnmappen.lastActive";
export const IDLE_LOCK_MS = 5 * 60 * 1000;

export function useWorkspace() {
  const fetchWorkspace = useServerFn(getMyWorkspace);
  return useQuery({ queryKey: ["workspace"], queryFn: () => fetchWorkspace() });
}

export function lockWorkspace() {
  sessionStorage.removeItem(UNLOCK_KEY);
  sessionStorage.removeItem(ACTIVE_KEY);
}

function stillUnlocked(id: string) {
  if (sessionStorage.getItem(UNLOCK_KEY) !== id) return false;
  const last = Number(sessionStorage.getItem(ACTIVE_KEY) || 0);
  return Date.now() - last < IDLE_LOCK_MS;
}

export function PrivateGate({ children }: { children: ReactNode }) {
  const workspace = useWorkspace();
  const access = useAccountAccess();
  const { lang } = usePrefs();
  const unlock = useServerFn(unlockWithPin);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bioId, setBioId] = useState<string | null>(null);
  const sv = lang === "sv";
  const ws = workspace.data;

  const markUnlocked = useCallback(() => {
    if (!ws) return;
    sessionStorage.setItem(UNLOCK_KEY, ws.id);
    sessionStorage.setItem(ACTIVE_KEY, String(Date.now()));
    setUnlocked(true);
  }, [ws]);

  const tryBiometric = useCallback(
    async (id: string) => {
      if (await verifyBiometric(id)) markUnlocked();
    },
    [markUnlocked],
  );

  useEffect(() => {
    if (!ws) return;
    if (stillUnlocked(ws.id)) {
      sessionStorage.setItem(ACTIVE_KEY, String(Date.now()));
      setUnlocked(true);
      return;
    }
    lockWorkspace();
    const id = ws.hasPin ? biometricEnrolled(ws.id) : null;
    setBioId(id);
    if (id) void tryBiometric(id);
  }, [ws, tryBiometric]);

  // Auto-lock after inactivity (also when returning to the app after a while).
  useEffect(() => {
    if (!ws?.hasPin || !unlocked) return;
    const touch = () => sessionStorage.setItem(ACTIVE_KEY, String(Date.now()));
    const check = () => {
      if (!stillUnlocked(ws.id)) {
        lockWorkspace();
        setUnlocked(false);
        setPin("");
        const id = biometricEnrolled(ws.id);
        setBioId(id);
        if (id && document.visibilityState === "visible") void tryBiometric(id);
      }
    };
    const onVis = () => (document.visibilityState === "visible" ? check() : undefined);
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", onVis);
    const timer = setInterval(check, 15000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(timer);
    };
  }, [ws, unlocked, tryBiometric]);

  if (workspace.isLoading || access.isPending) {
    return <div className="min-h-screen bg-background" />;
  }
  if (workspace.error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-muted-foreground">
        {workspace.error.message}
      </div>
    );
  }
  if (access.error || !access.data || !["paid", "trial"].includes(access.data.status)) return (
    <div className="min-h-screen bg-background"><AppHeader /><main className="mx-auto max-w-2xl space-y-6 px-6 py-10"><AccountAccess /></main></div>
  );
  if (!ws) return <Navigate to="/aktivera" replace />;
  if (!ws.hasPin || unlocked) return <>{children}</>;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(false);
    try {
      const res = await unlock({ data: { pin } });
      if (res.ok) {
        markUnlocked();
      } else {
        setError(true);
        setLocked("locked" in res && !!res.locked);
        setPin("");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-background px-6">
      <form onSubmit={submit} className="w-full max-w-xs space-y-5 text-center">
        <LockKeyhole className="mx-auto size-8 text-accent" aria-hidden />
        <h1 className="font-display text-2xl">{sv ? "Lås upp Barnmappen" : "Unlock Barnmappen"}</h1>
        {bioId && (
          <Button type="button" variant="secondary" className="w-full gap-2" onClick={() => tryBiometric(bioId)}>
            <Fingerprint className="size-5" aria-hidden />
            {sv ? "Lås upp med Face ID / fingeravtryck" : "Unlock with Face ID / fingerprint"}
          </Button>
        )}
        <p className="text-sm text-muted-foreground">{sv ? "Eller skriv din kod" : "Or enter your code"}</p>
        <Input
          autoFocus={!bioId}
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
          <p className="text-sm text-destructive">{locked ? (sv ? "För många försök. Vänta 15 minuter." : "Too many attempts. Wait 15 minutes.") : sv ? "Fel kod." : "Wrong code."}</p>
        )}
        <Button type="submit" className="w-full" disabled={busy || pin.length < 4}>
          {sv ? "Lås upp" : "Unlock"}
        </Button>
      </form>
    </main>
  );
}

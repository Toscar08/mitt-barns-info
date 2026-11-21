import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Fingerprint, LockKeyhole } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { biometricEnrolled, biometricSecret, removeBiometric, verifyBiometric } from "@/lib/biometric";
import {
  getMyWorkspace,
  keepUnlocked,
  lockNow,
  pinStatus,
  unlockWithDevice,
  unlockWithPin,
} from "@/lib/workspace.functions";
import { usePrefs } from "@/lib/prefs";
import { AccountAccess, useAccountAccess } from "@/components/AccountAccess";
import { AppHeader } from "@/components/AppHeader";
import { Loader } from "@/components/Brand";
import { useFamily } from "@/lib/family";

const UNLOCK_KEY = "barnmappen.unlocked";
const ACTIVE_KEY = "barnmappen.lastActive";
export const IDLE_LOCK_MS = 5 * 60 * 1000;
// How often an active app tells the server to keep the session unlocked. Well inside its 15 minutes.
const KEEPALIVE_MS = 60 * 1000;

export function useWorkspace() {
  const fetchWorkspace = useServerFn(getMyWorkspace);
  return useQuery({ queryKey: ["workspace"], queryFn: () => fetchWorkspace() });
}

export function lockWorkspace() {
  sessionStorage.removeItem(UNLOCK_KEY);
  sessionStorage.removeItem(ACTIVE_KEY);
}

/** Keeps this tab open after the parent has just set a PIN, instead of asking for it at once. */
export function rememberUnlocked(workspaceId: string) {
  sessionStorage.setItem(UNLOCK_KEY, workspaceId);
  sessionStorage.setItem(ACTIVE_KEY, String(Date.now()));
}

function stillUnlocked(id: string) {
  if (sessionStorage.getItem(UNLOCK_KEY) !== id) return false;
  const last = Number(sessionStorage.getItem(ACTIVE_KEY) || 0);
  return Date.now() - last < IDLE_LOCK_MS;
}

type ServerLock = "open" | "locked" | "legacy";

/**
 * The PIN lock. The database decides whether this sign-in session may read the folders
 * (migration 0008); this screen asks for the PIN when it may not. The browser's own idle timer
 * only ever locks sooner, never later. Before the migration ("legacy") the browser alone decides,
 * as it always did.
 */
export function PrivateGate({ children }: { children: ReactNode }) {
  const workspace = useWorkspace();
  const access = useAccountAccess();
  // Someone invited into a family uses that family's access, with or without their own.
  const family = useFamily();
  const inFamily = family.data?.joined.some((f) => f.active) ?? false;
  const { lang } = usePrefs();
  const queryClient = useQueryClient();
  const unlock = useServerFn(unlockWithPin);
  const unlockDevice = useServerFn(unlockWithDevice);
  const fetchStatus = useServerFn(pinStatus);
  const keepAlive = useServerFn(keepUnlocked);
  const lockServer = useServerFn(lockNow);
  const [unlocked, setUnlocked] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [locked, setLocked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [bioId, setBioId] = useState<string | null>(null);
  const server = useRef<ServerLock>("legacy");
  const sv = lang === "sv";
  const ws = workspace.data;

  const markUnlocked = useCallback(() => {
    if (!ws) return;
    sessionStorage.setItem(UNLOCK_KEY, ws.id);
    sessionStorage.setItem(ACTIVE_KEY, String(Date.now()));
    setUnlocked(true);
    // Anything fetched while locked came back empty from the database. Fetch it again.
    void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] !== "workspace" });
  }, [ws, queryClient]);

  const lockHere = useCallback(
    (tellServer: boolean) => {
      lockWorkspace();
      setUnlocked(false);
      setPin("");
      if (tellServer && server.current !== "legacy") void lockServer().catch(() => undefined);
    },
    [lockServer],
  );

  const tryBiometric = useCallback(
    async (id: string) => {
      if (!ws || !(await verifyBiometric(id))) return;
      if (server.current === "legacy") return markUnlocked();
      const secret = biometricSecret(ws.id);
      const result = secret ? await unlockDevice({ data: { secret } }).catch(() => ({ ok: false })) : { ok: false };
      if (result.ok) return markUnlocked();
      // Set up before the server lock existed, or no longer known to the server: back to the PIN.
      removeBiometric();
      setBioId(null);
    },
    [ws, markUnlocked, unlockDevice],
  );

  useEffect(() => {
    if (!ws) return;
    if (!ws.hasPin) {
      setChecking(false);
      return;
    }
    let cancelled = false;
    setChecking(true);
    void fetchStatus()
      .then(({ state }) => state as ServerLock)
      .catch((): ServerLock => "legacy")
      .then((state) => {
        if (cancelled) return;
        server.current = state;
        setChecking(false);
        // A new tab asks for the PIN again, and so does a session the server has locked.
        if (stillUnlocked(ws.id) && state !== "locked") {
          sessionStorage.setItem(ACTIVE_KEY, String(Date.now()));
          setUnlocked(true);
          return;
        }
        lockWorkspace();
        const id = biometricEnrolled(ws.id);
        setBioId(id);
        if (id) void tryBiometric(id);
      });
    return () => {
      cancelled = true;
    };
  }, [ws, fetchStatus, tryBiometric]);

  // Auto-lock after inactivity (also when returning to the app after a while), and keep the
  // server unlock alive while the parent is actually using the app.
  useEffect(() => {
    if (!ws?.hasPin || !unlocked) return;
    const touch = () => sessionStorage.setItem(ACTIVE_KEY, String(Date.now()));
    const relock = () => {
      lockHere(true);
      const id = biometricEnrolled(ws.id);
      setBioId(id);
      if (id && document.visibilityState === "visible") void tryBiometric(id);
    };
    const check = () => {
      if (!stillUnlocked(ws.id)) relock();
    };
    const ping = async () => {
      const last = Number(sessionStorage.getItem(ACTIVE_KEY) || 0);
      if (server.current === "legacy" || Date.now() - last > KEEPALIVE_MS * 2) return;
      try {
        const { state } = await keepAlive();
        if (state === "locked") relock();
      } catch {
        // A network hiccup is no reason to lock; the next ping tries again.
      }
    };
    const onVis = () => (document.visibilityState === "visible" ? check() : undefined);
    const events = ["pointerdown", "keydown", "scroll", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", onVis);
    const idleTimer = setInterval(check, 15000);
    const aliveTimer = setInterval(() => void ping(), KEEPALIVE_MS);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVis);
      clearInterval(idleTimer);
      clearInterval(aliveTimer);
    };
  }, [ws, unlocked, tryBiometric, lockHere, keepAlive]);

  if (workspace.isLoading || access.isPending || family.isPending) {
    return <Loader />;
  }
  if (workspace.error) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-6">
        <p className="surface max-w-sm p-6 text-center text-sm text-muted-foreground">{workspace.error.message}</p>
      </div>
    );
  }
  const ownAccess = !!access.data && ["paid", "trial", "complimentary"].includes(access.data.status);
  if (!ownAccess && !inFamily) return (
    <div className="min-h-dvh"><AppHeader /><main className="rise mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6"><AccountAccess /></main></div>
  );
  if (!ws && inFamily) return <>{children}</>;
  if (!ws) return <Navigate to="/snabbstart" replace />;
  if (!ws.hasPin || unlocked) return <>{children}</>;
  if (checking) return <Loader />;

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
    <main className="flex min-h-dvh items-center justify-center px-4">
      <form onSubmit={submit} className="surface pop w-full max-w-xs space-y-5 p-7 text-center">
        <span className="mx-auto grid size-14 place-content-center rounded-full bg-accent text-accent-foreground">
          <LockKeyhole className="size-6" aria-hidden />
        </span>
        <h1 className="text-2xl">{sv ? "Lås upp Barnmappen" : "Unlock Barnmappen"}</h1>
        {bioId && (
          <Button type="button" variant="secondary" className="w-full gap-2" onClick={() => tryBiometric(bioId)}>
            <Fingerprint className="size-5" aria-hidden />
            {sv ? "Lås upp med Face ID / fingeravtryck" : "Unlock with Face ID / fingerprint"}
          </Button>
        )}
        <p className="text-sm text-muted-foreground">
          {bioId ? (sv ? "Eller skriv din kod" : "Or enter your code") : sv ? "Skriv din PIN-kod" : "Enter your PIN"}
        </p>
        <Input
          autoFocus={!bioId}
          inputMode="numeric"
          type="password"
          autoComplete="off"
          maxLength={8}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="h-14 text-center text-2xl tracking-[0.5em] md:text-2xl"
          aria-label="PIN"
        />
        {error && (
          <p className="text-sm text-destructive" role="alert">{locked ? (sv ? "För många fel försök. Koden är spärrad en stund – försök igen senare." : "Too many wrong attempts. The code is locked for a while – try again later.") : sv ? "Fel kod." : "Wrong code."}</p>
        )}
        <Button type="submit" className="w-full" disabled={busy || pin.length < 4}>
          {sv ? "Lås upp" : "Unlock"}
        </Button>
      </form>
    </main>
  );
}

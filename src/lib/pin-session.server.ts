import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Server side of the PIN lock (migration 0008). An unlock belongs to one sign-in session and
 * runs out unless the app keeps extending it while the parent is active.
 *
 * Every call here tolerates the tables not existing yet: before the migration is applied the
 * database does not enforce the lock, and the app behaves as it did before.
 */
export const UNLOCK_MS = 15 * 60 * 1000;

const inFuture = (ms: number) => new Date(Date.now() + ms).toISOString();

function quietly(error: { message: string } | null, what: string) {
  if (error) console.error(`pin lock: ${what} failed`, error.message);
  return !error;
}

/** The JWT claim that names the sign-in session. Present in every Supabase access token. */
export function sessionIdOf(claims: Record<string, unknown>) {
  const value = claims["session_id"];
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

export async function grantUnlock(userId: string, sessionId: string | null) {
  if (!sessionId) return false;
  // Old rows of this account are dropped on the way, so the table stays small without a cron job.
  await supabaseAdmin.from("pin_unlocks").delete().eq("user_id", userId).lt("expires_at", new Date().toISOString());
  const { error } = await supabaseAdmin
    .from("pin_unlocks")
    .upsert({ session_id: sessionId, user_id: userId, expires_at: inFuture(UNLOCK_MS) }, { onConflict: "session_id" });
  return quietly(error, "grant");
}

/** Pushes the end of a still-valid unlock forward. An expired one stays expired. */
export async function extendUnlock(userId: string, sessionId: string | null) {
  if (!sessionId) return false;
  const { data, error } = await supabaseAdmin
    .from("pin_unlocks")
    .update({ expires_at: inFuture(UNLOCK_MS) })
    .eq("session_id", sessionId)
    .eq("user_id", userId)
    .gt("expires_at", new Date().toISOString())
    .select("session_id");
  quietly(error, "extend");
  return !error && (data?.length ?? 0) > 0;
}

export async function revokeUnlock(userId: string, sessionId: string | null) {
  if (!sessionId) return;
  const { error } = await supabaseAdmin.from("pin_unlocks").delete().eq("session_id", sessionId).eq("user_id", userId);
  quietly(error, "revoke");
}

/** Every session and device unlock of the account, after the PIN is changed or removed. */
export async function forgetAllUnlocks(userId: string) {
  const unlocks = await supabaseAdmin.from("pin_unlocks").delete().eq("user_id", userId);
  quietly(unlocks.error, "forget unlocks");
  const devices = await supabaseAdmin.from("pin_devices").delete().eq("user_id", userId);
  quietly(devices.error, "forget devices");
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** A long random secret for one device. Only its hash is stored, so a database leak cannot unlock. */
export async function registerDevice(userId: string) {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const secret = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  const { error } = await supabaseAdmin.from("pin_devices").insert({ user_id: userId, secret_hash: await sha256(secret) });
  return quietly(error, "register device") ? secret : null;
}

export async function deviceBelongsTo(userId: string, secret: string) {
  const { data, error } = await supabaseAdmin
    .from("pin_devices")
    .update({ last_used_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("secret_hash", await sha256(secret))
    .select("id");
  quietly(error, "check device");
  return !error && (data?.length ?? 0) > 0;
}

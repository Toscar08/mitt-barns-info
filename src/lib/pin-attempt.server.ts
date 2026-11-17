import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyPin } from "@/lib/pin.server";

const MAX_ATTEMPTS = 5;
const LOCK_MS = 15 * 60 * 1000;
const MAX_LOCK_MS = 24 * 60 * 60 * 1000;

export type PinAttempt = { ok: true } | { ok: false; locked: boolean };

/**
 * Checks a PIN against the owner's workspace and counts failures. Every place that accepts a PIN
 * goes through here, so they all share one lockout and none can be used to guess around it.
 * An account without a PIN passes.
 */
export async function attemptPin(ownerId: string, pin: string): Promise<PinAttempt> {
  const { data: row, error } = await supabaseAdmin
    .from("workspaces")
    .select("pin_hash, pin_failed_attempts, pin_locked_until")
    .eq("owner_id", ownerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row?.pin_hash) return { ok: true };
  if (row.pin_locked_until && new Date(row.pin_locked_until) > new Date()) return { ok: false, locked: true };

  if (await verifyPin(pin, row.pin_hash)) {
    await supabaseAdmin
      .from("workspaces")
      .update({ pin_failed_attempts: 0, pin_locked_until: null })
      .eq("owner_id", ownerId);
    return { ok: true };
  }

  // Failures keep counting across lockouts until a correct PIN. After the fifth, every further
  // miss locks again and each lock is twice as long as the last (15 min, 30 min, 1 h … up to a day),
  // so a four-digit code can no longer be worked through at a steady pace.
  const attempts = row.pin_failed_attempts + 1;
  const lock = attempts >= MAX_ATTEMPTS;
  const lockMs = Math.min(LOCK_MS * 2 ** (attempts - MAX_ATTEMPTS), MAX_LOCK_MS);
  await supabaseAdmin
    .from("workspaces")
    .update({
      pin_failed_attempts: attempts,
      pin_locked_until: lock ? new Date(Date.now() + lockMs).toISOString() : null,
    })
    .eq("owner_id", ownerId);
  return { ok: false, locked: lock };
}

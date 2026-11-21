import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeSlug, validateSlug } from "@/lib/slug";

export type WorkspaceInfo = {
  id: string;
  slug: string;
  displayName: string | null;
  hasPin: boolean;
};

export const getMyWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<WorkspaceInfo | null> => {
    const { data, error } = await context.supabase
      .from("workspaces")
      .select("id, slug, display_name, pin_hash")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      id: data.id,
      slug: data.slug,
      displayName: data.display_name,
      hasPin: Boolean(data.pin_hash),
    };
  });

export const checkSlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ slug: z.string().min(1).max(40) }).parse(input))
  .handler(async ({ data, context }) => {
    const slug = normalizeSlug(data.slug);
    const problem = validateSlug(slug);
    if (problem) return { slug, available: false, reason: problem as string };
    const { data: taken, error } = await context.supabase
      .from("workspaces")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (error && error.code !== "PGRST116") throw new Error(error.message);
    if (taken) return { slug, available: false, reason: "taken" };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("workspaces")
      .select("id", { count: "exact", head: true })
      .eq("slug", slug);
    return { slug, available: (count ?? 0) === 0, reason: (count ?? 0) === 0 ? null : "taken" };
  });

export const activateWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ code: z.string().max(40).optional(), slug: z.string().min(3).max(40), displayName: z.string().max(80).optional() }).parse(input))
  .handler(async ({ data, context }) => {
    const slug = normalizeSlug(data.slug);
    const problem = validateSlug(slug);
    if (problem) return { ok: false as const, error: problem };
    // Codes are not proof of payment. The database requires an active trial or verified live payment.
    const result = await context.supabase.rpc("provision_my_workspace", { new_slug: slug, new_name: data.displayName || "" });
    if (result.error) return { ok: false as const, error: result.error.code === "23505" ? "taken" : "access_required" };
    return { ok: true as const, slug: result.data };
  });

export const updateWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ slug: z.string().min(3).max(40).optional(), displayName: z.string().max(80).optional() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const patch: { slug?: string; display_name?: string | null } = {};
    if (data.slug !== undefined) {
      const slug = normalizeSlug(data.slug);
      const problem = validateSlug(slug);
      if (problem) return { ok: false as const, error: problem };
      patch.slug = slug;
    }
    if (data.displayName !== undefined) patch.display_name = data.displayName || null;

    const { error } = await context.supabase
      .from("workspaces")
      .update(patch)
      .eq("owner_id", context.userId);
    if (error) {
      const taken = error.message.includes("workspaces_slug_key");
      return { ok: false as const, error: taken ? "taken" : "format" };
    }
    return { ok: true as const, slug: patch.slug };
  });

export const setPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ pin: z.string().regex(/^\d{4,8}$/).or(z.literal("")) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    // Changing or removing an existing PIN needs an unlocked session, or a stolen session could
    // simply replace the PIN and walk in.
    if ((await lockState(context.supabase)) === "locked") throw new Error("Lås upp med din PIN-kod först.");
    const { hashPin } = await import("@/lib/pin.server");
    const pin_hash = data.pin ? await hashPin(data.pin) : null;
    const { error } = await context.supabase
      .from("workspaces")
      .update({ pin_hash })
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    // Old unlocks and Face ID devices belonged to the old PIN. This session stays open.
    // Never lets the bookkeeping of the new lock undo a PIN that has already been saved.
    try {
      const session = await import("@/lib/pin-session.server");
      await session.forgetAllUnlocks(context.userId);
      if (pin_hash) await session.grantUnlock(context.userId, session.sessionIdOf(context.claims));
    } catch (error) {
      console.error("pin lock: session bookkeeping failed", error);
    }
    return { ok: true as const, hasPin: Boolean(pin_hash) };
  });

/**
 * "open" when the database lets this session at the folders, "locked" when the PIN is needed,
 * "legacy" before migration 0008, when the database does not enforce the PIN at all.
 */
async function lockState(supabase: {
  rpc: (fn: "pin_unlocked") => PromiseLike<{ data: boolean | null; error: { code?: string } | null }>;
}): Promise<"open" | "locked" | "legacy"> {
  const { data, error } = await supabase.rpc("pin_unlocked");
  if (error) return "legacy";
  return data ? "open" : "locked";
}

export const unlockWithPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pin: z.string().min(4).max(8) }).parse(input))
  .handler(async ({ data, context }) => {
    const { attemptPin } = await import("@/lib/pin-attempt.server");
    const result = await attemptPin(context.userId, data.pin);
    if (!result.ok) return { ok: false as const, locked: result.locked };
    // A correct PIN is a correct PIN: recording the unlock must not turn it into a failure.
    try {
      const session = await import("@/lib/pin-session.server");
      await session.grantUnlock(context.userId, session.sessionIdOf(context.claims));
    } catch (error) {
      console.error("pin lock: grant failed", error);
    }
    return { ok: true as const };
  });

/** Where the lock stands for this session. The lock screen trusts this, not the browser. */
export const pinStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => ({ state: await lockState(context.supabase) }));

/** Called while the parent is active, so the unlock does not run out mid-use. */
export const keepUnlocked = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const session = await import("@/lib/pin-session.server");
    await session.extendUnlock(context.userId, session.sessionIdOf(context.claims));
    return { state: await lockState(context.supabase) };
  });

/** Locks this session right away, e.g. after the app has been left idle. */
export const lockNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const session = await import("@/lib/pin-session.server");
    await session.revokeUnlock(context.userId, session.sessionIdOf(context.claims));
    return { ok: true as const };
  });

/** Gives this device a secret for Face ID / fingerprint unlock. Only from an unlocked session. */
export const registerUnlockDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const state = await lockState(context.supabase);
    if (state === "locked") throw new Error("Lås upp med din PIN-kod först.");
    if (state === "legacy") return { secret: null };
    const { registerDevice } = await import("@/lib/pin-session.server");
    return { secret: await registerDevice(context.userId) };
  });

/** Unlocks after the device has confirmed Face ID / fingerprint, using the secret it was given. */
export const unlockWithDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ secret: z.string().regex(/^[0-9a-f]{64}$/) }).parse(input))
  .handler(async ({ data, context }) => {
    const session = await import("@/lib/pin-session.server");
    if (!(await session.deviceBelongsTo(context.userId, data.secret))) return { ok: false as const };
    await session.grantUnlock(context.userId, session.sessionIdOf(context.claims));
    return { ok: true as const };
  });

export const myActivationCode = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("activation_codes")
      .select("code, created_at, used_at")
      .eq("used_by", context.userId)
      .maybeSingle();
    return data ?? null;
  });

// Compatibility endpoint: test codes must never grant campaign or paid access.
export const createTestPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ code: string }> => {
    throw new Error("Betalning är inte ansluten ännu. Testköp är avstängda.");
  });

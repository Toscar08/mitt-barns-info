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
    const { hashPin } = await import("@/lib/pin.server");
    const pin_hash = data.pin ? await hashPin(data.pin) : null;
    const { error } = await context.supabase
      .from("workspaces")
      .update({ pin_hash })
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true as const, hasPin: Boolean(pin_hash) };
  });

export const unlockWithPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pin: z.string().min(4).max(8) }).parse(input))
  .handler(async ({ data, context }) => {
    const { attemptPin } = await import("@/lib/pin-attempt.server");
    const result = await attemptPin(context.userId, data.pin);
    return result.ok ? { ok: true as const } : { ok: false as const, locked: result.locked };
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

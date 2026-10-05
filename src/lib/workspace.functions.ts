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
  .inputValidator((input: unknown) =>
    z
      .object({
        code: z.string().min(6).max(40),
        slug: z.string().min(3).max(40),
        displayName: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const slug = normalizeSlug(data.slug);
    const problem = validateSlug(slug);
    if (problem) return { ok: false as const, error: problem };

    const existing = await context.supabase
      .from("workspaces")
      .select("id, slug")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (existing.data) return { ok: true as const, slug: existing.data.slug };

    const code = data.code.trim().toUpperCase();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: codeRow } = await supabaseAdmin
      .from("activation_codes")
      .select("id, status")
      .eq("code", code)
      .maybeSingle();
    if (!codeRow) return { ok: false as const, error: "code_unknown" };
    if (codeRow.status !== "unused") return { ok: false as const, error: "code_used" };

    const { data: created, error: createError } = await supabaseAdmin
      .from("workspaces")
      .insert({ owner_id: context.userId, slug, display_name: data.displayName || null })
      .select("id, slug")
      .single();
    if (createError) {
      const taken = createError.message.includes("workspaces_slug_key");
      return { ok: false as const, error: taken ? "taken" : "format" };
    }

    const claim = await supabaseAdmin
      .from("activation_codes")
      .update({
        status: "used",
        used_by: context.userId,
        used_at: new Date().toISOString(),
        workspace_id: created.id,
      })
      .eq("id", codeRow.id)
      .eq("status", "unused")
      .select("id")
      .maybeSingle();

    if (!claim.data) {
      await supabaseAdmin.from("workspaces").delete().eq("id", created.id);
      return { ok: false as const, error: "code_used" };
    }

    for (const table of ["children", "entries", "tasks", "documents"] as const) {
      await supabaseAdmin
        .from(table)
        .update({ workspace_id: created.id })
        .eq("user_id", context.userId)
        .is("workspace_id", null);
    }

    return { ok: true as const, slug: created.slug };
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
    const { data: row, error } = await context.supabase
      .from("workspaces")
      .select("pin_hash, pin_failed_attempts, pin_locked_until")
      .eq("owner_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!row?.pin_hash) return { ok: true as const };
    if (row.pin_locked_until && new Date(row.pin_locked_until) > new Date()) {
      return { ok: false as const, locked: true as const };
    }
    const { verifyPin } = await import("@/lib/pin.server");
    const ok = await verifyPin(data.pin, row.pin_hash);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (ok) {
      await supabaseAdmin
        .from("workspaces")
        .update({ pin_failed_attempts: 0, pin_locked_until: null })
        .eq("owner_id", context.userId);
      return { ok: true as const };
    }
    const attempts = row.pin_failed_attempts + 1;
    const lock = attempts >= 5;
    await supabaseAdmin
      .from("workspaces")
      .update({
        pin_failed_attempts: lock ? 0 : attempts,
        pin_locked_until: lock ? new Date(Date.now() + 15 * 60 * 1000).toISOString() : null,
      })
      .eq("owner_id", context.userId);
    return { ok: false as const, locked: lock };
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

// Test purchase: issues an activation code without charging. Replace with a real
// checkout + verified payment webhook once payments are enabled for the workspace.
export const createTestPurchase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateActivationCode } = await import("@/lib/pin.server");
    const { data: existing } = await supabaseAdmin
      .from("activation_codes")
      .select("code")
      .eq("provider", "test")
      .eq("provider_reference", context.userId)
      .eq("status", "unused")
      .maybeSingle();
    if (existing) return { code: existing.code };
    const code = generateActivationCode();
    const email = (context.claims as { email?: string }).email ?? null;
    const { error } = await supabaseAdmin.from("activation_codes").insert({
      code,
      email,
      provider: "test",
      provider_reference: context.userId,
      amount_cents: 0,
      currency: "SEK",
    });
    if (error) throw new Error(error.message);
    return { code };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Family sharing (migration 0009). Invitations and memberships are written only here, with the
// server client, after checking who is asking. The database rules then decide what each member
// may read or change.

export type FamilyRole = "editor" | "viewer";

/** People besides the owner, counting open invitations, so a link cannot be spread to anyone. */
export const MAX_MEMBERS = 6;
const INVITE_DAYS = 7;

const Role = z.enum(["editor", "viewer"]);
const Label = z.string().trim().max(60).optional();
const Token = z.string().regex(/^[0-9a-f]{64}$/);

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function admin() {
  return (await import("@/integrations/supabase/client.server")).supabaseAdmin;
}

/** The caller's own workspace, which only its owner may share. */
async function ownWorkspace(userId: string) {
  const db = await admin();
  const { data } = await db.from("workspaces").select("id, display_name, slug").eq("owner_id", userId).maybeSingle();
  return data;
}

export type FamilyOverview = {
  /** Whether sharing is set up in the database yet. */
  ready: boolean;
  owned: {
    members: { userId: string; label: string | null; role: FamilyRole; since: string }[];
    invites: { id: string; label: string | null; role: FamilyRole; expiresAt: string }[];
  } | null;
  joined: { workspaceId: string; ownerId: string; name: string; role: FamilyRole; active: boolean }[];
};

export const getFamily = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FamilyOverview> => {
    const joined = await context.supabase.rpc("my_families");
    if (joined.error) return { ready: false, owned: null, joined: [] };

    const workspace = await ownWorkspace(context.userId);
    let owned: FamilyOverview["owned"] = null;
    if (workspace) {
      const db = await admin();
      const [members, invites] = await Promise.all([
        db.from("workspace_members").select("user_id, label, role, created_at").eq("workspace_id", workspace.id).order("created_at"),
        db
          .from("workspace_invites")
          .select("id, label, role, expires_at")
          .eq("workspace_id", workspace.id)
          .is("used_at", null)
          .gt("expires_at", new Date().toISOString())
          .order("created_at"),
      ]);
      owned = {
        members: (members.data ?? []).map((m) => ({ userId: m.user_id, label: m.label, role: m.role as FamilyRole, since: m.created_at })),
        invites: (invites.data ?? []).map((i) => ({ id: i.id, label: i.label, role: i.role as FamilyRole, expiresAt: i.expires_at })),
      };
    }
    return {
      ready: true,
      owned,
      joined: (joined.data ?? []).map((f) => ({
        workspaceId: f.workspace_id,
        ownerId: f.owner_id,
        name: f.family_name,
        role: f.role as FamilyRole,
        active: f.active,
      })),
    };
  });

/** Creates a single-use link. Returns the secret once; only its hash is kept. */
export const createInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ role: Role, label: Label }).parse(input))
  .handler(async ({ data, context }) => {
    const workspace = await ownWorkspace(context.userId);
    if (!workspace) throw new Error("Skapa din egen familjesida först.");
    const db = await admin();
    const [members, invites] = await Promise.all([
      db.from("workspace_members").select("user_id", { count: "exact", head: true }).eq("workspace_id", workspace.id),
      db
        .from("workspace_invites")
        .select("id", { count: "exact", head: true })
        .eq("workspace_id", workspace.id)
        .is("used_at", null)
        .gt("expires_at", new Date().toISOString()),
    ]);
    if ((members.count ?? 0) + (invites.count ?? 0) >= MAX_MEMBERS) {
      throw new Error(`Du kan dela med upp till ${MAX_MEMBERS} personer. Ta bort någon eller en inbjudan först.`);
    }
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await db.from("workspace_invites").insert({
      workspace_id: workspace.id,
      token_hash: await sha256(token),
      role: data.role,
      label: data.label || null,
      expires_at: new Date(Date.now() + INVITE_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    });
    if (error) throw new Error("Inbjudan kunde inte skapas. Försök igen.");
    return { token };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const workspace = await ownWorkspace(context.userId);
    if (!workspace) throw new Error("Ingen familjesida.");
    const db = await admin();
    await db.from("workspace_invites").delete().eq("id", data.id).eq("workspace_id", workspace.id);
    return { ok: true as const };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const workspace = await ownWorkspace(context.userId);
    if (!workspace) throw new Error("Ingen familjesida.");
    const db = await admin();
    await db.from("workspace_members").delete().eq("workspace_id", workspace.id).eq("user_id", data.userId);
    return { ok: true as const };
  });

export const changeMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ userId: z.string().uuid(), role: Role }).parse(input))
  .handler(async ({ data, context }) => {
    const workspace = await ownWorkspace(context.userId);
    if (!workspace) throw new Error("Ingen familjesida.");
    const db = await admin();
    await db.from("workspace_members").update({ role: data.role }).eq("workspace_id", workspace.id).eq("user_id", data.userId);
    return { ok: true as const };
  });

/** A member leaves a family they joined. Nothing in the family folder is removed. */
export const leaveFamily = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ workspaceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const db = await admin();
    await db.from("workspace_members").delete().eq("workspace_id", data.workspaceId).eq("user_id", context.userId);
    return { ok: true as const };
  });

type InviteLookup =
  | { status: "ok"; family: string; role: FamilyRole; label: string | null }
  | { status: "invalid" | "own" | "member" };

async function findInvite(token: string, userId: string) {
  const db = await admin();
  const { data: invite } = await db
    .from("workspace_invites")
    .select("id, workspace_id, role, label, expires_at, used_at")
    .eq("token_hash", await sha256(token))
    .maybeSingle();
  if (!invite || invite.used_at || new Date(invite.expires_at) <= new Date()) return { invite: null, lookup: { status: "invalid" } as InviteLookup };
  const { data: workspace } = await db
    .from("workspaces")
    .select("owner_id, display_name, slug")
    .eq("id", invite.workspace_id)
    .maybeSingle();
  if (!workspace) return { invite: null, lookup: { status: "invalid" } as InviteLookup };
  if (workspace.owner_id === userId) return { invite: null, lookup: { status: "own" } as InviteLookup };
  const { data: existing } = await db
    .from("workspace_members")
    .select("user_id")
    .eq("workspace_id", invite.workspace_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (existing) return { invite: null, lookup: { status: "member" } as InviteLookup };
  return {
    invite,
    lookup: { status: "ok", family: workspace.display_name || workspace.slug, role: invite.role as FamilyRole, label: invite.label } as InviteLookup,
  };
}

/** What the invitation is for, shown before the person accepts. */
export const previewInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: Token }).parse(input))
  .handler(async ({ data, context }) => (await findInvite(data.token, context.userId)).lookup);

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ token: Token }).parse(input))
  .handler(async ({ data, context }) => {
    const { invite, lookup } = await findInvite(data.token, context.userId);
    if (!invite) return lookup;
    const db = await admin();
    // Claim the link first, so two people cannot both use it.
    const claimed = await db
      .from("workspace_invites")
      .update({ used_at: new Date().toISOString(), used_by: context.userId })
      .eq("id", invite.id)
      .is("used_at", null)
      .select("id");
    if (claimed.error || !claimed.data?.length) return { status: "invalid" } as InviteLookup;
    const { error } = await db
      .from("workspace_members")
      .insert({ workspace_id: invite.workspace_id, user_id: context.userId, role: invite.role, label: invite.label });
    if (error) throw new Error("Det gick inte att gå med. Be om en ny inbjudan.");
    return lookup;
  });

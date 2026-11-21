import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { supabase } from "@/integrations/supabase/client";
import { getFamily, type FamilyRole } from "@/lib/family.functions";

export type FolderRole = "owner" | FamilyRole;

/** Who the signed-in parent shares with, and which families they have joined. */
export function useFamily() {
  const fetchFamily = useServerFn(getFamily);
  return useQuery({ queryKey: ["family"], queryFn: () => fetchFamily(), staleTime: 60_000 });
}

/** The signed-in user's id, for telling one's own folders from shared ones. */
export function useMyId() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: Infinity,
  });
}

/**
 * What the signed-in user may do with a folder owned by `ownerId`. The database enforces the same
 * rule; this only decides which buttons to show.
 */
export function useFolderRole(ownerId: string | null | undefined): { role: FolderRole | null; family: string | null } {
  const me = useMyId();
  const family = useFamily();
  if (!ownerId || me.data === undefined) return { role: null, family: null };
  if (ownerId === me.data) return { role: "owner", family: null };
  const joined = family.data?.joined.find((f) => f.ownerId === ownerId);
  return { role: joined?.role ?? null, family: joined?.name ?? null };
}

export const canEdit = (role: FolderRole | null) => role === "owner" || role === "editor";

/** Kept while someone with an invitation link signs up or in, also across Google's redirect. */
export const PENDING_INVITE_KEY = "barnmappen.invite";

/** Where to send someone who has just signed in. */
export function afterSignIn(): { to: "/fraga" } | { to: "/inbjudan/$token"; params: { token: string } } {
  try {
    const token = localStorage.getItem(PENDING_INVITE_KEY);
    if (token && /^[0-9a-f]{64}$/.test(token)) return { to: "/inbjudan/$token", params: { token } };
  } catch {
    // Storage may be blocked; the invitation link still works when opened again.
  }
  return { to: "/fraga" };
}

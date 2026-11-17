import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export type ChildRow = Tables<"children">;

/** The signed-in family's children, oldest folder first. One cache entry shared by every page. */
export function useChildren(enabled = true) {
  return useQuery({
    queryKey: ["children"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });
}

/** "Helenas", "Marcus", "Helena's": the name as the owner of something. */
export function possessive(name: string, lang: "sv" | "en") {
  const trimmed = name.trim();
  if (lang === "en") return /s$/i.test(trimmed) ? `${trimmed}'` : `${trimmed}'s`;
  return /[sxz]$/i.test(trimmed) ? trimmed : `${trimmed}s`;
}

import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FolderHeart, LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PrefToggles } from "@/components/PrefToggles";
import { supabase } from "@/integrations/supabase/client";
import { usePrefs } from "@/lib/prefs";

export function AppHeader() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = usePrefs();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="border-b border-border bg-card/70 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link to="/barn" className="flex items-center gap-2">
          <FolderHeart className="size-5 text-accent" aria-hidden />
          <span className="font-display text-xl">{t("app.name")}</span>
        </Link>
        <div className="flex items-center gap-1">
          <PrefToggles />
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="size-4" aria-hidden />
            {t("nav.signOut")}
          </Button>
        </div>
      </div>
    </header>
  );
}

import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { FolderOpen, House, LogOut, Settings, Sparkles } from "lucide-react";
import { lockWorkspace } from "@/components/PrivateGate";

import { Brand } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { PrefToggles } from "@/components/PrefToggles";
import { supabase } from "@/integrations/supabase/client";
import { usePrefs } from "@/lib/prefs";

const active =
  "data-[status=active]:bg-[var(--glass-hover)] data-[status=active]:text-foreground data-[status=active]:shadow-[0_1px_2px_oklch(0_0_0/0.08)] data-[status=active]:[&_svg]:text-accent";

// Desktop: labelled links inside the floating bar.
const navLink = `pressable inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium text-muted-foreground hover:bg-foreground/6 hover:text-foreground [&_svg]:size-4 [&_svg]:transition-transform [&_svg]:duration-200 [&_svg]:ease-out hover:[&_svg]:scale-115 ${active}`;

// Phone: a tab bar within thumb reach, like an installed app.
const tabLink = `pressable flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[11px] font-medium text-muted-foreground [&_svg]:size-5 ${active}`;

export function AppHeader() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, lang } = usePrefs();
  const sv = lang === "sv";

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    lockWorkspace();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  // "/" would otherwise count as active on every page, since every path starts with it.
  const items = [
    { to: "/", label: t("nav.home"), icon: House, exact: true },
    { to: "/fraga", label: t("nav.ask"), icon: Sparkles, exact: false },
    { to: "/barn", label: t("nav.myChildren"), icon: FolderOpen, exact: false },
  ] as const;
  const settings = t("nav.settings");

  return (
    <>
      <header className="topbar px-3 pt-3 sm:px-6">
        <div className="glass mx-auto flex h-14 max-w-5xl items-center justify-between gap-1 rounded-full pr-2 pl-3">
          <Brand compact />
          <nav className="hidden items-center gap-1 sm:flex" aria-label={sv ? "Huvudmeny" : "Main"}>
            {items.map((item) => (
              <Link key={item.to} to={item.to} activeOptions={{ exact: item.exact }} className={navLink}>
                <item.icon aria-hidden />
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center">
            <PrefToggles />
            <Button variant="ghost" size="icon" asChild className={`hidden sm:inline-flex ${active}`}>
              <Link to="/installningar" aria-label={settings} title={settings}>
                <Settings aria-hidden />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label={t("nav.signOut")} title={t("nav.signOut")}>
              <LogOut aria-hidden />
            </Button>
          </div>
        </div>
      </header>

      <nav className="tabbar fixed inset-x-3 bottom-3 z-30 sm:hidden" aria-label={sv ? "Huvudmeny" : "Main"}>
        <div className="surface-strong mx-auto flex max-w-md gap-1 rounded-full p-1.5">
          {items.map((item) => (
            <Link key={item.to} to={item.to} activeOptions={{ exact: item.exact }} className={tabLink}>
              <item.icon aria-hidden />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          ))}
          <Link to="/installningar" className={tabLink}>
            <Settings aria-hidden />
            <span className="max-w-full truncate">{settings}</span>
          </Link>
        </div>
      </nav>
    </>
  );
}

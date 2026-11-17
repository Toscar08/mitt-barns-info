import { Link } from "@tanstack/react-router";
import { FolderHeart, House } from "lucide-react";

import { PrefToggles } from "@/components/PrefToggles";
import { Button } from "@/components/ui/button";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

/** The mark always leads back to the start page. `compact` drops the name where the bar is tight. */
export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="group pressable flex items-center gap-2.5 rounded-full" aria-label="Barnmappen">
      <span className="grid size-8 place-content-center rounded-full bg-primary text-primary-foreground shadow-[inset_0_1px_0_oklch(1_0_0/0.3)] transition-transform duration-200 ease-out group-hover:scale-110 group-hover:-rotate-6">
        <FolderHeart className="size-4" aria-hidden />
      </span>
      <span className={cn("text-[17px] font-semibold tracking-tight", compact && "sm:max-md:hidden")}>
        Barnmappen
      </span>
    </Link>
  );
}

/** Floating glass bar used on the public pages. */
export function PublicHeader({ children }: { children?: React.ReactNode }) {
  const { t } = usePrefs();
  return (
    <header className="topbar px-3 pt-3 sm:px-6">
      <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 rounded-full pr-2 pl-3">
        <Brand />
        <div className="flex items-center gap-1">
          <Button asChild variant="ghost" size="sm" className="max-sm:size-10 max-sm:px-0">
            <Link to="/" aria-label={t("nav.home")} title={t("nav.home")}>
              <House aria-hidden />
              <span className="max-sm:hidden">{t("nav.home")}</span>
            </Link>
          </Button>
          <PrefToggles />
          {children}
        </div>
      </div>
    </header>
  );
}

/** Shown while a private page is checking the session. */
export function Loader({ label }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4" role="status">
      <span className="grid size-14 animate-breathe place-content-center rounded-full bg-primary text-primary-foreground">
        <FolderHeart className="size-6" aria-hidden />
      </span>
      <span className={label ? "text-sm text-muted-foreground" : "sr-only"}>{label ?? "Laddar…"}</span>
    </div>
  );
}

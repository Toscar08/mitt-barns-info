import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePrefs } from "@/lib/prefs";

export function PrefToggles() {
  const { lang, theme, toggleLang, toggleTheme, t } = usePrefs();

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={toggleLang}
        aria-label={t("lang.switch")}
        title={t("lang.switch")}
      >
        {lang === "sv" ? "SV" : "EN"}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleTheme}
        aria-label={theme === "dark" ? t("theme.light") : t("theme.dark")}
        title={theme === "dark" ? t("theme.light") : t("theme.dark")}
      >
        {theme === "dark" ? (
          <Sun className="size-4" aria-hidden />
        ) : (
          <Moon className="size-4" aria-hidden />
        )}
      </Button>
    </div>
  );
}

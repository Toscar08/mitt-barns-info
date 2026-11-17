import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";
import { usePrefs } from "@/lib/prefs";

export function PrefToggles() {
  const { lang, theme, toggleLang, toggleTheme, t } = usePrefs();

  return (
    <div className="flex items-center">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleLang}
        aria-label={t("lang.switch")}
        title={t("lang.switch")}
        className="text-[13px] font-semibold tracking-wide"
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
        {theme === "dark" ? <Sun aria-hidden /> : <Moon aria-hidden />}
      </Button>
    </div>
  );
}

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/aterstall-losenord")({
  head: () => ({
    meta: [
      { title: "Nytt lösenord – Barnmappen" },
      { name: "description", content: "Välj ett nytt lösenord för ditt Barnmappen-konto." },
      { property: "og:title", content: "Nytt lösenord – Barnmappen" },
      { property: "og:description", content: "Välj ett nytt lösenord för ditt konto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ResetPage,
});

function ResetPage() {
  const navigate = useNavigate();
  const { t } = usePrefs();
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const isRecovery = window.location.hash.includes("type=recovery");
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getSession().then(({ data: s }) => {
      if (s.session && isRecovery) setReady(true);
      setChecked(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(t("reset.done"));
    navigate({ to: "/fraga" });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="surface rise w-full max-w-md p-6 sm:p-8">
        <h1 className="text-3xl">{t("reset.title")}</h1>
        {ready ? (
          <form onSubmit={save} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pw">{t("auth.password")}</Label>
              <Input
                id="pw"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? t("auth.loading") : t("reset.save")}
            </Button>
          </form>
        ) : checked ? (
          <p className="mt-6 text-sm text-muted-foreground">{t("reset.invalid")}</p>
        ) : null}
      </div>
    </main>
  );
}

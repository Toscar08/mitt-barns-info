import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PrefToggles } from "@/components/PrefToggles";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Logga in – Barnmappen" },
      {
        name: "description",
        content: "Logga in eller skapa ett konto för att komma åt dina barns digitala mappar.",
      },
      { property: "og:title", content: "Logga in – Barnmappen" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      {
        property: "og:description",
        content: "Logga in för att komma åt dina barns digitala mappar.",
      },
    ],
  }),
  component: AuthPage,
});

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

function AuthPage() {
  const navigate = useNavigate();
  const { t } = usePrefs();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentEmail, setSentEmail] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/fraga", replace: true });
    });
  }, [navigate]);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin + "/barn" },
        });
        if (error) throw error;
        if (!data.session) {
          setSentEmail(true);
          return;
        }
        navigate({ to: "/fraga" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/fraga" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("auth.error"));
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    // Google sends the browser back to the start page. This note lets it carry on into the app.
    sessionStorage.setItem("barnmappen.afterAuth", "1");
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      sessionStorage.removeItem("barnmappen.afterAuth");
      toast.error(t("auth.googleError"));
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/fraga" });
  }

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="rise w-full max-w-md">
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="pressable rounded-full px-3 py-2 text-sm text-muted-foreground hover:text-foreground">
            {t("auth.back")}
          </Link>
          <PrefToggles />
        </div>
        <div className="surface p-6 sm:p-8">
          <h1 className="text-3xl">{mode === "signin" ? t("auth.welcome") : t("auth.create")}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{t("auth.privacy")}</p>

          {sentEmail ? (
            <p className="well mt-6 p-4 text-sm">
              {t("auth.sentEmail")}
            </p>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="lg"
                className="mt-6 w-full"
                onClick={handleGoogle}
              >
                <GoogleMark />
                {t("auth.google")}
              </Button>

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                {t("auth.or")}
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t("auth.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">{t("auth.password")}</Label>
                  <Input
                    id="password"
                    type="password"
                    required
                    minLength={6}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <Button type="submit" size="lg" className="w-full" disabled={loading}>
                  {loading
                    ? t("auth.loading")
                    : mode === "signin"
                      ? t("auth.signIn")
                      : t("auth.signUp")}
                </Button>
              </form>

              {mode === "signin" && (
                <button
                  type="button"
                  className="mt-4 w-full rounded-full py-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  onClick={async () => {
                    if (!email) {
                      toast.error(t("auth.forgotNeedEmail"));
                      return;
                    }
                    await supabase.auth.resetPasswordForEmail(email, {
                      redirectTo: window.location.origin + "/aterstall-losenord",
                    });
                    toast.success(t("auth.forgotSent"));
                  }}
                >
                  {t("auth.forgot")}
                </button>
              )}
              <button
                type="button"
                className="mt-1 w-full rounded-full py-2 text-sm font-medium text-accent underline-offset-4 hover:underline"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin" ? t("auth.toSignUp") : t("auth.toSignIn")}
              </button>
            </>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4" aria-hidden />
          {t("auth.encrypted")}
        </p>
      </div>
    </main>
  );
}

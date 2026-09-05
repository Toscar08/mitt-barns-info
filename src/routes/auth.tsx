import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Logga in – Barnmappen" },
      {
        name: "description",
        content: "Logga in eller skapa ett konto för att komma åt dina barns digitala mappar.",
      },
      { property: "og:title", content: "Logga in – Barnmappen" },
      {
        property: "og:description",
        content: "Logga in för att komma åt dina barns digitala mappar.",
      },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [sentEmail, setSentEmail] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/barn", replace: true });
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
        navigate({ to: "/barn" });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/barn" });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Något gick fel");
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogle() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Kunde inte logga in med Google");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/barn" });
  }

  return (
    <main className="calm-bg flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 block text-center text-sm text-muted-foreground">
          ← Tillbaka
        </Link>
        <div className="surface p-8">
          <h1 className="text-3xl">
            {mode === "signin" ? "Välkommen tillbaka" : "Skapa ditt konto"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Din information är privat och bara du kommer åt den.
          </p>

          {sentEmail ? (
            <p className="mt-6 rounded-lg bg-secondary p-4 text-sm text-secondary-foreground">
              Vi har skickat ett bekräftelsemejl till {email}. Klicka på länken i mejlet för
              att aktivera ditt konto.
            </p>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                className="mt-6 w-full"
                onClick={handleGoogle}
              >
                Fortsätt med Google
              </Button>

              <div className="my-6 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                eller med e-post
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">E-post</Label>
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
                  <Label htmlFor="password">Lösenord</Label>
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
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading
                    ? "Ett ögonblick…"
                    : mode === "signin"
                      ? "Logga in"
                      : "Skapa konto"}
                </Button>
              </form>

              <button
                type="button"
                className="mt-5 w-full text-sm text-muted-foreground underline-offset-4 hover:underline"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              >
                {mode === "signin"
                  ? "Har du inget konto? Skapa ett"
                  : "Har du redan ett konto? Logga in"}
              </button>
            </>
          )}
        </div>

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4" aria-hidden />
          Krypterad överföring och privat lagring
        </p>
      </div>
    </main>
  );
}

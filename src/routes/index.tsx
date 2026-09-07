import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FolderHeart, HeartPulse, FileText, Sparkles, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PrefToggles } from "@/components/PrefToggles";
import { supabase } from "@/integrations/supabase/client";
import { usePrefs } from "@/lib/prefs";
import heroImage from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Barnmappen – allt om ditt barn på ett tryggt ställe" },
      {
        name: "description",
        content:
          "Skapa en personlig digital mapp för varje barn: personuppgifter, kontakter, kalender, dokument och egen information – med en AI-assistent som bara svarar utifrån mappen.",
      },
      { property: "og:title", content: "Barnmappen" },
      {
        property: "og:description",
        content:
          "En trygg digital mapp per barn med personuppgifter, kontakter, kalender, dokument och AI-assistent.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  const { t } = usePrefs();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setSignedIn(Boolean(session)),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  const features = [
    { icon: HeartPulse, title: t("landing.f1.title"), text: t("landing.f1.text") },
    { icon: FolderHeart, title: t("landing.f2.title"), text: t("landing.f2.text") },
    { icon: FileText, title: t("landing.f3.title"), text: t("landing.f3.text") },
    { icon: Sparkles, title: t("landing.f4.title"), text: t("landing.f4.text") },
  ];

  return (
    <div className="calm-bg min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 text-lg">
          <FolderHeart className="size-5 text-accent" aria-hidden />
          <span className="font-display text-xl">{t("app.name")}</span>
        </span>
        <div className="flex items-center gap-2">
          <PrefToggles />
          {signedIn ? (
            <Button asChild size="sm">
              <Link to="/barn">{t("nav.myChildren")}</Link>
            </Button>
          ) : (
            <Button asChild size="sm" variant="outline">
              <Link to="/auth">{t("nav.signIn")}</Link>
            </Button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="grid items-center gap-12 py-10 md:grid-cols-2 md:py-16">
          <div>
            <p className="text-sm tracking-wide text-accent uppercase">{t("landing.eyebrow")}</p>
            <h1 className="mt-4 text-5xl leading-[1.05] md:text-6xl">
              {t("landing.title1")}
              <br />
              {t("landing.title2")}
            </h1>
            <p className="mt-6 max-w-md text-base text-muted-foreground">{t("landing.lead")}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to={signedIn ? "/barn" : "/auth"}>
                  {signedIn ? t("landing.ctaIn") : t("landing.ctaOut")}
                </Link>
              </Button>
            </div>
            <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="size-4" aria-hidden />
              {t("landing.privacy")}
            </p>
          </div>
          <img
            src={heroImage}
            alt={t("landing.heroAlt")}
            width={1600}
            height={1104}
            className="rounded-3xl object-cover shadow-[var(--shadow-soft)]"
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((item) => (
            <article key={item.title} className="surface p-6">
              <item.icon className="size-5 text-accent" aria-hidden />
              <h2 className="mt-4 text-xl">{item.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{item.text}</p>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}

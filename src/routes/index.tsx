import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FolderHeart, HeartPulse, FileText, Sparkles, Lock } from "lucide-react";

import { SiteFooter } from "@/components/SiteFooter";
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
  const { t, lang } = usePrefs();

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
              {!signedIn && (
                <Button asChild size="lg" variant="outline">
                  <Link to="/kop">{lang === "sv" ? "Köp åtkomst" : "Buy access"}</Link>
                </Button>
              )}
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

        <section className="mt-20 grid gap-8 lg:grid-cols-2">
          <div>
            <h2 className="text-3xl">{lang === "sv" ? "Så fungerar det" : "How it works"}</h2>
            <ol className="mt-6 space-y-4 text-muted-foreground">
              {(lang === "sv"
                ? ["Köp åtkomst och få en aktiveringskod med QR-kod.", "Skapa konto och aktivera din sida med koden.", "Välj ett eget adressnamn, t.ex. /f/familj-a.", "Lägg till barn och samla allt – logga sedan in som vanligt."]
                : ["Buy access and get an activation code with QR code.", "Create an account and activate your site with the code.", "Pick your own address, e.g. /f/family-a.", "Add children and gather everything – then just sign in as usual."]
              ).map((step, i) => (
                <li key={step} className="flex gap-3">
                  <span className="font-display text-xl text-accent">{i + 1}</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>
          <div className="surface p-8">
            <h2 className="text-3xl">{lang === "sv" ? "Integritet och säkerhet" : "Privacy and security"}</h2>
            <p className="mt-4 text-sm text-muted-foreground">
              {lang === "sv"
                ? "Din sida kräver alltid inloggning, och du kan lägga till en PIN-kod. Varje familj ser bara sin egen information – det kontrolleras på servern, inte via hemliga länkar. Du kan exportera och återställa allt när du vill."
                : "Your site always requires sign-in, and you can add a PIN. Each family only sees its own information – checked on the server, not by secret links. Export and restore everything whenever you like."}
            </p>
            <p className="mt-6 font-display text-3xl">495 kr <span className="text-base text-muted-foreground">{lang === "sv" ? "/ år inkl. moms" : "/ year incl. VAT"}</span></p>
            <Button asChild className="mt-4">
              <Link to="/kop">{lang === "sv" ? "Köp åtkomst" : "Buy access"}</Link>
            </Button>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

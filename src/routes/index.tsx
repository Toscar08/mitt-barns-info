import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { FolderHeart, HeartPulse, FileText, ListChecks, Sparkles, Lock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import heroImage from "@/assets/hero.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Barnmappen – allt om ditt barn på ett tryggt ställe" },
      {
        name: "description",
        content:
          "Skapa en personlig digital mapp för varje barn: hälsa, dokument, anteckningar och uppgifter – med en AI-assistent som svarar på dina frågor.",
      },
      { property: "og:title", content: "Barnmappen" },
      {
        property: "og:description",
        content:
          "En trygg digital mapp per barn med hälsa, dokument, anteckningar, uppgifter och AI-assistent.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      setSignedIn(Boolean(session)),
    );
    return () => data.subscription.unsubscribe();
  }, []);

  return (
    <div className="calm-bg min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <span className="flex items-center gap-2 text-lg">
          <FolderHeart className="size-5 text-accent" aria-hidden />
          <span className="font-display text-xl">Barnmappen</span>
        </span>
        {signedIn ? (
          <Button asChild size="sm">
            <Link to="/barn">Mina barn</Link>
          </Button>
        ) : (
          <Button asChild size="sm" variant="outline">
            <Link to="/auth">Logga in</Link>
          </Button>
        )}
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="grid items-center gap-12 py-10 md:grid-cols-2 md:py-16">
          <div>
            <p className="text-sm tracking-wide text-accent uppercase">
              Privat · Säkert · Enkelt
            </p>
            <h1 className="mt-4 text-5xl leading-[1.05] md:text-6xl">
              Allt om ditt barn,
              <br />
              samlat på ett ställe.
            </h1>
            <p className="mt-6 max-w-md text-base text-muted-foreground">
              En egen digital mapp för varje barn – hälsa och basinfo, viktiga dokument,
              anteckningar och uppgifter. Fråga assistenten när du behöver svar snabbt.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to={signedIn ? "/barn" : "/auth"}>
                  {signedIn ? "Öppna mina mappar" : "Kom igång gratis"}
                </Link>
              </Button>
            </div>
            <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="size-4" aria-hidden />
              Bara du kommer åt din information. Exportera eller ta bort den när du vill.
            </p>
          </div>
          <img
            src={heroImage}
            alt="Barnkläder, små skor och ett dokument prydligt uppställda på ett ljust träbord"
            width={1600}
            height={1104}
            className="rounded-3xl object-cover shadow-[var(--shadow-soft)]"
          />
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              icon: HeartPulse,
              title: "Basinfo & hälsa",
              text: "Födelsedatum, allergier, mediciner, blodgrupp och vårdkontakter.",
            },
            {
              icon: FileText,
              title: "Dokument",
              text: "Intyg, betyg och kvitton uppladdade i barnets privata mapp.",
            },
            {
              icon: ListChecks,
              title: "Anteckningar & uppgifter",
              text: "Träningstider, kontakter och att-göra-listor du inte vill glömma.",
            },
            {
              icon: Sparkles,
              title: "AI-assistent",
              text: "”När börjar fotbollsträningen?” – svar direkt ur barnets mapp.",
            },
          ].map((item) => (
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

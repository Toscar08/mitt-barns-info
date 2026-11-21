import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, ChevronDown, FolderHeart, Lock, ShieldCheck, Sparkles } from "lucide-react";

import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { Brand } from "@/components/Brand";
import { PrefToggles } from "@/components/PrefToggles";
import { supabase } from "@/integrations/supabase/client";
import { afterSignIn } from "@/lib/family";
import { usePrefs } from "@/lib/prefs";
import heroImage from "@/assets/hero.webp";
import { kronor, PLANS, yearlyPerMonth } from "@/lib/pricing";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Barnmappen – ett tryggt hem för allt som rör ditt barn" },
      {
        name: "description",
        content:
          "Samla personuppgifter, kontakter, kalender, dokument och egna anteckningar för varje barn – privat, skyddat och alltid till hands.",
      },
      { property: "og:title", content: "Barnmappen – ett tryggt hem för ditt barns information" },
      {
        property: "og:description",
        content: "En privat digital mapp per barn. Du äger informationen, kan exportera allt och radera när du vill.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [signedIn, setSignedIn] = useState(false);
  const navigate = useNavigate();
  const { t, lang } = usePrefs();
  const L = (sv: string, en: string) => (lang === "sv" ? sv : en);

  useEffect(() => {
    // Google sign-in lands here. If that is why we are on this page, carry on into the app
    // instead of leaving a freshly signed-in parent on the sales page.
    const settle = (session: unknown) => {
      setSignedIn(Boolean(session));
      if (session && sessionStorage.getItem("barnmappen.afterAuth")) {
        sessionStorage.removeItem("barnmappen.afterAuth");
        void navigate({ ...afterSignIn(), replace: true });
      }
    };
    supabase.auth.getSession().then(({ data }) => settle(data.session));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => settle(s));
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  const cta = signedIn ? t("landing.ctaIn") : L(`Skaffa Barnmappen – från ${yearlyPerMonth} kr/mån`, `Get Barnmappen – from ${yearlyPerMonth} kr/mo`);
  const ctaTo = signedIn ? "/barn" : "/kop";

  const promises = [
    L("Avsluta när du vill", "Cancel anytime"),
    L("Ingen reklam, ingen såld data", "No ads, no data sold"),
    L("Exportera eller radera när du vill", "Export or delete anytime"),
  ];

  const pillars = [
    {
      icon: FolderHeart,
      title: L("En mapp per barn", "One folder per child"),
      text: L("Allt har sin plats, så du hittar det på några sekunder.", "Everything has its place, so you find it in seconds."),
      chips: [L("Allergier", "Allergies"), L("Pass", "Passport"), L("Storlekar", "Sizes"), L("Kontakter", "Contacts"), L("Kalender", "Calendar"), L("Dokument", "Documents")],
    },
    {
      icon: Sparkles,
      title: L("Fråga i stället för att leta", "Ask instead of searching"),
      text: L("Assistenten svarar bara utifrån det du själv skrivit in. Den gissar aldrig.", "The assistant answers only from what you entered. It never guesses."),
      chips: [L("”Vilken skostorlek?”", "“What shoe size?”"), L("”När går passet ut?”", "“When does the passport expire?”")],
    },
    {
      icon: ShieldCheck,
      title: L("Privat på riktigt", "Truly private"),
      text: L("Bara ditt konto kommer åt er sida. Lägg till PIN-kod för extra skydd.", "Only your account can reach your page. Add a PIN for extra protection."),
      chips: [L("Inloggning", "Sign-in"), L("PIN-lås", "PIN lock"), L("Krypterad överföring", "Encrypted transfer")],
    },
  ];

  const included = [
    L("Egen privat adress för familjen", "Your family's own private address"),
    L("Obegränsat antal barn", "Unlimited children"),
    L("Dela med familj och barnvakt", "Share with family and babysitter"),
    L("Dokument upp till 25 MB per fil", "Documents up to 25 MB each"),
    L("AI-assistent", "AI assistant"),
    L("Export och återställning", "Export and restore"),
    L("Installeras som app", "Installs as an app"),
  ];

  const faq = [
    [L("Vem kan se mitt barns information?", "Who can see my child's information?"), L("Bara den som loggar in på ert konto. Andra familjer kan aldrig se er sida, inte ens om de känner till adressen.", "Only whoever signs in to your account. Other families can never see your page, even if they know the address.")],
    [L("Vad gör AI-assistenten med uppgifterna?", "What does the AI do with my data?"), L("Den läser bara det du själv skrivit i barnets mapp när du ställer en fråga. Den ersätter inte vård – vid akut fara ring 112, för råd ring 1177.", "It only reads what you wrote in the child's folder when you ask. It does not replace healthcare – call 112 in emergencies.")],
    [L("Tillkommer några avgifter?", "Are there any other fees?"), L(`Nej. Du väljer ${kronor(PLANS.monthly.amount)} kr/mån eller ${kronor(PLANS.yearly.amount)} kr/år inkl. moms, och kan avsluta när du vill.`, `No. You choose ${kronor(PLANS.monthly.amount)} kr/month or ${kronor(PLANS.yearly.amount)} kr/year incl. VAT, and can cancel anytime.`)],
    [L("Kan jag ta med mig min information?", "Can I take my data with me?"), L("Ja. Exportera hela barnmappen som en fil och återställ den när du vill.", "Yes. Export the whole folder as a file and restore it whenever you like.")],
  ];

  return (
    <div className="min-h-dvh">
      <header className="topbar px-3 pt-3 sm:px-6">
        <div className="glass mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 rounded-full pr-2 pl-3">
          <Brand />
          <div className="flex items-center gap-1">
            <PrefToggles />
            {signedIn ? (
              <Button asChild size="sm"><Link to="/barn">{t("nav.myChildren")}</Link></Button>
            ) : (
              <>
                <Button asChild size="sm" variant="ghost"><Link to="/auth">{t("nav.signIn")}</Link></Button>
                <Button asChild size="sm" variant="pop" className="hidden sm:inline-flex"><Link to="/kop">{L("Köp nu", "Buy now")}</Link></Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-8 sm:px-6">
        <section className="grid items-center gap-12 py-12 md:grid-cols-[1.05fr_1fr] md:py-20">
          <div>
            <p className="glass rise inline-flex items-center gap-2 rounded-full py-1.5 pr-4 pl-2 text-sm font-medium">
              <span className="grid size-6 place-content-center rounded-full bg-pop text-pop-foreground"><Lock className="size-3.5" strokeWidth={2.5} aria-hidden /></span>
              {L("Privat mapp för varje barn", "A private folder for every child")}
            </p>
            <h1 className="rise mt-6 text-[2.6rem] leading-[1.04] [--i:1] sm:text-6xl">
              {L("Allt om ditt barn.", "Everything about your child.")}
              <span className="block text-accent">{L("På ett tryggt ställe.", "In one safe place.")}</span>
            </h1>
            <p className="rise mt-6 max-w-md text-lg text-muted-foreground [--i:2]">
              {L(
                "Allergier, pass, storlekar och viktiga kontakter – samlat, skyddat och framme på tre sekunder.",
                "Allergies, passports, sizes and key contacts – gathered, protected and ready in three seconds.",
              )}
            </p>
            <div className="rise mt-8 flex flex-wrap items-center gap-3 [--i:3]">
              <Button asChild size="lg" variant="pop">
                <Link to={ctaTo}>{cta}<ArrowRight aria-hidden /></Link>
              </Button>
              <Button asChild size="lg" variant="ghost"><a href="#ingar">{L("Se vad som ingår", "See what's included")}</a></Button>
            </div>
            <ul className="rise mt-8 flex flex-col gap-2 text-sm text-muted-foreground [--i:4] sm:flex-row sm:flex-wrap sm:gap-x-6">
              {promises.map((p) => (
                <li key={p} className="flex items-center gap-2"><Check className="size-4 text-accent" strokeWidth={2.5} aria-hidden />{p}</li>
              ))}
            </ul>
          </div>

          <div className="rise relative [--i:2]">
            <div className="surface p-2">
              <img src={heroImage} alt={t("landing.heroAlt")} width={1200} height={800} decoding="async" fetchPriority="high" className="rounded-[1.1rem] object-cover" />
            </div>
            <div className="surface-strong float-slow absolute -bottom-6 -left-2 space-y-2 rounded-3xl p-4 text-sm whitespace-nowrap sm:-left-8" aria-hidden>
              <p className="ml-auto w-fit rounded-2xl rounded-br-md bg-primary px-3.5 py-1.5 text-primary-foreground">{L("Vilken skostorlek har Marcus?", "What's Marcus's shoe size?")}</p>
              <p className="flex w-fit items-center gap-2 rounded-2xl rounded-bl-md bg-foreground/8 px-3.5 py-1.5"><Sparkles className="size-3.5 text-accent" />{L("Storlek 31.", "Size 31.")}</p>
            </div>
          </div>
        </section>

        <section id="funktioner" className="mt-16 scroll-mt-24 md:mt-20">
          <h2 className="max-w-2xl text-3xl md:text-4xl">{L("Slut på lappar, SMS-trådar och byrålådor.", "No more notes, text threads and drawers.")}</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {pillars.map((p, i) => (
              <article key={p.title} className="group surface liftable rise p-7" style={{ "--i": i } as React.CSSProperties}>
                <span className="grid size-11 place-content-center rounded-2xl bg-accent/12 text-accent transition-[background-color,color,transform] duration-200 ease-out group-hover:-rotate-6 group-hover:scale-110 group-hover:bg-accent group-hover:text-accent-foreground">
                  <p.icon className="size-5" aria-hidden />
                </span>
                <h3 className="mt-5 text-xl">{p.title}</h3>
                <p className="mt-2 text-muted-foreground">{p.text}</p>
                <ul className="mt-5 flex flex-wrap gap-2">
                  {p.chips.map((c) => (
                    <li key={c} className="rounded-full bg-foreground/6 px-3 py-1 text-[13px] transition-colors duration-200 ease-out hover:bg-accent/15 hover:text-accent">{c}</li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </section>

        <section id="ingar" className="surface mt-16 scroll-mt-24 overflow-hidden p-7 md:mt-20 md:p-12">
          <div className="grid gap-10 md:grid-cols-[1fr_1.1fr] md:items-center">
            <div>
              <p className="text-sm font-medium text-accent">{L("Ett enkelt pris", "One simple price")}</p>
              <p className="mt-3 text-6xl font-semibold tracking-tight tabular-nums md:text-7xl">{yearlyPerMonth} kr<span className="text-2xl font-medium text-muted-foreground md:text-3xl">{L("/mån", "/mo")}</span></p>
              <p className="mt-2 text-muted-foreground">{L(`Vid årsbetalning, ${kronor(PLANS.yearly.amount)} kr/år. Eller ${kronor(PLANS.monthly.amount)} kr/mån. Inkl. moms, avsluta när du vill.`, `Billed yearly at ${kronor(PLANS.yearly.amount)} kr. Or ${kronor(PLANS.monthly.amount)} kr monthly. Incl. VAT, cancel anytime.`)}</p>
              <Button asChild size="lg" variant="pop" className="mt-8 w-full sm:w-auto">
                <Link to={ctaTo}>{signedIn ? t("landing.ctaIn") : L("Köp Barnmappen", "Buy Barnmappen")}<ArrowRight aria-hidden /></Link>
              </Button>
              <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                <Lock className="size-3.5" aria-hidden />
                {L("Säker betalning via Stripe. Åtkomsten öppnas direkt.", "Secure payment via Stripe. Access opens right away.")}
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {included.map((f) => (
                <li key={f} className="group/f row flex items-center gap-3 rounded-2xl border border-[var(--glass-edge)] bg-[var(--glass-field)] px-4 py-3.5 text-[15px]">
                  <span className="grid size-6 shrink-0 place-content-center rounded-full bg-accent/15 text-accent transition-[background-color,color,transform] duration-200 ease-out group-hover/f:scale-110 group-hover/f:bg-accent group-hover/f:text-accent-foreground"><Check className="size-3.5" strokeWidth={3} aria-hidden /></span>
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="faq" className="mx-auto mt-16 max-w-3xl scroll-mt-24 md:mt-20">
          <h2 className="text-center text-3xl md:text-4xl">{L("Vanliga frågor", "Common questions")}</h2>
          <div className="mt-8 space-y-3">
            {faq.map(([q, a]) => (
              <details key={q} className="surface group px-6 py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-medium [&::-webkit-details-marker]:hidden">
                  {q}
                  <span className="grid size-8 shrink-0 place-content-center rounded-full bg-foreground/6 transition-[background-color,color] duration-200 ease-out group-hover:bg-accent group-hover:text-accent-foreground">
                    <ChevronDown className="size-4 transition-transform duration-200 ease-out group-open:rotate-180" aria-hidden />
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
          <p className="mt-6 text-center text-sm text-muted-foreground">
            {L("Mer i vår ", "More in our ")}
            <Link to="/integritetspolicy" className="link-line text-foreground">{L("integritetspolicy", "privacy policy")}</Link>
            {L(" och våra ", " and ")}
            <Link to="/villkor" className="link-line text-foreground">{L("villkor", "terms")}</Link>.
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

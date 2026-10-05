import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  FolderHeart,
  Lock,
  User,
  Phone,
  CalendarDays,
  FileText,
  NotebookPen,
  ShieldCheck,
  Download,
  Trash2,
  EyeOff,
  Sparkles,
  ShoppingBag,
  Plane,
  PartyPopper,
  Smartphone,
  KeyRound,
  ChevronDown,
} from "lucide-react";

import { SiteFooter } from "@/components/SiteFooter";
import { Button } from "@/components/ui/button";
import { PrefToggles } from "@/components/PrefToggles";
import { supabase } from "@/integrations/supabase/client";
import { usePrefs } from "@/lib/prefs";
import heroImage from "@/assets/hero.jpg";

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
  const { t, lang } = usePrefs();
  const L = (sv: string, en: string) => (lang === "sv" ? sv : en);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSignedIn(Boolean(s)));
    return () => data.subscription.unsubscribe();
  }, []);

  const nav = [
    ["om", L("Vad är Barnmappen?", "What is it?")],
    ["omraden", L("De 5 områdena", "The 5 areas")],
    ["sakerhet", L("Säkerhet", "Security")],
    ["ai", L("AI-stödet", "AI helper")],
    ["steg", L("Så går det till", "How it works")],
    ["faq", L("Frågor & svar", "FAQ")],
  ];

  const moments = [
    { icon: ShoppingBag, title: L("I butiken", "In the shop"), text: L("”Vilken skostorlek var det nu igen?” – svaret finns i mobilen.", "“What shoe size was it?” – the answer is on your phone.") },
    { icon: Plane, title: L("När resan bokas", "Booking a trip"), text: L("Passnummer och giltighetsdatum på tre sekunder, utan att leta i byrålådan.", "Passport number and expiry in seconds, no drawer digging.") },
    { icon: PartyPopper, title: L("Inför kalas och förskola", "Parties & preschool"), text: L("Allergier, kontaktpersoner och särskilda behov – samlat och klart att dela muntligt.", "Allergies, contacts and special needs – gathered and ready.") },
  ];

  const areas = [
    { icon: User, title: L("Personuppgifter", "Personal details"), text: L("Grundfakta, hälsa, allergier, pass, skola, klass samt kläd- och skostorlek.", "Basics, health, allergies, passport, school, clothing and shoe size.") },
    { icon: Phone, title: L("Kontaktuppgifter", "Contacts"), text: L("BVC, vårdcentral, tandläkare, pedagoger och anhöriga.", "Child health clinic, doctors, dentist, teachers and relatives.") },
    { icon: CalendarDays, title: L("Kalender & aktiviteter", "Calendar & activities"), text: L("Träningstider, packlistor och återkommande händelser.", "Practice times, packing lists and recurring events.") },
    { icon: FileText, title: L("Dokument", "Documents"), text: L("Försäkringsbrev, vaccinationskort och intyg som PDF eller bild.", "Insurance letters, vaccination cards and certificates.") },
    { icon: NotebookPen, title: L("Egen information", "Your own notes"), text: L("Rutiner, matpreferenser och sådant bara ni i familjen vet.", "Routines, food preferences and family know-how.") },
  ];

  const trust = [
    { icon: EyeOff, title: L("Ingen reklam, ingen försäljning", "No ads, no selling"), text: L("Vi säljer aldrig information och visar ingen reklam.", "We never sell information and show no ads.") },
    { icon: KeyRound, title: L("Inloggning + PIN-kod", "Sign-in + PIN"), text: L("Er sida kräver alltid inloggning. Lägg till PIN-kod – efter 5 fel försök spärras den i 15 minuter.", "Always requires sign-in. Add a PIN – locked for 15 minutes after 5 wrong tries.") },
    { icon: ShieldCheck, title: L("Bara er familj", "Only your family"), text: L("Varje familj ser bara sin egen information. Det kontrolleras på servern vid varje förfrågan.", "Each family only sees its own data, checked on the server on every request.") },
    { icon: Download, title: L("Exportera när du vill", "Export anytime"), text: L("Ladda ner en komplett säkerhetskopia och återställ den senare. Du är aldrig inlåst.", "Download a full backup and restore it later. You are never locked in.") },
    { icon: Trash2, title: L("Radera när du vill", "Delete anytime"), text: L("Du kan ta bort barnmappar, dokument och uppgifter själv, när som helst.", "Remove folders, documents and details yourself, anytime.") },
    { icon: Lock, title: L("Krypterad överföring", "Encrypted transfer"), text: L("All trafik mellan dig och Barnmappen skickas krypterad.", "All traffic between you and Barnmappen is encrypted.") },
  ];

  const steps = [
    [L("Köp åtkomst", "Buy access"), L("Engångsköp. Du får en aktiveringskod direkt.", "One-time purchase. You get an activation code right away.")],
    [L("Skapa konto och välj adress", "Create account & address"), L("Välj er egen familjeadress, t.ex. /f/familjen.", "Pick your own family address, e.g. /f/family.")],
    [L("Fyll i i er egen takt", "Fill in at your pace"), L("Börja med det viktigaste – allergier, pass eller storlekar.", "Start with what matters most – allergies, passports or sizes.")],
    [L("Lägg den på hemskärmen", "Add to home screen"), L("Installera sidan som en app på iPhone eller Android.", "Install it like an app on iPhone or Android.")],
  ];

  const faq = [
    [L("Vem kan se mitt barns information?", "Who can see my child's information?"), L("Bara den som loggar in på ert konto. Andra familjer kan aldrig se er sida, inte ens om de känner till adressen.", "Only whoever signs in to your account. Other families can never see your page, even if they know the address.")],
    [L("Vad gör AI-assistenten med uppgifterna?", "What does the AI do with my data?"), L("Den läser bara det du själv skrivit i barnets mapp när du ställer en fråga, och svarar utifrån det. Den gissar aldrig. Den ersätter inte vård – vid akut fara ring 112, för råd ring 1177.", "It only reads what you wrote in the child's folder when you ask, and answers from that. It never guesses. It does not replace healthcare – call 112 in emergencies.")],
    [L("Vad kostar det?", "What does it cost?"), L("Ett engångsköp på 499 kr inkl. 25 % moms. Inget abonnemang.", "A one-time purchase of 499 SEK incl. 25% VAT. No subscription.")],
    [L("Vad händer om jag glömmer lösenord eller PIN?", "What if I forget my password or PIN?"), L("Lösenordet kan återställas via e-post. PIN-koden kan du ta bort eller byta under Inställningar när du är inloggad.", "Reset your password by email. Change or remove the PIN in Settings when signed in.")],
    [L("Kan jag ta med mig min information?", "Can I take my data with me?"), L("Ja. Exportera hela barnmappen som en fil och återställ den när du vill.", "Yes. Export the whole folder as a file and restore it whenever you like.")],
    [L("Fungerar det i mobilen?", "Does it work on mobile?"), L("Ja, sidan är byggd för mobilen först och kan installeras på hemskärmen.", "Yes, it's mobile-first and can be installed on your home screen.")],
  ];

  return (
    <div className="calm-bg min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2">
            <FolderHeart className="size-5 text-accent" aria-hidden />
            <span className="font-display text-xl">{t("app.name")}</span>
          </span>
          <div className="flex items-center gap-2">
            <PrefToggles />
            {signedIn ? (
              <Button asChild size="sm"><Link to="/barn">{t("nav.myChildren")}</Link></Button>
            ) : (
              <Button asChild size="sm" variant="outline"><Link to="/auth">{t("nav.signIn")}</Link></Button>
            )}
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-5 overflow-x-auto whitespace-nowrap px-6 pb-3 text-sm text-muted-foreground [scrollbar-width:none]">
          {nav.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="hover:text-foreground">{label}</a>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <section className="grid items-center gap-12 py-12 md:grid-cols-2 md:py-20">
          <div>
            <p className="text-sm tracking-wide text-accent uppercase">{L("Välkommen till Barnmappen", "Welcome to Barnmappen")}</p>
            <h1 className="mt-4 text-5xl leading-[1.05] md:text-6xl">
              {L("Ett tryggt hem för allt som rör ditt barn.", "A safe home for everything about your child.")}
            </h1>
            <p className="mt-6 max-w-md text-base text-muted-foreground">
              {L(
                "Från skostorlekar och pass till allergier och viktiga kontakter – samlat, skyddat och alltid till hands när du behöver det.",
                "From shoe sizes and passports to allergies and key contacts – gathered, protected and always at hand.",
              )}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg">
                <Link to={signedIn ? "/barn" : "/kop"}>{signedIn ? t("landing.ctaIn") : L("Kom igång", "Get started")}</Link>
              </Button>
              <Button asChild size="lg" variant="outline"><a href="#sakerhet">{L("Läs om säkerheten", "Read about security")}</a></Button>
            </div>
            <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground">
              <Lock className="size-4" aria-hidden />
              {L("Ingen reklam. Ingen försäljning av data. Du har alltid kontrollen.", "No ads. No data selling. You stay in control.")}
            </p>
          </div>
          <img src={heroImage} alt={t("landing.heroAlt")} width={1600} height={1104} className="rounded-3xl object-cover shadow-[var(--shadow-soft)]" />
        </section>

        <Section id="om" eyebrow={L("Vad är Barnmappen?", "What is Barnmappen?")} title={L("Känner du igen dig?", "Sound familiar?")}
          lead={L("Föräldraskap är fullt av kärlek – och av lappar, SMS-trådar och bortglömda storlekar. Barnmappen samlar allt på ett lugnt och privat ställe.", "Parenting is full of love – and notes, text threads and forgotten sizes. Barnmappen gathers it all in one calm, private place.")}>
          <div className="grid gap-4 md:grid-cols-3">
            {moments.map((m) => <Card key={m.title} {...m} />)}
          </div>
        </Section>

        <Section id="omraden" eyebrow={L("Struktur", "Structure")} title={L("Fem tydliga områden i varje barnmapp", "Five clear areas in every folder")}
          lead={L("Varje barn får en egen mapp. Allt har sin plats, så du hittar direkt.", "Each child gets their own folder. Everything has its place.")}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {areas.map((a) => <Card key={a.title} {...a} />)}
          </div>
        </Section>

        <Section id="sakerhet" eyebrow={L("Därför kan du lita på oss", "Why you can trust us")} title={L("Ditt barns information är din", "Your child's information is yours")}
          lead={L("Vi vet att det kräver stort förtroende att lämna ut uppgifter om sitt barn. Här är exakt hur vi skyddar dem – utan överdrifter.", "We know it takes real trust. Here is exactly how we protect it – no exaggeration.")}>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trust.map((x) => <Card key={x.title} {...x} />)}
          </div>
          <p className="mt-6 text-sm text-muted-foreground">
            {L("Läs mer i vår ", "Read more in our ")}
            <Link to="/integritetspolicy" className="underline">{L("integritetspolicy", "privacy policy")}</Link>
            {L(" och våra ", " and ")}
            <Link to="/villkor" className="underline">{L("villkor", "terms")}</Link>.
          </p>
        </Section>

        <Section id="ai" eyebrow={L("AI-stödet", "AI helper")} title={L("En assistent som bara vet det du berättat", "An assistant that only knows what you told it")}>
          <div className="grid gap-6 md:grid-cols-2">
            <ul className="space-y-3 text-muted-foreground">
              {[
                L("Svarar bara utifrån det du skrivit in i barnets mapp.", "Answers only from what you entered."),
                L("Gissar aldrig – vet den inte, säger den det.", "Never guesses – says so when it doesn't know."),
                L("Kort och rakt svar på ditt språk.", "Short, direct answers in your language."),
                L("Ersätter aldrig vård. Vid akut fara: ring 112. För råd: 1177.", "Never replaces healthcare. Emergency: call 112."),
              ].map((s) => (
                <li key={s} className="flex gap-3"><Sparkles className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />{s}</li>
              ))}
            </ul>
            <div className="surface space-y-3 p-6 text-sm">
              <p className="ml-auto w-fit rounded-2xl bg-primary px-4 py-2 text-primary-foreground">{L("Vad är Marcus allergisk mot?", "What is Marcus allergic to?")}</p>
              <p className="w-fit rounded-2xl bg-muted px-4 py-2">{L("Pollen och nötter.", "Pollen and nuts.")}</p>
              <p className="ml-auto w-fit rounded-2xl bg-primary px-4 py-2 text-primary-foreground">{L("Vilken skostorlek har han?", "What's his shoe size?")}</p>
              <p className="w-fit rounded-2xl bg-muted px-4 py-2">{L("Storlek 31.", "Size 31.")}</p>
            </div>
          </div>
        </Section>

        <Section id="steg" eyebrow={L("Så går det till", "How it works")} title={L("Igång på några minuter", "Up and running in minutes")}>
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map(([title, text], i) => (
              <li key={title} className="surface p-6">
                <span className="font-display text-3xl text-accent">{i + 1}</span>
                <h3 className="mt-2 text-lg">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Smartphone className="size-4" aria-hidden />
            {L("Fungerar på mobil, surfplatta och dator.", "Works on phone, tablet and computer.")}
          </p>
        </Section>

        <Section id="faq" eyebrow={L("Frågor & svar", "FAQ")} title={L("Det föräldrar brukar undra", "What parents usually ask")}>
          <div className="space-y-3">
            {faq.map(([q, a]) => (
              <details key={q} className="surface group p-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base">
                  {q}
                  <ChevronDown className="size-4 shrink-0 transition group-open:rotate-180" aria-hidden />
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{a}</p>
              </details>
            ))}
          </div>
        </Section>

        <section className="surface mt-20 p-8 md:p-12">
          <p className="font-display text-2xl leading-snug md:text-3xl">
            {L(
              "”Barnmappen startades ur en enkel insikt: föräldraskapet är fullt av kärlek, men också av lappar, appar och bortglömda storlekar. Vi byggde en trygg och lugn plats för det som betyder mest.”",
              "“Barnmappen grew from a simple insight: parenting is full of love, but also notes, apps and forgotten sizes. We built a calm, safe place for what matters most.”",
            )}
          </p>
          <p className="mt-4 text-sm text-muted-foreground">– Marcus, {L("grundare", "founder")}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg"><Link to={signedIn ? "/barn" : "/kop"}>{signedIn ? t("landing.ctaIn") : L("Kom igång", "Get started")}</Link></Button>
            {!signedIn && <Button asChild size="lg" variant="outline"><Link to="/auth">{t("nav.signIn")}</Link></Button>}
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Section({ id, eyebrow, title, lead, children }: { id: string; eyebrow: string; title: string; lead?: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-20 scroll-mt-32">
      <p className="text-sm tracking-wide text-accent uppercase">{eyebrow}</p>
      <h2 className="mt-2 text-3xl md:text-4xl">{title}</h2>
      {lead && <p className="mt-3 max-w-2xl text-muted-foreground">{lead}</p>}
      <div className="mt-8">{children}</div>
    </section>
  );
}

function Card({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <article className="surface p-6">
      <Icon className="size-5 text-accent" />
      <h3 className="mt-4 text-lg">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </article>
  );
}

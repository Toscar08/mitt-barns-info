import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Check, Eye, LoaderCircle, Plus, Sparkles, X } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { AccountAccess, useAccountAccess } from "@/components/AccountAccess";
import { Brand, Loader } from "@/components/Brand";
import { PrefToggles } from "@/components/PrefToggles";
import { PrivateGate, useWorkspace } from "@/components/PrivateGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { possessive, useChildren } from "@/lib/children";
import { usePrefs } from "@/lib/prefs";
import { activateWorkspace } from "@/lib/workspace.functions";
import { cn } from "@/lib/utils";

type Search = { demo?: boolean | undefined };

export const Route = createFileRoute("/_authenticated/snabbstart")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    demo: search["demo"] === true || search["demo"] === 1 || search["demo"] === "1" ? true : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Snabbstart – Barnmappen" },
      { name: "description", content: "Lägg in dina barn och det viktigaste om dem på under en minut." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: QuickStartPage,
});

const copy = {
  sv: {
    skip: "Hoppa över",
    preview: "Förhandsvisning – inget sparas",
    step: (current: number) => `Steg ${current} av 3`,
    childOf: (current: number, total: number) => `Barn ${current} av ${total}`,
    welcome: "Välkommen! Det här tar under en minut.",
    nameTitle: "Vad heter ditt barn?",
    moreTitle: "Vilka barn vill du lägga till?",
    nameLead: "Börja med namnet. Resten fyller du i när du vill.",
    already: (names: string) => `Du har redan en mapp för ${names}.`,
    namePlaceholder: "Förnamn",
    nameLabel: (number: number) => `Barn ${number}`,
    another: "Lägg till ett barn till",
    removeName: "Ta bort",
    next: "Fortsätt",
    creating: "Skapar mappen…",
    essentialsTitle: (name: string) => `Det viktigaste om ${name}`,
    essentialsLead: "Fyll i det du kan på rak arm. Allt går att ändra senare.",
    birth: "Födelsedatum",
    allergies: "Allergier",
    allergyChips: ["Inga kända", "Nötter", "Ägg", "Mjölk", "Gluten", "Pollen", "Pälsdjur"],
    allergyOther: "Annat, t.ex. penicillin",
    shoe: "Skostorlek",
    clothing: "Klädstorlek",
    school: "Skola eller förskola",
    schoolPlaceholder: "T.ex. Solskolan",
    save: "Spara och fortsätt",
    saveLast: "Spara och avsluta",
    doneTitle: (count: number) => (count === 1 ? "Klart! Mappen är redo." : "Klart! Mapparna är redo."),
    doneLead: "Nu kan du fråga Barnmappen i stället för att leta.",
    emptyFolder: "Tom mapp – fyll på när du vill",
    open: (name: string) => `Öppna ${possessive(name, "sv")} mapp`,
    openAll: "Till Mina barn",
    ask: "Ställ en fråga",
    tryAsk: "Prova att fråga",
    questions: {
      shoe_size: (name: string) => `Vilken skostorlek har ${name}?`,
      allergies: (name: string) => `Vad är ${name} allergisk mot?`,
      school: (name: string) => `Vilken skola går ${name} på?`,
    },
    tip: "Tips: lägg till en PIN-kod under Inställningar för extra skydd.",
    error: "Något gick fel. Försök igen.",
    setupFailed: "Sidan kunde inte skapas automatiskt. Välj en adress själv.",
  },
  en: {
    skip: "Skip",
    preview: "Preview – nothing is saved",
    step: (current: number) => `Step ${current} of 3`,
    childOf: (current: number, total: number) => `Child ${current} of ${total}`,
    welcome: "Welcome! This takes less than a minute.",
    nameTitle: "What's your child's name?",
    moreTitle: "Which children do you want to add?",
    nameLead: "Start with the name. Fill in the rest whenever you like.",
    already: (names: string) => `You already have a folder for ${names}.`,
    namePlaceholder: "First name",
    nameLabel: (number: number) => `Child ${number}`,
    another: "Add another child",
    removeName: "Remove",
    next: "Continue",
    creating: "Creating the folder…",
    essentialsTitle: (name: string) => `The essentials about ${name}`,
    essentialsLead: "Fill in what you know offhand. Everything can be changed later.",
    birth: "Date of birth",
    allergies: "Allergies",
    allergyChips: ["None known", "Nuts", "Egg", "Milk", "Gluten", "Pollen", "Pets"],
    allergyOther: "Other, e.g. penicillin",
    shoe: "Shoe size",
    clothing: "Clothing size",
    school: "School or preschool",
    schoolPlaceholder: "E.g. Sunny School",
    save: "Save and continue",
    saveLast: "Save and finish",
    doneTitle: (count: number) => (count === 1 ? "Done! The folder is ready." : "Done! The folders are ready."),
    doneLead: "Now you can ask Barnmappen instead of searching.",
    emptyFolder: "Empty folder – fill it in whenever you like",
    open: (name: string) => `Open ${possessive(name, "en")} folder`,
    openAll: "To My children",
    ask: "Ask a question",
    tryAsk: "Try asking",
    questions: {
      shoe_size: (name: string) => `What shoe size does ${name} have?`,
      allergies: (name: string) => `What is ${name} allergic to?`,
      school: (name: string) => `Which school does ${name} go to?`,
    },
    tip: "Tip: add a PIN code under Settings for extra protection.",
    error: "Something went wrong. Try again.",
    setupFailed: "The site could not be set up automatically. Choose an address yourself.",
  },
} as const;

type Kid = { id: string; name: string };

const ESSENTIALS = ["birth_date", "allergies", "shoe_size", "clothing_size", "school"] as const;
type Essentials = Record<(typeof ESSENTIALS)[number], string>;

/** A neutral address the family can rename in Settings. It carries no name or e-mail. */
function randomSlug() {
  const alphabet = "abcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return `familj-${Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join("")}`;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function QuickStartPage() {
  const { demo } = Route.useSearch();
  // Development only: walk through the flow without creating or changing anything.
  const preview = import.meta.env.DEV && demo === true;
  const workspace = useWorkspace();
  const access = useAccountAccess();
  // Decided once. Creating the workspace mid-flow must not swap the tree and wipe the answers.
  const fresh = useRef<boolean | null>(null);

  if (workspace.isLoading || access.isPending) return <Loader />;
  if (access.error || !access.data || !["trial", "paid", "complimentary"].includes(access.data.status)) {
    return (
      <Shell>
        <AccountAccess />
      </Shell>
    );
  }
  if (workspace.error) {
    return (
      <Shell>
        <p className="surface p-6 text-center text-sm text-muted-foreground">{workspace.error.message}</p>
      </Shell>
    );
  }
  if (fresh.current === null) fresh.current = !workspace.data;

  const flow = <QuickStart fresh={fresh.current} preview={preview} />;
  // A family that already has a PIN meets its lock first. A brand-new workspace has none yet.
  return fresh.current || preview ? flow : <PrivateGate>{flow}</PrivateGate>;
}

function Shell({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="topbar px-3 pt-3 sm:px-6">
        <div className="glass mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 rounded-full pr-2 pl-3">
          <Brand />
          <div className="flex items-center gap-1">
            <PrefToggles />
            {aside}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-lg px-4 pt-[min(8vh,4rem)] pb-16 sm:px-6">{children}</main>
    </div>
  );
}

function QuickStart({ fresh, preview }: { fresh: boolean; preview: boolean }) {
  const { lang } = usePrefs();
  const c = copy[lang];
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const activate = useServerFn(activateWorkspace);
  const existing = useChildren(!fresh && !preview);

  const [step, setStep] = useState<"names" | "essentials" | "done">("names");
  const [names, setNames] = useState<string[]>([""]);
  const [kids, setKids] = useState<Kid[]>([]);
  const [index, setIndex] = useState(0);
  const [facts, setFacts] = useState<Record<string, string[]>>({});
  // The first thing worth asking the assistant about, so the folder pays off straight away.
  const [firstQuestion, setFirstQuestion] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hasWorkspace = useRef(!fresh);

  /** A new account gets its private site here, with the first answer, instead of on a form of its own. */
  async function ensureWorkspace() {
    if (hasWorkspace.current || preview) return true;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const result = await activate({ data: { slug: randomSlug() } });
      if (result.ok) {
        hasWorkspace.current = true;
        void queryClient.invalidateQueries({ queryKey: ["workspace"] });
        return true;
      }
      if (result.error !== "taken") break;
    }
    toast.error(c.setupFailed);
    void navigate({ to: "/aktivera" });
    return false;
  }

  async function createFolders(event: React.FormEvent) {
    event.preventDefault();
    const list = names.map((name) => name.trim()).filter(Boolean);
    if (list.length === 0) return;
    setBusy(true);
    try {
      if (!(await ensureWorkspace())) return;
      let created: Kid[];
      if (preview) {
        await wait(500);
        created = list.map((name, i) => ({ id: `preview-${i}`, name }));
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) throw new Error("signed out");
        const { data, error } = await supabase
          .from("children")
          .insert(list.map((name) => ({ user_id: userId, name })))
          .select("id, name");
        if (error) throw error;
        // Keep the order the parent typed them in, whatever order the rows come back in.
        const rows = [...data];
        created = list.flatMap((name) => {
          const at = rows.findIndex((row) => row.name === name);
          return at === -1 ? [] : rows.splice(at, 1);
        });
        void queryClient.invalidateQueries({ queryKey: ["children"] });
      }
      setKids(created);
      setIndex(0);
      setStep("essentials");
    } catch {
      toast.error(c.error);
    } finally {
      setBusy(false);
    }
  }

  function advance() {
    if (index + 1 < kids.length) setIndex(index + 1);
    else setStep("done");
  }

  async function saveEssentials(values: Essentials, labels: string[]) {
    const kid = kids[index]!;
    const patch: Partial<Essentials> = {};
    for (const key of ESSENTIALS) if (values[key].trim()) patch[key] = values[key].trim();
    setBusy(true);
    try {
      if (Object.keys(patch).length > 0) {
        if (preview) await wait(400);
        else {
          const { error } = await supabase.from("children").update(patch).eq("id", kid.id);
          if (error) throw error;
          void queryClient.invalidateQueries({ queryKey: ["children"] });
          void queryClient.invalidateQueries({ queryKey: ["child", kid.id] });
        }
      }
      setFacts((all) => ({ ...all, [kid.id]: labels }));
      const asked = (["shoe_size", "allergies", "school"] as const).find((key) => patch[key]);
      if (asked) setFirstQuestion((current) => current ?? c.questions[asked](kid.name));
      advance();
    } catch {
      toast.error(c.error);
    } finally {
      setBusy(false);
    }
  }

  async function skipAll() {
    setBusy(true);
    try {
      if (await ensureWorkspace()) void navigate({ to: "/barn" });
    } catch {
      toast.error(c.error);
    } finally {
      setBusy(false);
    }
  }

  const stepNumber = step === "names" ? 1 : step === "essentials" ? 2 : 3;
  const filled = names.some((name) => name.trim());
  const kid = kids[index];

  return (
    <Shell
      // "Skip" lives in the same corner on every step: first the whole quick start, then one child at a time.
      aside={
        step === "done" ? null : (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => (step === "names" ? void skipAll() : advance())}
            disabled={busy}
          >
            {c.skip}
          </Button>
        )
      }
    >
      {preview && (
        <p className="glass mx-auto mb-4 flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium text-muted-foreground">
          <Eye className="size-4" aria-hidden />
          {c.preview}
        </p>
      )}

      <div className="surface p-6 sm:p-8">
        <div className="flex items-center gap-3">
          <div className="flex flex-1 gap-1.5" role="img" aria-label={c.step(stepNumber)}>
            {[1, 2, 3].map((number) => (
              <span
                key={number}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors duration-300 ease-out",
                  number <= stepNumber ? "bg-accent" : "bg-foreground/10",
                )}
              />
            ))}
          </div>
          <span className="text-xs font-medium text-muted-foreground tabular-nums">
            {step === "essentials" && kids.length > 1 ? c.childOf(index + 1, kids.length) : c.step(stepNumber)}
          </span>
        </div>

        {step === "names" && (
          <form key="names" onSubmit={createFolders} className="rise mt-7">
            {fresh && <p className="mb-2 text-sm font-medium text-accent">{c.welcome}</p>}
            <h1 className="text-3xl sm:text-4xl">{existing.data?.length ? c.moreTitle : c.nameTitle}</h1>
            <p className="mt-3 text-muted-foreground">
              {existing.data?.length ? c.already(existing.data.map((child) => child.name).join(", ")) : c.nameLead}
            </p>
            <div className="mt-6 space-y-3">
              {names.map((name, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    autoFocus={i === names.length - 1}
                    value={name}
                    onChange={(event) => setNames((list) => list.map((other, j) => (j === i ? event.target.value : other)))}
                    placeholder={c.namePlaceholder}
                    aria-label={c.nameLabel(i + 1)}
                    autoComplete="off"
                    autoCapitalize="words"
                    enterKeyHint="next"
                    maxLength={60}
                    className="h-14 rounded-2xl px-5 text-lg md:text-lg"
                  />
                  {names.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={c.removeName}
                      title={c.removeName}
                      onClick={() => setNames((list) => list.filter((_, j) => j !== i))}
                    >
                      <X aria-hidden />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {names.length < 8 && (
              <button
                type="button"
                onClick={() => setNames((list) => [...list, ""])}
                className="group pressable mt-3 inline-flex cursor-pointer items-center gap-2 rounded-full py-2 pr-3 pl-2 text-sm font-medium text-accent hover:bg-accent/10"
              >
                <span className="grid size-6 place-content-center rounded-full bg-accent/15 transition-transform duration-200 ease-out group-hover:rotate-90">
                  <Plus className="size-3.5" strokeWidth={2.5} aria-hidden />
                </span>
                {c.another}
              </button>
            )}
            <Button type="submit" size="lg" variant="pop" className="mt-7 w-full" disabled={busy || !filled}>
              {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
              {busy ? c.creating : c.next}
              {!busy && <ArrowRight aria-hidden />}
            </Button>
          </form>
        )}

        {step === "essentials" && kid && (
          <EssentialsForm
            key={kid.id}
            name={kid.name}
            last={index + 1 === kids.length}
            busy={busy}
            onSave={saveEssentials}
          />
        )}

        {step === "done" && (
          <div key="done" className="rise mt-7 text-center">
            <span className="pop mx-auto grid size-16 place-content-center rounded-full bg-pop text-pop-foreground shadow-[0_12px_28px_-12px_var(--pop)]">
              <Check className="size-8" strokeWidth={3} aria-hidden />
            </span>
            <h1 className="mt-5 text-3xl sm:text-4xl">{c.doneTitle(kids.length)}</h1>
            <p className="mt-3 text-muted-foreground">{c.doneLead}</p>

            <ul className="mt-6 space-y-2 text-left">
              {kids.map((child, i) => (
                <li
                  key={child.id}
                  className="rise flex items-center gap-3 rounded-2xl border border-[var(--glass-edge)] bg-[var(--glass-field)] px-4 py-3"
                  style={{ "--i": i + 1 } as React.CSSProperties}
                >
                  <span className="grid size-10 shrink-0 place-content-center rounded-full bg-accent/15 font-semibold text-accent" aria-hidden>
                    {child.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{child.name}</span>
                    <span className="block text-sm text-muted-foreground [overflow-wrap:anywhere]">
                      {facts[child.id]?.length ? facts[child.id]!.join(" · ") : c.emptyFolder}
                    </span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-7 flex flex-col gap-2">
              <Button asChild size="lg" variant="pop">
                {kids.length === 1 && !preview ? (
                  <Link to="/barn/$childId" params={{ childId: kids[0]!.id }}>
                    {c.open(kids[0]!.name)}
                    <ArrowRight aria-hidden />
                  </Link>
                ) : (
                  <Link to="/barn">
                    {kids.length === 1 ? c.open(kids[0]!.name) : c.openAll}
                    <ArrowRight aria-hidden />
                  </Link>
                )}
              </Button>
              {firstQuestion ? (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">{c.tryAsk}</p>
                  <Button asChild variant="outline" className="mt-2 h-auto min-h-11 max-w-full py-2 text-left whitespace-normal">
                    <Link to="/fraga" search={{ q: firstQuestion }}>
                      <Sparkles className="text-accent" aria-hidden />
                      {firstQuestion}
                    </Link>
                  </Button>
                </div>
              ) : (
                <Button asChild size="lg" variant="ghost">
                  <Link to="/fraga">
                    <Sparkles aria-hidden />
                    {c.ask}
                  </Link>
                </Button>
              )}
            </div>
            <p className="mt-5 text-xs text-muted-foreground">{c.tip}</p>
          </div>
        )}
      </div>
    </Shell>
  );
}

function EssentialsForm({
  name,
  last,
  busy,
  onSave,
}: {
  name: string;
  last: boolean;
  busy: boolean;
  onSave: (values: Essentials, labels: string[]) => void;
}) {
  const { lang } = usePrefs();
  const c = copy[lang];
  const none = c.allergyChips[0];
  const [birth, setBirth] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [other, setOther] = useState("");
  const [shoe, setShoe] = useState("");
  const [clothing, setClothing] = useState("");
  const [school, setSchool] = useState("");

  // "None known" is an answer of its own, so it never sits beside an allergen.
  function toggle(chip: string) {
    setPicked((list) => {
      if (list.includes(chip)) return list.filter((item) => item !== chip);
      return chip === none ? [none] : [...list.filter((item) => item !== none), chip];
    });
    if (chip === none) setOther("");
  }

  const allergies = [...picked, other.trim()].filter(Boolean).join(", ");
  const today = new Date().toISOString().slice(0, 10);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const labels = [
      allergies && `${c.allergies}: ${allergies}`,
      shoe.trim() && `${c.shoe} ${shoe.trim()}`,
      clothing.trim() && `${c.clothing} ${clothing.trim()}`,
      school.trim(),
    ].filter((label): label is string => Boolean(label));
    onSave({ birth_date: birth, allergies, shoe_size: shoe, clothing_size: clothing, school }, labels);
  }

  return (
    <form onSubmit={submit} className="rise mt-7">
      <h1 className="text-3xl [overflow-wrap:anywhere] sm:text-4xl">{c.essentialsTitle(name)}</h1>
      <p className="mt-3 text-muted-foreground">{c.essentialsLead}</p>

      <div className="mt-6 space-y-5">
        <fieldset className="space-y-2">
          <legend className="text-sm leading-none font-medium">{c.allergies}</legend>
          <div className="flex flex-wrap gap-2 pt-1">
            {c.allergyChips.map((chip) => {
              const on = picked.includes(chip);
              return (
                <button
                  key={chip}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(chip)}
                  className={cn(
                    "pressable inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium",
                    on
                      ? "border-accent bg-accent text-accent-foreground"
                      : "border-input bg-[var(--glass-field)] hover:border-accent hover:text-accent",
                  )}
                >
                  {on && <Check className="size-3.5" strokeWidth={3} aria-hidden />}
                  {chip}
                </button>
              );
            })}
          </div>
          <Input
            value={other}
            onChange={(event) => {
              setOther(event.target.value);
              if (event.target.value) setPicked((list) => list.filter((item) => item !== none));
            }}
            placeholder={c.allergyOther}
            aria-label={c.allergyOther}
            maxLength={200}
          />
        </fieldset>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="qs-shoe">{c.shoe}</Label>
            <Input id="qs-shoe" inputMode="decimal" placeholder="31" maxLength={10} value={shoe} onChange={(event) => setShoe(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="qs-clothing">{c.clothing}</Label>
            <Input id="qs-clothing" placeholder="110/116" maxLength={20} value={clothing} onChange={(event) => setClothing(event.target.value)} />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="qs-school">{c.school}</Label>
          <Input id="qs-school" placeholder={c.schoolPlaceholder} maxLength={120} value={school} onChange={(event) => setSchool(event.target.value)} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="qs-birth">{c.birth}</Label>
          <Input id="qs-birth" type="date" max={today} value={birth} onChange={(event) => setBirth(event.target.value)} />
        </div>
      </div>

      {/* Stays in view on a phone, where the form is taller than the screen. */}
      <div className="sticky bottom-3 z-10 mt-7 max-sm:-mx-3 max-sm:rounded-full max-sm:p-1.5 max-sm:surface-strong">
        <Button type="submit" size="lg" variant="pop" className="w-full" disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
          {last ? c.saveLast : c.save}
          {!busy && <ArrowRight aria-hidden />}
        </Button>
      </div>
    </form>
  );
}

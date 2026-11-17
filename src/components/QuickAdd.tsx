import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import {
  Cake,
  CalendarDays,
  Check,
  Droplet,
  Footprints,
  GraduationCap,
  IdCard,
  ListChecks,
  LoaderCircle,
  NotebookPen,
  Phone,
  Pill,
  Shirt,
  TriangleAlert,
  WandSparkles,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { AskBar } from "@/components/AskBar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { possessive, type ChildRow } from "@/lib/children";
import { usePrefs, type TranslationKey } from "@/lib/prefs";
import { APPENDING, merged, type ChildField, type EntryCategory, type QuickItem } from "@/lib/quick-add";
import { sortQuickNote } from "@/lib/quick-add.functions";
import { cn } from "@/lib/utils";

type Icon = React.ComponentType<{ className?: string }>;

const FIELD: Record<ChildField, { label: TranslationKey; icon: Icon }> = {
  birth_date: { label: "person.birth", icon: Cake },
  personal_number: { label: "person.personalNumber", icon: IdCard },
  blood_type: { label: "person.blood", icon: Droplet },
  allergies: { label: "person.allergies", icon: TriangleAlert },
  medications: { label: "person.medications", icon: Pill },
  clothing_size: { label: "person.clothing", icon: Shirt },
  shoe_size: { label: "person.shoe", icon: Footprints },
  school: { label: "person.school", icon: GraduationCap },
  school_class: { label: "person.class", icon: GraduationCap },
  passport_number: { label: "person.passport", icon: IdCard },
  passport_expiry: { label: "person.passportExpiry", icon: IdCard },
  notes: { label: "person.summary", icon: NotebookPen },
};

const CATEGORY: Record<EntryCategory, { label: TranslationKey; icon: Icon }> = {
  contacts: { label: "tab.contacts", icon: Phone },
  calendar: { label: "tab.calendar", icon: CalendarDays },
  custom: { label: "tab.custom", icon: NotebookPen },
};

const copy = {
  sv: {
    title: "Lägg till snabbt",
    lead: "Skriv som du tänker. Barnmappen sorterar in det på rätt plats.",
    placeholder: "T.ex. skostorlek 31 och allergisk mot nötter",
    send: "Sortera in",
    sorting: "Sorterar…",
    review: "Så här sparas det",
    nothing: "Jag hittade inget att spara i det där. Prova med en uppgift i taget, till exempel ”skostorlek 31”.",
    pick: "Välj barn",
    pickAll: "Välj vilket barn varje rad gäller.",
    replaces: "Ersätter",
    becomes: "Blir",
    remove: "Ta bort raden",
    save: (count: number) => (count === 1 ? "Spara" : `Spara ${count} uppgifter`),
    saved: (count: number) => (count === 1 ? "Sparat." : `${count} uppgifter sparade.`),
    open: (name: string) => `Öppna ${possessive(name, "sv")} mapp`,
    due: "Senast",
    examples: (name: string) => [
      `${name} har skostorlek 31`,
      `${name} är allergisk mot nötter`,
      "Tandläkaren 08-123 45 67",
      "Boka tandläkartid senast 1 dec",
    ],
  },
  en: {
    title: "Add quickly",
    lead: "Write it the way you think it. Barnmappen files it in the right place.",
    placeholder: "E.g. shoe size 31 and allergic to nuts",
    send: "File it",
    sorting: "Sorting…",
    review: "This is how it will be saved",
    nothing: "I couldn't find anything to save in that. Try one fact at a time, such as “shoe size 31”.",
    pick: "Choose child",
    pickAll: "Choose which child each row is about.",
    replaces: "Replaces",
    becomes: "Becomes",
    remove: "Remove row",
    save: (count: number) => (count === 1 ? "Save" : `Save ${count} items`),
    saved: (count: number) => (count === 1 ? "Saved." : `${count} items saved.`),
    open: (name: string) => `Open ${possessive(name, "en")} folder`,
    due: "Due",
    examples: (name: string) => [
      `${name} has shoe size 31`,
      `${name} is allergic to nuts`,
      "The dentist 08-123 45 67",
      "Book the dentist by 1 Dec",
    ],
  },
} as const;

const pad = (value: number) => String(value).padStart(2, "0");

/**
 * A chat-like field for the children overview: free text in, filed facts out.
 * Nothing is written until the parent has seen where each fact will go and pressed save.
 */
export function QuickAdd({ kids }: { kids: ChildRow[] }) {
  const { lang, locale, t } = usePrefs();
  const c = copy[lang];
  const sort = useServerFn(sortQuickNote);
  const queryClient = useQueryClient();

  const [text, setText] = useState("");
  const [phase, setPhase] = useState<"idle" | "sorting" | "review" | "saving" | "saved">("idle");
  const [items, setItems] = useState<QuickItem[]>([]);
  const [saved, setSaved] = useState<{ count: number; childIds: string[] }>({ count: 0, childIds: [] });

  const kidById = (id: string | null) => kids.find((kid) => kid.id === id);
  const unassigned = items.some((item) => !kidById(item.childId));

  async function sortIt() {
    const note = text.trim();
    if (note.length < 2) return;
    setPhase("sorting");
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      const result = await sort({ data: { text: note, today, lang } });
      setItems(result.items);
      setPhase("review");
    } catch {
      toast.error(t("common.error"));
      setPhase("idle");
    }
  }

  async function save() {
    setPhase("saving");
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error(t("children.mustSignIn"));

      const childIds = [...new Set(items.map((item) => item.childId!))];
      for (const childId of childIds) {
        const fields = items.filter((item) => item.kind === "field" && item.childId === childId);
        if (fields.length === 0) continue;
        // Read the row again right before writing, so a value added elsewhere is kept, not overwritten.
        const current = await supabase.from("children").select("*").eq("id", childId).single();
        if (current.error) throw current.error;
        const patch: TablesUpdate<"children"> = {};
        for (const item of fields) {
          if (item.kind !== "field") continue;
          patch[item.field] = merged(item.field, patch[item.field] ?? current.data[item.field], item.value);
        }
        const updated = await supabase.from("children").update(patch).eq("id", childId);
        if (updated.error) throw updated.error;
      }

      const entries = items.flatMap((item) =>
        item.kind === "entry"
          ? [{ user_id: userId, child_id: item.childId!, category: item.category, title: item.title, content: item.content }]
          : [],
      );
      if (entries.length) {
        const inserted = await supabase.from("entries").insert(entries);
        if (inserted.error) throw inserted.error;
      }

      const tasks = items.flatMap((item) =>
        item.kind === "task"
          ? [{ user_id: userId, child_id: item.childId!, title: item.title, due_at: item.dueAt ? new Date(item.dueAt).toISOString() : null }]
          : [],
      );
      if (tasks.length) {
        const inserted = await supabase.from("tasks").insert(tasks);
        if (inserted.error) throw inserted.error;
      }

      void queryClient.invalidateQueries({ queryKey: ["children"] });
      for (const childId of childIds) {
        void queryClient.invalidateQueries({ queryKey: ["child", childId] });
        void queryClient.invalidateQueries({ queryKey: ["entries", childId] });
        void queryClient.invalidateQueries({ queryKey: ["tasks", childId] });
      }
      setSaved({ count: items.length, childIds });
      setItems([]);
      setText("");
      setPhase("saved");
    } catch {
      toast.error(t("common.error"));
      setPhase("review");
    }
  }

  function describe(item: QuickItem) {
    if (item.kind === "field") {
      const meta = FIELD[item.field];
      const existing = (kidById(item.childId)?.[item.field] ?? "").trim();
      const result = merged(item.field, existing, item.value);
      const adds = APPENDING.includes(item.field);
      const note =
        existing && result !== existing ? (adds ? `${c.becomes}: ${result}` : `${c.replaces}: ${existing}`) : null;
      return { icon: meta.icon, label: t(meta.label), main: item.value, note };
    }
    if (item.kind === "entry") {
      const meta = CATEGORY[item.category];
      return { icon: meta.icon, label: t(meta.label), main: item.title, note: item.content };
    }
    const due = item.dueAt
      ? `${c.due} ${new Date(item.dueAt).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" })}`
      : null;
    return { icon: ListChecks, label: t("tasks.task"), main: item.title, note: due };
  }

  const picker = (item: QuickItem, index: number) => (
    <select
      value={kidById(item.childId)?.id ?? ""}
      onChange={(event) =>
        setItems((list) => list.map((other, i) => (i === index ? { ...other, childId: event.target.value || null } : other)))
      }
      aria-label={c.pick}
      disabled={phase === "saving"}
      className={cn(
        "field h-9 max-w-[10rem] cursor-pointer rounded-full px-3 text-[13px] font-medium",
        !kidById(item.childId) && "border-destructive text-destructive",
      )}
    >
      <option value="">{c.pick}</option>
      {kids.map((kid) => (
        <option key={kid.id} value={kid.id}>
          {kid.name}
        </option>
      ))}
    </select>
  );

  const busy = phase === "sorting" || phase === "saving";
  const firstName = kids[0]?.name ?? "";

  return (
    <section className="group/add surface rise mt-6 p-5 [--i:1] sm:p-6" aria-labelledby="quick-add-title">
      <h2 id="quick-add-title" className="flex items-center gap-3 text-xl">
        <span className="grid size-9 shrink-0 place-content-center rounded-full bg-accent/15 text-accent">
          <WandSparkles className="size-4.5" aria-hidden />
        </span>
        {c.title}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{c.lead}</p>

      <div className="mt-4">
        <AskBar
          value={text}
          onChange={(value) => {
            setText(value);
            if (phase === "saved") setPhase("idle");
          }}
          onSubmit={() => void sortIt()}
          placeholder={c.placeholder}
          label={c.send}
          loading={busy}
          multiline
          maxLength={600}
        />
      </div>

      {/* Examples teach the format. On a phone they wait until the field is in use, to keep the folders in view. */}
      {phase === "idle" && !text && (
        <div className="mt-3 hidden flex-wrap gap-2 group-focus-within/add:flex sm:flex">
          {c.examples(firstName).map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => setText(example)}
              className="pressable cursor-pointer rounded-full bg-foreground/6 px-3 py-1.5 text-[13px] text-muted-foreground hover:bg-accent/15 hover:text-accent"
            >
              {example}
            </button>
          ))}
        </div>
      )}

      <div aria-live="polite">
        {phase === "sorting" && <p className="mt-4 animate-pulse text-sm text-muted-foreground">{c.sorting}</p>}

        {(phase === "review" || phase === "saving") && items.length === 0 && (
          <p className="well pop mt-4 p-4 text-sm">{c.nothing}</p>
        )}

        {(phase === "review" || phase === "saving") && items.length > 0 && (
          <div className="pop mt-5">
            <p className="text-sm font-medium">{c.review}</p>
            <ul className="mt-2 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-[var(--glass-field)]">
              {items.map((item, index) => {
                const row = describe(item);
                return (
                  <li key={`${item.kind}-${index}`} className="row flex items-start gap-3 py-3 pr-2 pl-4">
                    <span className="mt-0.5 grid size-9 shrink-0 place-content-center rounded-xl bg-accent/12 text-accent">
                      <row.icon className="size-4.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs text-muted-foreground">{row.label}</span>
                      <span className="block font-medium [overflow-wrap:anywhere]">{row.main}</span>
                      {row.note && (
                        <span className="block text-sm whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
                          {row.note}
                        </span>
                      )}
                      {kids.length > 1 && <span className="mt-2 block sm:hidden">{picker(item, index)}</span>}
                    </span>
                    {kids.length > 1 ? (
                      <span className="mt-0.5 shrink-0 max-sm:hidden">{picker(item, index)}</span>
                    ) : (
                      <span className="mt-2 max-w-[8rem] shrink-0 truncate text-[13px] text-muted-foreground max-sm:hidden">{firstName}</span>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-9 shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      aria-label={c.remove}
                      title={c.remove}
                      disabled={phase === "saving"}
                      onClick={() => setItems((list) => list.filter((_, i) => i !== index))}
                    >
                      <X aria-hidden />
                    </Button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant="pop" onClick={() => void save()} disabled={phase === "saving" || unassigned}>
                {phase === "saving" ? <LoaderCircle className="animate-spin" aria-hidden /> : <Check aria-hidden />}
                {c.save(items.length)}
              </Button>
              <Button
                variant="ghost"
                disabled={phase === "saving"}
                onClick={() => {
                  setItems([]);
                  setPhase("idle");
                }}
              >
                {t("common.cancel")}
              </Button>
              {unassigned && <p className="text-sm text-destructive">{c.pickAll}</p>}
            </div>
          </div>
        )}

        {phase === "saved" && (
          <div className="well pop mt-4 flex flex-wrap items-center gap-3 p-3 pl-4">
            <span className="grid size-8 shrink-0 place-content-center rounded-full bg-accent text-accent-foreground">
              <Check className="size-4" strokeWidth={3} aria-hidden />
            </span>
            <p className="min-w-0 flex-1 text-sm font-medium">{c.saved(saved.count)}</p>
            {saved.childIds.map((id) => {
              const kid = kidById(id);
              return kid ? (
                <Button key={id} asChild variant="outline" size="sm">
                  <Link to="/barn/$childId" params={{ childId: id }}>
                    {c.open(kid.name)}
                  </Link>
                </Button>
              ) : null;
            })}
          </div>
        )}
      </div>
    </section>
  );
}

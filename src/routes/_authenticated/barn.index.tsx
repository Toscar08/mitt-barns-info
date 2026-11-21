import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowRight, Plus, Upload, ChevronRight, ShieldCheck, Search, FolderHeart } from "lucide-react";

import { PrivateGate } from "@/components/PrivateGate";
import { AppHeader } from "@/components/AppHeader";
import { QuickAdd } from "@/components/QuickAdd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useChildren } from "@/lib/children";
import { useFamily, useMyId } from "@/lib/family";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/_authenticated/barn/")({
  head: () => ({
    meta: [
      { title: "Mina barn – Barnmappen" },
      {
        name: "description",
        content: "Översikt över dina barns digitala mappar med information, dokument och uppgifter.",
      },
      { property: "og:title", content: "Mina barn – Barnmappen" },
      { property: "og:description", content: "Översikt över dina barns digitala mappar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PrivateGate>
      <ChildrenPage />
    </PrivateGate>
  ),
});

function ChildrenPage() {
  const queryClient = useQueryClient();
  const { t, locale } = usePrefs();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { lang } = usePrefs();
  const [term, setTerm] = useState("");
  const search = useQuery({
    queryKey: ["search", term],
    enabled: term.trim().length >= 2,
    // Searches notes, tasks and the personal details, so "nötter" or "Solskolan" is found wherever it is.
    queryFn: async () => {
      const q = `%${term.trim().replace(/[%_,()]/g, " ")}%`;
      const fields = ["allergies", "medications", "school", "school_class", "clothing_size", "shoe_size", "blood_type", "notes"] as const;
      const [entries, tasks, kids] = await Promise.all([
        supabase.from("entries").select("id, title, content, child_id, children(name)").or(`title.ilike.${q},content.ilike.${q}`).limit(20),
        supabase.from("tasks").select("id, title, due_at, child_id, children(name)").ilike("title", q).limit(10),
        supabase.from("children").select("*").or(fields.map((f) => `${f}.ilike.${q}`).join(",")).limit(10),
      ]);
      const error = entries.error ?? tasks.error ?? kids.error;
      if (error) throw error;
      const needle = term.trim().toLowerCase();
      const label = (field: (typeof fields)[number]) =>
        (({ allergies: "person.allergies", medications: "person.medications", school: "person.school", school_class: "person.class", clothing_size: "person.clothing", shoe_size: "person.shoe", blood_type: "person.blood", notes: "person.summary" }) as const)[field];
      type Hit = { id: string; childId: string; title: string; detail: string };
      const name = (row: { children: unknown }) => (row.children as { name: string } | null)?.name ?? "";
      return [
        ...(kids.data ?? []).flatMap((kid) =>
          fields
            .filter((f) => (kid[f] ?? "").toLowerCase().includes(needle))
            .map((f): Hit => ({ id: `${kid.id}-${f}`, childId: kid.id, title: `${t(label(f))}: ${kid[f]}`, detail: kid.name })),
        ),
        ...(entries.data ?? []).map((e): Hit => ({ id: e.id, childId: e.child_id, title: e.title, detail: [name(e), e.content].filter(Boolean).join(" · ") })),
        ...(tasks.data ?? []).map((task): Hit => ({ id: task.id, childId: task.child_id, title: task.title, detail: [name(task), t("tasks.task")].join(" · ") })),
      ];
    },
  });

  const children = useChildren();
  // Folders shared by another family carry that family's name, and only editable ones go to quick add.
  const me = useMyId();
  const family = useFamily();
  const familyOf = (ownerId: string) => family.data?.joined.find((f) => f.ownerId === ownerId);
  const editableKids = (children.data ?? []).filter((kid) => kid.user_id === me.data || familyOf(kid.user_id)?.role === "editor");

  const addChild = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error(t("children.mustSignIn"));
      const { error } = await supabase.from("children").insert({
        user_id: userId,
        name: name.trim(),
        birth_date: birthDate || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setName("");
      setBirthDate("");
      setAdding(false);
      queryClient.invalidateQueries({ queryKey: ["children"] });
      toast.success(t("children.created"));
    },
    onError: (error) => toast.error(error.message),
  });

  async function handleRestore(file: File) {
    try {
      const parsed = JSON.parse(await file.text()) as {
        child?: Record<string, unknown>;
        entries?: Array<Record<string, unknown>>;
        tasks?: Array<Record<string, unknown>>;
      };
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId || !parsed.child?.["name"]) throw new Error(t("children.restoreFail"));

      const c = parsed.child;
      const { data: created, error } = await supabase
        .from("children")
        .insert({
          user_id: userId,
          name: String(c["name"]),
          birth_date: (c["birth_date"] as string) ?? null,
          personal_number: (c["personal_number"] as string) ?? null,
          blood_type: (c["blood_type"] as string) ?? null,
          allergies: (c["allergies"] as string) ?? null,
          medications: (c["medications"] as string) ?? null,
          care_contacts: (c["care_contacts"] as string) ?? null,
          notes: (c["notes"] as string) ?? null,
          clothing_size: (c["clothing_size"] as string) ?? null,
          shoe_size: (c["shoe_size"] as string) ?? null,
          passport_number: (c["passport_number"] as string) ?? null,
          passport_expiry: (c["passport_expiry"] as string) ?? null,
          school: (c["school"] as string) ?? null,
          school_class: (c["school_class"] as string) ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      if (parsed.entries?.length) {
        await supabase.from("entries").insert(
          parsed.entries.map((e) => ({
            user_id: userId,
            child_id: created.id,
            category: String(e["category"] ?? "custom"),
            title: String(e["title"] ?? "—"),
            content: (e["content"] as string) ?? null,
          })),
        );
      }
      if (parsed.tasks?.length) {
        await supabase.from("tasks").insert(
          parsed.tasks.map((t2) => ({
            user_id: userId,
            child_id: created.id,
            title: String(t2["title"] ?? "—"),
            due_at: (t2["due_at"] as string) ?? null,
            done: Boolean(t2["done"]),
          })),
        );
      }
      queryClient.invalidateQueries({ queryKey: ["children"] });
      toast.success(t("children.restored"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("children.restoreFail"));
    }
  }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="rise flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl sm:text-5xl">{t("children.title")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("children.lead")}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" aria-hidden />
              {t("children.restore")}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleRestore(file);
                event.target.value = "";
              }}
            />
            <Button onClick={() => setAdding((v) => !v)}>
              <Plus className="size-4" aria-hidden />
              {t("children.new")}
            </Button>
          </div>
        </div>

        {editableKids.length > 0 && <QuickAdd kids={editableKids} />}

        <div className="rise mt-6 [--i:2]">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              type="search"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder={lang === "sv" ? "Sök i alla mappar…" : "Search all folders…"}
              aria-label={lang === "sv" ? "Sök" : "Search"}
              className="h-12 rounded-full pl-11"
            />
          </div>
          {term.trim().length >= 2 && (
            <ul className="surface pop mt-2 divide-y divide-border overflow-hidden">
              {search.isLoading && (
                <li className="animate-pulse p-4 text-sm text-muted-foreground">{lang === "sv" ? "Söker…" : "Searching…"}</li>
              )}
              {search.data?.length === 0 && (
                <li className="p-4 text-sm text-muted-foreground">{lang === "sv" ? "Inga träffar." : "No results."}</li>
              )}
              {search.data?.map((hit) => (
                <li key={hit.id}>
                  <Link to="/barn/$childId" params={{ childId: hit.childId }} className="row block px-5 py-4">
                    <span className="block font-medium [overflow-wrap:anywhere]">{hit.title}</span>
                    <span className="block truncate text-sm text-muted-foreground">{hit.detail}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {adding && (
          <form
            className="surface pop mt-6 grid gap-4 p-6 sm:grid-cols-[1fr_auto_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              addChild.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="child-name">{t("children.name")}</Label>
              <Input
                id="child-name"
                autoFocus
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("children.namePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="child-birth">{t("children.birth")}</Label>
              <Input
                id="child-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={addChild.isPending}>
              {t("children.createFolder")}
            </Button>
          </form>
        )}

        <section className="mt-8 grid gap-3 sm:grid-cols-2">
          {children.isLoading && (
            <>
              <span className="sr-only" role="status">{t("children.loading")}</span>
              <div className="surface h-[5.5rem] animate-pulse" />
              <div className="surface h-[5.5rem] animate-pulse" />
            </>
          )}
          {children.error && (
            <p className="surface p-6 text-sm text-destructive sm:col-span-2" role="alert">{t("common.error")}</p>
          )}
          {children.data?.length === 0 && !adding && (
            <div className="surface rise p-10 text-center sm:col-span-2">
              <span className="mx-auto grid size-14 place-content-center rounded-full bg-accent/15 text-accent">
                <FolderHeart className="size-7" aria-hidden />
              </span>
              <h2 className="mt-4 text-2xl">{t("children.emptyTitle")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t("children.emptyText")}</p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                <Button asChild variant="pop">
                  <Link to="/snabbstart">
                    {lang === "sv" ? "Kom igång på en minut" : "Get started in a minute"}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button variant="outline" onClick={() => setAdding(true)}>
                  <Plus aria-hidden />
                  {t("children.new")}
                </Button>
              </div>
            </div>
          )}
          {children.data?.filter((c) => !term.trim() || c.name.toLowerCase().includes(term.trim().toLowerCase())).map((child, i) => (
            <Link
              key={child.id}
              to="/barn/$childId"
              params={{ childId: child.id }}
              style={{ "--i": Math.min(i, 8) + 2 } as React.CSSProperties}
              className="group surface rise liftable flex items-center gap-4 p-5"
            >
              <span className="grid size-12 shrink-0 place-content-center rounded-full bg-accent/15 text-lg font-semibold text-accent transition-[background-color,color,transform] duration-200 ease-out group-hover:scale-105 group-hover:bg-accent group-hover:text-accent-foreground" aria-hidden>
                {child.name.trim().charAt(0).toUpperCase()}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xl font-semibold tracking-tight">{child.name}</span>
                {child.user_id !== me.data && familyOf(child.user_id) && (
                  <span className="block truncate text-xs font-medium text-accent">
                    {t("family.sharedBy")} {familyOf(child.user_id)!.name}
                  </span>
                )}
                <span className="block text-sm text-muted-foreground">
                  {child.birth_date
                    ? `${t("children.born")} ${new Date(child.birth_date).toLocaleDateString(locale)}`
                    : t("children.noBirth")}
                </span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground transition-[transform,color] duration-200 ease-out group-hover:translate-x-1 group-hover:text-accent" aria-hidden />
            </Link>
          ))}
          {!!children.data?.length && !term.trim() && !adding && (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="group dropzone flex min-h-[5.5rem] cursor-pointer items-center justify-center gap-3 p-5 font-medium text-muted-foreground hover:text-accent"
            >
              <span className="grid size-10 place-content-center rounded-full bg-accent/12 text-accent transition-[background-color,color,transform] duration-200 ease-out group-hover:rotate-90 group-hover:bg-accent group-hover:text-accent-foreground">
                <Plus className="size-5" aria-hidden />
              </span>
              {t("children.new")}
            </button>
          )}
        </section>

        <p className="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4" aria-hidden />
          {t("children.privacy")}
        </p>
      </main>
    </div>
  );
}

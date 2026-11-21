import { PrivateGate } from "@/components/PrivateGate";
import { CalendarLink } from "@/components/CalendarLink";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Check,
  CloudUpload,
  Download,
  FileText,
  LoaderCircle,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { AskBar } from "@/components/AskBar";
import { Loader } from "@/components/Brand";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { askAssistant } from "@/lib/assistant.functions";
import { canUseApp } from "@/lib/app-access";
import { canEdit, useFolderRole } from "@/lib/family";
import { usePrefs, type TranslationKey } from "@/lib/prefs";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/barn/$childId")({
  head: () => ({
    meta: [
      { title: "Barnets mapp – Barnmappen" },
      {
        name: "description",
        content:
          "All information om barnet: personuppgifter, kontaktuppgifter, kalender och aktiviteter, dokument, egen information och AI-assistent.",
      },
      { property: "og:title", content: "Barnets mapp – Barnmappen" },
      { property: "og:description", content: "All information om barnet på ett ställe." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <PrivateGate>
      <ChildFolder />
    </PrivateGate>
  ),
});

const BUCKET = "child-documents";

// Delete buttons stay quiet until pointed at, then turn red.
const trashButton = "shrink-0 text-muted-foreground hover:bg-destructive/10 hover:text-destructive";

const dateTime = (value: string, locale: string) =>
  new Date(value).toLocaleString(locale, { dateStyle: "medium", timeStyle: "short" });

function fileSize(bytes: number, locale: string) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} kB`;
  return `${(bytes / (1024 * 1024)).toLocaleString(locale, { maximumFractionDigits: 1 })} MB`;
}

function ChildFolder() {
  const { childId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, locale } = usePrefs();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const child = useQuery({
    queryKey: ["child", childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("*")
        .eq("id", childId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const entries = useQuery({
    queryKey: ["entries", childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entries")
        .select("*")
        .eq("child_id", childId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const tasks = useQuery({
    queryKey: ["tasks", childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select("*")
        .eq("child_id", childId)
        .order("done", { ascending: true })
        .order("due_at", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const documents = useQuery({
    queryKey: ["documents", childId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("child_id", childId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // The browser tab and the installed app's window carry the child's name.
  const childName = child.data?.name;
  useEffect(() => {
    if (childName) document.title = `${childName} – Barnmappen`;
  }, [childName]);

  // Members of a shared family may read (viewer) or also change (editor). The database enforces it;
  // this only hides what they cannot use.
  const folder = useFolderRole(child.data?.user_id);
  const editable = canEdit(folder.role);
  const owner = folder.role === "owner";

  async function exportFolder() {
    if (!(await canUseApp(supabase))) { toast.error("Åtkomst pausad / Access paused"); return; }
    const payload = {
      exportedAt: new Date().toISOString(),
      child: child.data,
      entries: entries.data ?? [],
      tasks: tasks.data ?? [],
      documents: (documents.data ?? []).map((d) => ({ name: d.name, created_at: d.created_at })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `barnmapp-${child.data?.name ?? "barn"}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success(t("folder.backupDone"));
  }

  async function deleteChild() {
    const { error } = await supabase.from("children").delete().eq("id", childId);
    if (error) {
      toast.error(error.message);
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["children"] });
    navigate({ to: "/barn" });
  }

  if (child.isLoading) {
    return (
      <div className="min-h-dvh">
        <AppHeader />
        <Loader label={t("folder.loading")} />
      </div>
    );
  }

  if (!child.data) {
    return (
      <div className="min-h-dvh">
        <AppHeader />
        <div className="surface rise mx-auto mt-10 max-w-sm p-8 text-center">
          <h1 className="text-2xl">{t("folder.missing")}</h1>
          <Button asChild className="mt-4">
            <Link to="/barn">{t("folder.toChildren")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <Link
          to="/barn"
          className="group pressable -ml-3 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm text-muted-foreground hover:bg-foreground/6 hover:text-foreground"
        >
          <ArrowLeft className="size-4 transition-transform duration-200 ease-out group-hover:-translate-x-0.5" aria-hidden />
          {t("nav.myChildren")}
        </Link>

        <div className="rise mt-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid size-14 shrink-0 place-content-center rounded-full bg-accent/15 text-2xl font-semibold text-accent" aria-hidden>
              {child.data.name.trim().charAt(0).toUpperCase()}
            </span>
            <div className="min-w-0">
              <h1 className="truncate text-4xl sm:text-5xl">{child.data.name}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {child.data.birth_date
                  ? `${t("children.born")} ${new Date(child.data.birth_date).toLocaleDateString(locale)}`
                  : t("children.noBirth")}
              </p>
              {folder.family && (
                <p className="mt-1 text-xs font-medium text-accent">
                  {t("family.sharedBy")} {folder.family} · {folder.role === "viewer" ? t("family.viewer") : t("family.editor")}
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {editable && (
              <Button variant="outline" onClick={exportFolder}>
                <Download aria-hidden />
                {t("folder.backup")}
              </Button>
            )}
            {owner && (
              <Button variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setConfirmDelete(true)}>
                <Trash2 aria-hidden />
                {t("folder.delete")}
              </Button>
            )}
          </div>
        </div>
        <ConfirmDialog
          open={confirmDelete}
          onOpenChange={setConfirmDelete}
          title={t("folder.deleteConfirm")}
          description={t("folder.deleteHelp")}
          confirmLabel={t("folder.delete")}
          cancelLabel={t("common.cancel")}
          onConfirm={deleteChild}
        />

        <Assistant childId={childId} childName={child.data.name} />

        <Tabs defaultValue="person" className="mt-8">
          <TabsList>
            <TabsTrigger value="person">{t("tab.person")}</TabsTrigger>
            <TabsTrigger value="contacts">{t("tab.contacts")}</TabsTrigger>
            <TabsTrigger value="calendar">{t("tab.calendar")}</TabsTrigger>
            <TabsTrigger value="documents">{t("tab.documents")}</TabsTrigger>
            <TabsTrigger value="custom">{t("tab.custom")}</TabsTrigger>
          </TabsList>

          <TabsContent value="person">
            <InfoForm child={child.data} editable={editable} />
          </TabsContent>
          <TabsContent value="contacts">
            <Entries
              editable={editable}
              childId={childId}
              category="contacts"
              entries={(entries.data ?? []).filter((e) => e.category === "contacts")}
              titlePlaceholder="contacts.titlePlaceholder"
              contentPlaceholder="contacts.contentPlaceholder"
            />
          </TabsContent>
          <TabsContent value="calendar">
            {owner && <CalendarLink childId={childId} />}
            <Entries
              editable={editable}
              childId={childId}
              category="calendar"
              entries={(entries.data ?? []).filter((e) => e.category === "calendar")}
              titlePlaceholder="calendar.titlePlaceholder"
              contentPlaceholder="calendar.contentPlaceholder"
            />
            <h2 className="mt-10 text-2xl">{t("tasks.heading")}</h2>
            <TaskList childId={childId} tasks={tasks.data ?? []} editable={editable} />
          </TabsContent>
          <TabsContent value="documents">
            <Documents childId={childId} ownerId={child.data.user_id} documents={documents.data ?? []} editable={editable} />
          </TabsContent>
          <TabsContent value="custom">
            <Entries
              editable={editable}
              childId={childId}
              category="custom"
              entries={(entries.data ?? []).filter(
                (e) => e.category !== "contacts" && e.category !== "calendar",
              )}
              titlePlaceholder="custom.titlePlaceholder"
              contentPlaceholder="custom.contentPlaceholder"
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

type Child = {
  id: string;
  name: string;
  birth_date: string | null;
  personal_number: string | null;
  blood_type: string | null;
  allergies: string | null;
  medications: string | null;
  care_contacts: string | null;
  notes: string | null;
  clothing_size: string | null;
  shoe_size: string | null;
  passport_number: string | null;
  passport_expiry: string | null;
  school: string | null;
  school_class: string | null;
};

function Assistant({ childId, childName }: { childId: string; childName: string }) {
  const ask = useServerFn(askAssistant);
  const { t, lang } = usePrefs();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (question.trim().length < 2) return;
    setLoading(true);
    setAnswer(null);
    try {
      const result = await ask({ data: { childId, question: question.trim(), lang } });
      setAnswer(result.answer);
    } catch {
      toast.error(t("ai.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="surface rise mt-8 p-6 [--i:1]">
      <h2 className="flex items-center gap-3 text-2xl">
        <span className="grid size-9 shrink-0 place-content-center rounded-full bg-accent/15 text-accent">
          <Sparkles className="size-4.5" aria-hidden />
        </span>
        {t("ai.heading")} {childName}
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">{t("ai.lead")}</p>
      <div className="mt-4">
        <AskBar
          value={question}
          onChange={setQuestion}
          onSubmit={() => void submit()}
          placeholder={t("ai.placeholder")}
          label={t("ai.ask")}
          loading={loading}
        />
      </div>
      <div aria-live="polite">
        {loading && <p className="mt-4 animate-pulse text-sm text-muted-foreground">{t("ai.thinking")}</p>}
        {answer && <p className="well pop mt-4 p-4 text-[15px] whitespace-pre-wrap">{answer}</p>}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">{t("ai.disclaimer")}</p>
    </section>
  );
}

function InfoForm({ child, editable }: { child: Child; editable: boolean }) {
  const queryClient = useQueryClient();
  const { t } = usePrefs();
  const [form, setForm] = useState({
    name: child.name,
    birth_date: child.birth_date ?? "",
    personal_number: child.personal_number ?? "",
    blood_type: child.blood_type ?? "",
    allergies: child.allergies ?? "",
    medications: child.medications ?? "",
    notes: child.notes ?? "",
    clothing_size: child.clothing_size ?? "",
    shoe_size: child.shoe_size ?? "",
    passport_number: child.passport_number ?? "",
    passport_expiry: child.passport_expiry ?? "",
    school: child.school ?? "",
    school_class: child.school_class ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("children")
        .update({
          ...form,
          birth_date: form.birth_date || null,
          passport_expiry: form.passport_expiry || null,
        })
        .eq("id", child.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child", child.id] });
      queryClient.invalidateQueries({ queryKey: ["children"] });
      toast.success(t("folder.saved"));
    },
    onError: (error) => toast.error(error.message),
  });

  const field = (key: keyof typeof form, label: TranslationKey, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={key}>{t(label)}</Label>
      <Input
        id={key}
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  const area = (key: keyof typeof form, label: TranslationKey, placeholder: TranslationKey) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{t(label)}</Label>
      <Textarea
        id={key}
        rows={3}
        placeholder={t(placeholder)}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <form
      className="surface mt-4 space-y-5 p-6 sm:p-8"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <fieldset disabled={!editable} className="contents">
      <div className="grid gap-5 sm:grid-cols-2">
        {field("name", "person.name")}
        {field("birth_date", "person.birth", "date")}
        {field("personal_number", "person.personalNumber")}
        {field("blood_type", "person.blood")}
      </div>
      {area("allergies", "person.allergies", "person.allergiesPlaceholder")}
      {area("medications", "person.medications", "person.medicationsPlaceholder")}
      <h3 className="border-t border-border pt-6 text-xl">{t("person.practical")}</h3>
      <div className="grid gap-5 sm:grid-cols-2">
        {field("clothing_size", "person.clothing")}
        {field("shoe_size", "person.shoe")}
        {field("school", "person.school")}
        {field("school_class", "person.class")}
        {field("passport_number", "person.passport")}
        {field("passport_expiry", "person.passportExpiry", "date")}
      </div>
      {area("notes", "person.summary", "person.summaryPlaceholder")}
      {editable && (
        <Button type="submit" disabled={save.isPending}>
          {t("folder.save")}
        </Button>
      )}
      </fieldset>
    </form>
  );
}

type Entry = {
  id: string;
  category: string;
  title: string;
  content: string | null;
  updated_at: string;
};

function Entries({
  editable,
  childId,
  category,
  entries,
  titlePlaceholder,
  contentPlaceholder,
}: {
  editable: boolean;
  childId: string;
  category: string;
  entries: Entry[];
  titlePlaceholder: TranslationKey;
  contentPlaceholder: TranslationKey;
}) {
  const queryClient = useQueryClient();
  const { t } = usePrefs();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  // The entry stays set while the dialog closes, so its title doesn't blank out mid-animation.
  const [target, setTarget] = useState<Entry | null>(null);
  const [confirming, setConfirming] = useState(false);

  const add = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("entries").insert({
        user_id: userData.user!.id,
        child_id: childId,
        category,
        title: title.trim(),
        content: content.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setContent("");
      queryClient.invalidateQueries({ queryKey: ["entries", childId] });
      toast.success(t("entry.saved"));
    },
    onError: (error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["entries", childId] }),
    onError: () => toast.error(t("common.error")),
  });

  const [editing, setEditing] = useState<{ id: string; title: string; content: string } | null>(null);
  const update = useMutation({
    mutationFn: async (draft: { id: string; title: string; content: string }) => {
      const { error } = await supabase
        .from("entries")
        .update({ title: draft.title.trim(), content: draft.content.trim() || null })
        .eq("id", draft.id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditing(null);
      void queryClient.invalidateQueries({ queryKey: ["entries", childId] });
      toast.success(t("entry.saved"));
    },
    onError: () => toast.error(t("common.error")),
  });

  return (
    <div className="mt-4 space-y-4">
      {editable && (
      <form
        className="surface space-y-4 p-6"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor={`entry-title-${category}`}>{t("entry.title")}</Label>
          <Input
            id={`entry-title-${category}`}
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t(titlePlaceholder)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor={`entry-content-${category}`}>{t("entry.content")}</Label>
          <Textarea
            id={`entry-content-${category}`}
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={t(contentPlaceholder)}
          />
        </div>
        <Button type="submit" disabled={add.isPending}>
          <Plus className="size-4" aria-hidden />
          {t("entry.add")}
        </Button>
      </form>
      )}

      {entries.length === 0 && <p className="px-1 text-sm text-muted-foreground">{t("entry.empty")}</p>}
      {entries.length > 0 && (
      <div className="surface divide-y divide-border overflow-hidden">
      {entries.map((entry) =>
        editing?.id === entry.id ? (
          <form
            key={entry.id}
            className="space-y-3 bg-[var(--glass-field)] px-5 py-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (editing.title.trim()) update.mutate(editing);
            }}
            onKeyDown={(event) => {
              if (event.key === "Escape") setEditing(null);
            }}
          >
            <Input
              autoFocus
              required
              value={editing.title}
              onChange={(e) => setEditing({ ...editing, title: e.target.value })}
              aria-label={t("entry.title")}
            />
            <Textarea
              rows={3}
              value={editing.content}
              onChange={(e) => setEditing({ ...editing, content: e.target.value })}
              aria-label={t("entry.content")}
            />
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={update.isPending}>
                <Check aria-hidden />
                {t("folder.save")}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>
                {t("common.cancel")}
              </Button>
            </div>
          </form>
        ) : (
        <article key={entry.id} className="group/entry row flex items-start gap-2 px-5 py-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg [overflow-wrap:anywhere]">{entry.title}</h3>
            {entry.content && (
              <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">
                {entry.content}
              </p>
            )}
          </div>
          {editable && (
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-accent"
            aria-label={`${t("entry.edit")}: ${entry.title}`}
            title={t("entry.edit")}
            onClick={() => setEditing({ id: entry.id, title: entry.title, content: entry.content ?? "" })}
          >
            <Pencil className="size-4" aria-hidden />
          </Button>
          )}
          {editable && (
          <Button
            variant="ghost"
            size="icon"
            className={trashButton}
            aria-label={t("entry.remove")}
            onClick={() => {
              setTarget(entry);
              setConfirming(true);
            }}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
          )}
        </article>
        ),
      )}
      </div>
      )}
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`${t("entry.remove")} ”${target?.title ?? ""}”?`}
        description={t("entry.deleteHelp")}
        confirmLabel={t("entry.remove")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => {
          if (target) remove.mutate(target.id);
        }}
      />
    </div>
  );
}

type Task = { id: string; title: string; due_at: string | null; done: boolean };

function TaskList({ childId, tasks, editable }: { childId: string; tasks: Task[]; editable: boolean }) {
  const queryClient = useQueryClient();
  const { t, locale } = usePrefs();
  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["tasks", childId] });

  const add = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("tasks").insert({
        user_id: userData.user!.id,
        child_id: childId,
        title: title.trim(),
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setTitle("");
      setDueAt("");
      invalidate();
    },
    onError: (error) => toast.error(error.message),
  });

  const toggle = useMutation({
    mutationFn: async (task: Task) => {
      const { error } = await supabase
        .from("tasks")
        .update({ done: !task.done })
        .eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: () => toast.error(t("common.error")),
  });

  // A task goes at once, with a few seconds to take it back, instead of a dialog for every small item.
  const remove = useMutation({
    mutationFn: async (task: Task) => {
      const { error } = await supabase.from("tasks").delete().eq("id", task.id);
      if (error) throw error;
      return task;
    },
    onSuccess: (task) => {
      invalidate();
      toast(t("tasks.removed"), {
        description: task.title,
        action: {
          label: t("common.undo"),
          onClick: async () => {
            const { data: userData } = await supabase.auth.getUser();
            const { error } = await supabase.from("tasks").insert({
              user_id: userData.user!.id,
              child_id: childId,
              title: task.title,
              due_at: task.due_at,
              done: task.done,
            });
            if (error) toast.error(t("common.error"));
            invalidate();
          },
        },
      });
    },
    onError: () => toast.error(t("common.error")),
  });

  return (
    <div className="mt-4 space-y-4">
      {editable && (
      <form
        className="surface grid gap-4 p-6 sm:grid-cols-[1fr_14rem_auto] sm:items-end"
        onSubmit={(event) => {
          event.preventDefault();
          add.mutate();
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="task-title">{t("tasks.task")}</Label>
          <Input
            id="task-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("tasks.taskPlaceholder")}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-due">{t("tasks.due")}</Label>
          <Input
            id="task-due"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={add.isPending}>
          <Plus className="size-4" aria-hidden />
          {t("entry.add")}
        </Button>
      </form>
      )}

      {tasks.length === 0 && <p className="px-1 text-sm text-muted-foreground">{t("tasks.empty")}</p>}
      <ul className={tasks.length ? "surface divide-y divide-border overflow-hidden" : "hidden"}>
        {tasks.map((task) => {
          const overdue = !task.done && !!task.due_at && new Date(task.due_at).getTime() < Date.now();
          return (
            <li key={task.id} className="row flex items-center gap-3 px-5 py-3.5">
              <Checkbox
                checked={task.done}
                disabled={!editable}
                onCheckedChange={() => toggle.mutate(task)}
                aria-label={t("tasks.markDone")}
              />
              <span className="min-w-0 flex-1">
                <span className={`transition-opacity duration-200 ${task.done ? "line-through opacity-50" : ""}`}>{task.title}</span>
                {task.due_at && (
                  <span className={cn("block text-xs tabular-nums", overdue ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {overdue ? `${t("tasks.overdue")} · ` : `${t("tasks.dueShort")} `}
                    {dateTime(task.due_at, locale)}
                  </span>
                )}
              </span>
              {editable && (
                <Button
                  variant="ghost"
                  size="icon"
                  className={trashButton}
                  aria-label={t("entry.remove")}
                  onClick={() => remove.mutate(task)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

type Document = {
  id: string;
  name: string;
  storage_path: string;
  size_bytes: number | null;
  mime_type: string | null;
  created_at: string;
};

function Documents({
  childId,
  ownerId,
  documents,
  editable,
}: {
  childId: string;
  ownerId: string;
  documents: Document[];
  editable: boolean;
}) {
  const queryClient = useQueryClient();
  const { t, locale } = usePrefs();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  // The document stays set while the dialog closes, so its name doesn't blank out mid-animation.
  const [target, setTarget] = useState<Document | null>(null);
  const [confirming, setConfirming] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["documents", childId] });

  async function upload(file: File) {
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user!.id;
      // Files live in the folder owner's area, also when a family member uploads them.
      const path = `${ownerId}/${childId}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file);
      if (uploadError) throw uploadError;
      const { error } = await supabase.from("documents").insert({
        user_id: userId,
        child_id: childId,
        name: file.name,
        storage_path: path,
        mime_type: file.type || null,
        size_bytes: file.size,
      });
      if (error) throw error;
      invalidate();
      toast.success(t("docs.uploaded"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("docs.uploadFail"));
    } finally {
      setUploading(false);
    }
  }

  /** PDFs and pictures open in a new tab; anything else, or `save`, downloads the file. */
  async function open(doc: Document, save = false) {
    const viewable = !save && /^(application\/pdf|image\/|text\/plain)/.test(doc.mime_type ?? "");
    // The tab is opened right away, inside the click, so the browser does not block it as a pop-up.
    const tab = viewable ? window.open("", "_blank") : null;
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .download(doc.storage_path);
    if (error || !data) {
      tab?.close();
      toast.error(t("docs.openFail"));
      return;
    }
    const url = URL.createObjectURL(data);
    if (tab) {
      tab.location.href = url;
    } else {
      const link = document.createElement("a");
      link.href = url;
      link.download = doc.name;
      link.click();
    }
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  async function remove(doc: Document) {
    await supabase.storage.from(BUCKET).remove([doc.storage_path]);
    const { error } = await supabase.from("documents").delete().eq("id", doc.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    invalidate();
  }

  return (
    <div className="mt-4 space-y-4">
      {/* One target for both ways in: click to browse, or drop a file on it. */}
      {editable && (
      <label
        htmlFor="doc-upload"
        data-dragging={dragging || undefined}
        aria-busy={uploading}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file && !uploading) void upload(file);
        }}
        className={cn(
          "group dropzone flex flex-col items-center gap-2 px-6 py-8 text-center has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ring",
          uploading ? "cursor-progress" : "cursor-pointer",
        )}
      >
        <span className="grid size-12 place-content-center rounded-2xl bg-accent/12 text-accent transition-[background-color,color,transform] duration-200 ease-out group-hover:-translate-y-0.5 group-hover:bg-accent group-hover:text-accent-foreground group-data-[dragging]:-translate-y-0.5 group-data-[dragging]:bg-accent group-data-[dragging]:text-accent-foreground">
          {uploading ? (
            <LoaderCircle className="size-6 animate-spin" aria-hidden />
          ) : (
            <CloudUpload className="size-6" aria-hidden />
          )}
        </span>
        <span className="mt-1 font-medium">{uploading ? t("docs.uploading") : t("docs.drop")}</span>
        <span className="text-sm text-muted-foreground">{t("docs.uploadHelp")}</span>
        <input
          id="doc-upload"
          type="file"
          className="sr-only"
          disabled={uploading}
          aria-label={t("docs.upload")}
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) void upload(file);
            event.target.value = "";
          }}
        />
      </label>
      )}

      {documents.length === 0 && <p className="px-1 text-sm text-muted-foreground">{t("docs.empty")}</p>}
      <ul className={documents.length ? "surface divide-y divide-border overflow-hidden" : "hidden"}>
        {documents.map((doc) => (
          <li key={doc.id} className="row flex items-center gap-3 px-5 py-3.5">
            <span className="grid size-10 shrink-0 place-content-center rounded-xl bg-accent/15 text-accent">
              <FileText className="size-5" aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{doc.name}</span>
              <span className="block text-xs text-muted-foreground tabular-nums">
                {new Date(doc.created_at).toLocaleDateString(locale)}
                {doc.size_bytes ? ` · ${fileSize(doc.size_bytes, locale)}` : ""}
              </span>
            </span>
            <Button variant="outline" size="sm" className="shrink-0" onClick={() => void open(doc)}>
              {t("docs.open")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 text-muted-foreground hover:text-accent max-sm:hidden"
              aria-label={`${t("docs.download")}: ${doc.name}`}
              title={t("docs.download")}
              onClick={() => void open(doc, true)}
            >
              <Download className="size-4" aria-hidden />
            </Button>
            {editable && (
            <Button
              variant="ghost"
              size="icon"
              className={trashButton}
              aria-label={t("entry.remove")}
              onClick={() => {
                setTarget(doc);
                setConfirming(true);
              }}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
            )}
          </li>
        ))}
      </ul>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title={`${t("entry.remove")} ”${target?.name ?? ""}”?`}
        description={t("docs.deleteHelp")}
        confirmLabel={t("entry.remove")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => {
          if (target) void remove(target);
        }}
      />
    </div>
  );
}

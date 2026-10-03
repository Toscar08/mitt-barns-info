import { PrivateGate } from "@/components/PrivateGate";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  FileText,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Upload,
} from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { askAssistant } from "@/lib/assistant.functions";
import { usePrefs, type TranslationKey } from "@/lib/prefs";

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
    ],
  }),
  component: () => (
    <PrivateGate>
      <ChildFolder />
    </PrivateGate>
  ),
});

const BUCKET = "child-documents";

function ChildFolder() {
  const { childId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t, locale } = usePrefs();

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

  async function exportFolder() {
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
    if (!window.confirm(t("folder.deleteConfirm"))) return;
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
      <div className="min-h-screen">
        <AppHeader />
        <p className="mx-auto max-w-5xl px-6 py-10 text-sm text-muted-foreground">
          {t("folder.loading")}
        </p>
      </div>
    );
  }

  if (!child.data) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="mx-auto max-w-5xl px-6 py-10">
          <h1 className="text-3xl">{t("folder.missing")}</h1>
          <Button asChild className="mt-4">
            <Link to="/barn">{t("folder.toChildren")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <Link
          to="/barn"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t("nav.myChildren")}
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl">{child.data.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {child.data.birth_date
                ? `${t("children.born")} ${new Date(child.data.birth_date).toLocaleDateString(locale)}`
                : t("children.noBirth")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportFolder}>
              <Download className="size-4" aria-hidden />
              {t("folder.backup")}
            </Button>
            <Button variant="ghost" onClick={deleteChild}>
              <Trash2 className="size-4" aria-hidden />
              {t("folder.delete")}
            </Button>
          </div>
        </div>

        <Assistant childId={childId} childName={child.data.name} />

        <Tabs defaultValue="person" className="mt-8">
          <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap [scrollbar-width:none] sm:w-auto">
            <TabsTrigger value="person">{t("tab.person")}</TabsTrigger>
            <TabsTrigger value="contacts">{t("tab.contacts")}</TabsTrigger>
            <TabsTrigger value="calendar">{t("tab.calendar")}</TabsTrigger>
            <TabsTrigger value="documents">{t("tab.documents")}</TabsTrigger>
            <TabsTrigger value="custom">{t("tab.custom")}</TabsTrigger>
          </TabsList>

          <TabsContent value="person">
            <InfoForm child={child.data} />
          </TabsContent>
          <TabsContent value="contacts">
            <Entries
              childId={childId}
              category="contacts"
              entries={(entries.data ?? []).filter((e) => e.category === "contacts")}
              titlePlaceholder="contacts.titlePlaceholder"
              contentPlaceholder="contacts.contentPlaceholder"
            />
          </TabsContent>
          <TabsContent value="calendar">
            <Entries
              childId={childId}
              category="calendar"
              entries={(entries.data ?? []).filter((e) => e.category === "calendar")}
              titlePlaceholder="calendar.titlePlaceholder"
              contentPlaceholder="calendar.contentPlaceholder"
            />
            <h2 className="mt-8 text-2xl">{t("tasks.heading")}</h2>
            <TaskList childId={childId} tasks={tasks.data ?? []} />
          </TabsContent>
          <TabsContent value="documents">
            <Documents childId={childId} documents={documents.data ?? []} />
          </TabsContent>
          <TabsContent value="custom">
            <Entries
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

  async function submit(event: React.FormEvent) {
    event.preventDefault();
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
    <section className="surface mt-8 p-6">
      <h2 className="flex items-center gap-2 text-2xl">
        <Sparkles className="size-5 text-accent" aria-hidden />
        {t("ai.heading")} {childName}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">{t("ai.lead")}</p>
      <form onSubmit={submit} className="mt-4 flex flex-wrap gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("ai.placeholder")}
          className="min-w-56 flex-1"
        />
        <Button type="submit" disabled={loading}>
          <Send className="size-4" aria-hidden />
          {loading ? t("ai.thinking") : t("ai.ask")}
        </Button>
      </form>
      {answer && (
        <p className="mt-4 rounded-xl bg-secondary p-4 text-sm whitespace-pre-wrap text-secondary-foreground">
          {answer}
        </p>
      )}
    </section>
  );
}

function InfoForm({ child }: { child: Child }) {
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
      className="surface mt-4 space-y-5 p-6"
      onSubmit={(event) => {
        event.preventDefault();
        save.mutate();
      }}
    >
      <div className="grid gap-5 sm:grid-cols-2">
        {field("name", "person.name")}
        {field("birth_date", "person.birth", "date")}
        {field("personal_number", "person.personalNumber")}
        {field("blood_type", "person.blood")}
      </div>
      {area("allergies", "person.allergies", "person.allergiesPlaceholder")}
      {area("medications", "person.medications", "person.medicationsPlaceholder")}
      <h3 className="pt-2 text-xl">{t("person.practical")}</h3>
      <div className="grid gap-5 sm:grid-cols-2">
        {field("clothing_size", "person.clothing")}
        {field("shoe_size", "person.shoe")}
        {field("school", "person.school")}
        {field("school_class", "person.class")}
        {field("passport_number", "person.passport")}
        {field("passport_expiry", "person.passportExpiry", "date")}
      </div>
      {area("notes", "person.summary", "person.summaryPlaceholder")}
      <Button type="submit" disabled={save.isPending}>
        {t("folder.save")}
      </Button>
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
  childId,
  category,
  entries,
  titlePlaceholder,
  contentPlaceholder,
}: {
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
  });

  return (
    <div className="mt-4 space-y-4">
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

      {entries.length === 0 && <p className="text-sm text-muted-foreground">{t("entry.empty")}</p>}
      {entries.map((entry) => (
        <article key={entry.id} className="surface flex items-start justify-between gap-4 p-5">
          <div>
            <h3 className="text-xl">{entry.title}</h3>
            {entry.content && (
              <p className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">
                {entry.content}
              </p>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("entry.remove")}
            onClick={() => remove.mutate(entry.id)}
          >
            <Trash2 className="size-4" aria-hidden />
          </Button>
        </article>
      ))}
    </div>
  );
}

type Task = { id: string; title: string; due_at: string | null; done: boolean };

function TaskList({ childId, tasks }: { childId: string; tasks: Task[] }) {
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
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tasks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
  });

  return (
    <div className="mt-4 space-y-4">
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
          {t("entry.add")}
        </Button>
      </form>

      {tasks.length === 0 && <p className="text-sm text-muted-foreground">{t("tasks.empty")}</p>}
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="surface flex items-center gap-3 p-4">
            <Checkbox
              checked={task.done}
              onCheckedChange={() => toggle.mutate(task)}
              aria-label={t("tasks.markDone")}
            />
            <span className="flex-1">
              <span className={task.done ? "line-through opacity-60" : ""}>{task.title}</span>
              {task.due_at && (
                <span className="block text-xs text-muted-foreground">
                  {t("tasks.dueShort")} {new Date(task.due_at).toLocaleString(locale)}
                </span>
              )}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("entry.remove")}
              onClick={() => remove.mutate(task.id)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

type Document = {
  id: string;
  name: string;
  storage_path: string;
  size_bytes: number | null;
  created_at: string;
};

function Documents({ childId, documents }: { childId: string; documents: Document[] }) {
  const queryClient = useQueryClient();
  const { t, locale } = usePrefs();
  const [uploading, setUploading] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["documents", childId] });

  async function upload(file: File) {
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user!.id;
      const path = `${userId}/${childId}/${crypto.randomUUID()}-${file.name}`;
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

  async function open(doc: Document) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data) {
      toast.error(t("docs.openFail"));
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener");
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
      <div className="surface p-6">
        <Label htmlFor="doc-upload">{t("docs.upload")}</Label>
        <p className="mt-1 text-sm text-muted-foreground">{t("docs.uploadHelp")}</p>
        <div className="mt-4 flex items-center gap-3">
          <Input
            id="doc-upload"
            type="file"
            disabled={uploading}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = "";
            }}
          />
          <Upload className="size-4 text-muted-foreground" aria-hidden />
        </div>
      </div>

      {documents.length === 0 && <p className="text-sm text-muted-foreground">{t("docs.empty")}</p>}
      <ul className="space-y-2">
        {documents.map((doc) => (
          <li key={doc.id} className="surface flex items-center gap-3 p-4">
            <FileText className="size-5 text-accent" aria-hidden />
            <span className="flex-1">
              <span className="block">{doc.name}</span>
              <span className="block text-xs text-muted-foreground">
                {new Date(doc.created_at).toLocaleDateString(locale)}
                {doc.size_bytes ? ` · ${Math.round(doc.size_bytes / 1024)} kB` : ""}
              </span>
            </span>
            <Button variant="outline" size="sm" onClick={() => open(doc)}>
              {t("docs.open")}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("entry.remove")}
              onClick={() => remove(doc)}
            >
              <Trash2 className="size-4" aria-hidden />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

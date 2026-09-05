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

export const Route = createFileRoute("/_authenticated/barn/$childId")({
  head: () => ({
    meta: [
      { title: "Barnets mapp – Barnmappen" },
      {
        name: "description",
        content:
          "All information om barnet: basinfo och hälsa, dokument, anteckningar, uppgifter och AI-assistent.",
      },
      { property: "og:title", content: "Barnets mapp – Barnmappen" },
      { property: "og:description", content: "All information om barnet på ett ställe." },
    ],
  }),
  component: ChildFolder,
});

const BUCKET = "child-documents";

function ChildFolder() {
  const { childId } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
    toast.success("Säkerhetskopian är nedladdad");
  }

  async function deleteChild() {
    if (!window.confirm("Ta bort hela mappen och all information om barnet?")) return;
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
        <p className="mx-auto max-w-5xl px-6 py-10 text-sm text-muted-foreground">Hämtar…</p>
      </div>
    );
  }

  if (!child.data) {
    return (
      <div className="min-h-screen">
        <AppHeader />
        <div className="mx-auto max-w-5xl px-6 py-10">
          <h1 className="text-3xl">Mappen finns inte</h1>
          <Button asChild className="mt-4">
            <Link to="/barn">Till mina barn</Link>
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
          Mina barn
        </Link>

        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl">{child.data.name}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {child.data.birth_date
                ? `Född ${new Date(child.data.birth_date).toLocaleDateString("sv-SE")}`
                : "Födelsedatum saknas"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={exportFolder}>
              <Download className="size-4" aria-hidden />
              Säkerhetskopiera
            </Button>
            <Button variant="ghost" onClick={deleteChild}>
              <Trash2 className="size-4" aria-hidden />
              Ta bort mapp
            </Button>
          </div>
        </div>

        <Assistant childId={childId} childName={child.data.name} />

        <Tabs defaultValue="info" className="mt-8">
          <TabsList>
            <TabsTrigger value="info">Basinfo & hälsa</TabsTrigger>
            <TabsTrigger value="notes">Anteckningar</TabsTrigger>
            <TabsTrigger value="tasks">Uppgifter</TabsTrigger>
            <TabsTrigger value="docs">Dokument</TabsTrigger>
          </TabsList>

          <TabsContent value="info">
            <InfoForm child={child.data} />
          </TabsContent>
          <TabsContent value="notes">
            <Entries childId={childId} entries={entries.data ?? []} />
          </TabsContent>
          <TabsContent value="tasks">
            <TaskList childId={childId} tasks={tasks.data ?? []} />
          </TabsContent>
          <TabsContent value="docs">
            <Documents childId={childId} documents={documents.data ?? []} />
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
};

function Assistant({ childId, childName }: { childId: string; childName: string }) {
  const ask = useServerFn(askAssistant);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (question.trim().length < 2) return;
    setLoading(true);
    setAnswer(null);
    try {
      const result = await ask({ data: { childId, question: question.trim() } });
      setAnswer(result.answer);
    } catch {
      toast.error("Assistenten kunde inte svara just nu");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="surface mt-8 p-6">
      <h2 className="flex items-center gap-2 text-2xl">
        <Sparkles className="size-5 text-accent" aria-hidden />
        Fråga om {childName}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Assistenten svarar utifrån det du själv har lagt in i mappen.
      </p>
      <form onSubmit={submit} className="mt-4 flex flex-wrap gap-2">
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="När börjar fotbollsträningen?"
          className="min-w-56 flex-1"
        />
        <Button type="submit" disabled={loading}>
          <Send className="size-4" aria-hidden />
          {loading ? "Tänker…" : "Fråga"}
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
  const [form, setForm] = useState({
    name: child.name,
    birth_date: child.birth_date ?? "",
    personal_number: child.personal_number ?? "",
    blood_type: child.blood_type ?? "",
    allergies: child.allergies ?? "",
    medications: child.medications ?? "",
    care_contacts: child.care_contacts ?? "",
    notes: child.notes ?? "",
  });

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("children")
        .update({ ...form, birth_date: form.birth_date || null })
        .eq("id", child.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["child", child.id] });
      queryClient.invalidateQueries({ queryKey: ["children"] });
      toast.success("Sparat");
    },
    onError: (error) => toast.error(error.message),
  });

  const field = (key: keyof typeof form, label: string, type = "text") => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        type={type}
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
      />
    </div>
  );

  const area = (key: keyof typeof form, label: string, placeholder: string) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Textarea
        id={key}
        rows={3}
        placeholder={placeholder}
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
        {field("name", "Namn")}
        {field("birth_date", "Födelsedatum", "date")}
        {field("personal_number", "Personnummer")}
        {field("blood_type", "Blodgrupp")}
      </div>
      {area("allergies", "Allergier", "T.ex. nötter, pollen")}
      {area("medications", "Mediciner", "Namn, dos och när den ges")}
      {area("care_contacts", "Vårdkontakter", "Vårdcentral, tandläkare, telefonnummer")}
      {area("notes", "Övrig information", "Skola, storlekar, annat bra att minnas")}
      <Button type="submit" disabled={save.isPending}>
        Spara ändringar
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

const CATEGORIES = ["Allmänt", "Skola", "Aktiviteter", "Hälsa", "Kontakter"];

function Entries({ childId, entries }: { childId: string; entries: Entry[] }) {
  const queryClient = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]!);

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
      toast.success("Anteckningen är sparad");
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
        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <div className="space-y-2">
            <Label htmlFor="entry-title">Rubrik</Label>
            <Input
              id="entry-title"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="T.ex. Fotbollsträning"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="entry-category">Kategori</Label>
            <select
              id="entry-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
            >
              {CATEGORIES.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="entry-content">Information</Label>
          <Textarea
            id="entry-content"
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Tisdagar 17:30 på Vallens IP, tränare Anna 070-123 45 67"
          />
        </div>
        <Button type="submit" disabled={add.isPending}>
          <Plus className="size-4" aria-hidden />
          Lägg till
        </Button>
      </form>

      {entries.length === 0 && (
        <p className="text-sm text-muted-foreground">Inga anteckningar än.</p>
      )}
      {entries.map((entry) => (
        <article key={entry.id} className="surface flex items-start justify-between gap-4 p-5">
          <div>
            <span className="text-xs tracking-wide text-accent uppercase">
              {entry.category}
            </span>
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
            aria-label="Ta bort anteckning"
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
          <Label htmlFor="task-title">Uppgift</Label>
          <Input
            id="task-title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Boka tandläkartid"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="task-due">Senast</Label>
          <Input
            id="task-due"
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
          />
        </div>
        <Button type="submit" disabled={add.isPending}>
          Lägg till
        </Button>
      </form>

      {tasks.length === 0 && <p className="text-sm text-muted-foreground">Inga uppgifter än.</p>}
      <ul className="space-y-2">
        {tasks.map((task) => (
          <li key={task.id} className="surface flex items-center gap-3 p-4">
            <Checkbox
              checked={task.done}
              onCheckedChange={() => toggle.mutate(task)}
              aria-label="Markera som klar"
            />
            <span className="flex-1">
              <span className={task.done ? "line-through opacity-60" : ""}>{task.title}</span>
              {task.due_at && (
                <span className="block text-xs text-muted-foreground">
                  Senast {new Date(task.due_at).toLocaleString("sv-SE")}
                </span>
              )}
            </span>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Ta bort uppgift"
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
      toast.success("Filen är uppladdad");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte ladda upp filen");
    } finally {
      setUploading(false);
    }
  }

  async function open(doc: Document) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(doc.storage_path, 60);
    if (error || !data) {
      toast.error("Kunde inte öppna filen");
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
        <Label htmlFor="doc-upload">Ladda upp dokument</Label>
        <p className="mt-1 text-sm text-muted-foreground">
          Intyg, betyg, kvitton eller foton. Max 25 MB per fil, lagras privat.
        </p>
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

      {documents.length === 0 && <p className="text-sm text-muted-foreground">Inga filer än.</p>}
      <ul className="space-y-2">
        {documents.map((doc) => (
          <li key={doc.id} className="surface flex items-center gap-3 p-4">
            <FileText className="size-5 text-accent" aria-hidden />
            <span className="flex-1">
              <span className="block">{doc.name}</span>
              <span className="block text-xs text-muted-foreground">
                {new Date(doc.created_at).toLocaleDateString("sv-SE")}
                {doc.size_bytes ? ` · ${Math.round(doc.size_bytes / 1024)} kB` : ""}
              </span>
            </span>
            <Button variant="outline" size="sm" onClick={() => open(doc)}>
              Öppna
            </Button>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Ta bort fil"
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

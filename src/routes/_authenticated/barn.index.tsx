import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Plus, Upload, ChevronRight, ShieldCheck } from "lucide-react";

import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

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
    ],
  }),
  component: ChildrenPage,
});

function ChildrenPage() {
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [adding, setAdding] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const children = useQuery({
    queryKey: ["children"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("children")
        .select("*")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const addChild = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) throw new Error("Du måste vara inloggad");
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
      toast.success("Mappen är skapad");
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
      if (!userId || !parsed.child?.["name"]) throw new Error("Filen kunde inte läsas");

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
        })
        .select()
        .single();
      if (error) throw error;

      if (parsed.entries?.length) {
        await supabase.from("entries").insert(
          parsed.entries.map((e) => ({
            user_id: userId,
            child_id: created.id,
            category: String(e["category"] ?? "allmant"),
            title: String(e["title"] ?? "Utan titel"),
            content: (e["content"] as string) ?? null,
          })),
        );
      }
      if (parsed.tasks?.length) {
        await supabase.from("tasks").insert(
          parsed.tasks.map((t) => ({
            user_id: userId,
            child_id: created.id,
            title: String(t["title"] ?? "Utan titel"),
            due_at: (t["due_at"] as string) ?? null,
            done: Boolean(t["done"]),
          })),
        );
      }
      queryClient.invalidateQueries({ queryKey: ["children"] });
      toast.success("Barnmappen är återställd");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Kunde inte återställa filen");
    }
  }

  return (
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl">Mina barn</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Varje barn har sin egen mapp med information, dokument och uppgifter.
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => fileRef.current?.click()}>
              <Upload className="size-4" aria-hidden />
              Återställ från fil
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
              Nytt barn
            </Button>
          </div>
        </div>

        {adding && (
          <form
            className="surface mt-6 grid gap-4 p-6 sm:grid-cols-[1fr_auto_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              addChild.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="child-name">Barnets namn</Label>
              <Input
                id="child-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="T.ex. Elsa"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="child-birth">Födelsedatum</Label>
              <Input
                id="child-birth"
                type="date"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={addChild.isPending}>
              Skapa mapp
            </Button>
          </form>
        )}

        <section className="mt-8 space-y-3">
          {children.isLoading && (
            <p className="text-sm text-muted-foreground">Hämtar dina mappar…</p>
          )}
          {children.data?.length === 0 && !adding && (
            <div className="surface p-10 text-center">
              <h2 className="text-2xl">Inga mappar än</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Skapa en mapp för ditt första barn för att komma igång.
              </p>
            </div>
          )}
          {children.data?.map((child) => (
            <Link
              key={child.id}
              to="/barn/$childId"
              params={{ childId: child.id }}
              className="surface flex items-center justify-between p-5 transition-colors hover:bg-secondary/60"
            >
              <span>
                <span className="block text-xl">{child.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {child.birth_date
                    ? `Född ${new Date(child.birth_date).toLocaleDateString("sv-SE")}`
                    : "Födelsedatum saknas"}
                </span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          ))}
        </section>

        <p className="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4" aria-hidden />
          Din information är privat. Du kan säkerhetskopiera och exportera varje mapp.
        </p>
      </main>
    </div>
  );
}

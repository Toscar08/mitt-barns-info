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
    ],
  }),
  component: ChildrenPage,
});

function ChildrenPage() {
  const queryClient = useQueryClient();
  const { t, locale } = usePrefs();
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
    <div className="min-h-screen">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-4xl">{t("children.title")}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t("children.lead")}</p>
          </div>
          <div className="flex gap-2">
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

        {adding && (
          <form
            className="surface mt-6 grid gap-4 p-6 sm:grid-cols-[1fr_auto_auto] sm:items-end"
            onSubmit={(event) => {
              event.preventDefault();
              addChild.mutate();
            }}
          >
            <div className="space-y-2">
              <Label htmlFor="child-name">{t("children.name")}</Label>
              <Input
                id="child-name"
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

        <section className="mt-8 space-y-3">
          {children.isLoading && (
            <p className="text-sm text-muted-foreground">{t("children.loading")}</p>
          )}
          {children.data?.length === 0 && !adding && (
            <div className="surface p-10 text-center">
              <h2 className="text-2xl">{t("children.emptyTitle")}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{t("children.emptyText")}</p>
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
                    ? `${t("children.born")} ${new Date(child.birth_date).toLocaleDateString(locale)}`
                    : t("children.noBirth")}
                </span>
              </span>
              <ChevronRight className="size-5 text-muted-foreground" aria-hidden />
            </Link>
          ))}
        </section>

        <p className="mt-10 flex items-center gap-2 text-xs text-muted-foreground">
          <ShieldCheck className="size-4" aria-hidden />
          {t("children.privacy")}
        </p>
      </main>
    </div>
  );
}

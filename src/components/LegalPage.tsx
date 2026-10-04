import { Link } from "@tanstack/react-router";
import { FolderHeart } from "lucide-react";

import { PrefToggles } from "@/components/PrefToggles";
import { SiteFooter } from "@/components/SiteFooter";

export type LegalSection = { h: string; p: string[] };

export function LegalPage({ title, updated, sections, note }: { title: string; updated: string; sections: LegalSection[]; note: string }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
        <Link to="/" className="flex items-center gap-2">
          <FolderHeart className="size-5 text-accent" aria-hidden />
          <span className="font-display text-xl">Barnmappen</span>
        </Link>
        <PrefToggles />
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">
        <h1 className="font-display text-4xl">{title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{updated}</p>
        <p className="mt-6 rounded-lg bg-secondary p-4 text-sm text-secondary-foreground">{note}</p>
        {sections.map((s) => (
          <section key={s.h} className="mt-8">
            <h2 className="text-2xl">{s.h}</h2>
            {s.p.map((p) => (
              <p key={p} className="mt-3 leading-relaxed text-muted-foreground">{p}</p>
            ))}
          </section>
        ))}
      </main>
      <SiteFooter />
    </div>
  );
}

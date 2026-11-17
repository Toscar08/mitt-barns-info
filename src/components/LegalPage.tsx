import { PublicHeader } from "@/components/Brand";
import { SiteFooter } from "@/components/SiteFooter";

export type LegalSection = { h: string; p: string[] };

export function LegalPage({
  title,
  updated,
  sections,
  note,
}: {
  title: string;
  updated: string;
  sections: LegalSection[];
  note: string;
}) {
  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <article className="surface rise p-6 sm:p-10">
          <h1 className="text-3xl sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{updated}</p>
          <p className="well mt-6 p-4 text-sm">{note}</p>
          {sections.map((s) => (
            <section key={s.h} className="mt-8">
              <h2 className="text-xl">{s.h}</h2>
              {s.p.map((p) => (
                <p key={p} className="mt-3 leading-relaxed text-muted-foreground">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}

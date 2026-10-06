import { createFileRoute, Link, Navigate } from "@tanstack/react-router";

import { PrivateGate, useWorkspace } from "@/components/PrivateGate";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/_authenticated/f/$slug")({
  head: () => ({
    meta: [
      { title: "Min privata sida – Barnmappen" },
      { name: "description", content: "Din privata Barnmappen-sida. Kräver alltid inloggning." },
      { property: "og:title", content: "Min privata sida – Barnmappen" },
      { property: "og:description", content: "Privat sida som kräver inloggning." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SlugEntry,
});

function SlugEntry() {
  const { slug } = Route.useParams();
  const workspace = useWorkspace();
  const { lang } = usePrefs();
  if (workspace.isLoading) return <div className="min-h-screen bg-background" />;
  if (workspace.data && workspace.data.slug !== slug) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p>{lang === "sv" ? "Den här sidan tillhör inte ditt konto." : "This site doesn't belong to your account."}</p>
        <Link to="/barn" className="text-accent underline">
          {lang === "sv" ? "Till min sida" : "Go to my site"}
        </Link>
      </main>
    );
  }
  return (
    <PrivateGate>
      <Navigate to="/fraga" replace />
    </PrivateGate>
  );
}

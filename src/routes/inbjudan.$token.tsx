import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, LoaderCircle, Users } from "lucide-react";
import { useEffect, useState } from "react";

import { PublicHeader } from "@/components/Brand";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { PENDING_INVITE_KEY } from "@/lib/family";
import { acceptInvite, previewInvite } from "@/lib/family.functions";
import { usePrefs } from "@/lib/prefs";


export const Route = createFileRoute("/inbjudan/$token")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Inbjudan – Barnmappen" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: InvitePage,
});

type Preview = Awaited<ReturnType<typeof previewInvite>>;

function InvitePage() {
  const { token } = Route.useParams();
  const { lang } = usePrefs();
  const sv = lang === "sv";
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const preview = useServerFn(previewInvite);
  const accept = useServerFn(acceptInvite);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [info, setInfo] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const valid = /^[0-9a-f]{64}$/.test(token);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  useEffect(() => {
    if (!signedIn || !valid) return;
    localStorage.removeItem(PENDING_INVITE_KEY);
    void preview({ data: { token } }).then(setInfo).catch(() => setInfo({ status: "invalid" }));
  }, [signedIn, valid, token, preview]);

  async function join() {
    setBusy(true);
    try {
      const result = await accept({ data: { token } });
      if (result.status === "ok") {
        await queryClient.invalidateQueries();
        void navigate({ to: "/barn", replace: true });
        return;
      }
      setInfo(result);
    } catch {
      setInfo({ status: "invalid" });
    } finally {
      setBusy(false);
    }
  }

  function signInFirst() {
    // Kept until after sign-in, also when Google sign-in leaves the page.
    localStorage.setItem(PENDING_INVITE_KEY, token);
    void navigate({ to: "/auth" });
  }

  const card = (body: React.ReactNode) => (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="mx-auto max-w-md px-4 pt-[min(10vh,5rem)] pb-16 sm:px-6">
        <div className="surface rise p-7 text-center sm:p-8">
          <span className="mx-auto grid size-14 place-content-center rounded-full bg-accent/15 text-accent">
            <Users className="size-6" aria-hidden />
          </span>
          {body}
        </div>
      </main>
    </div>
  );

  if (!valid || info?.status === "invalid") {
    return card(
      <>
        <h1 className="mt-5 text-2xl">{sv ? "Länken fungerar inte" : "This link doesn't work"}</h1>
        <p className="mt-3 text-muted-foreground">
          {sv ? "Den kan redan ha använts eller ha gått ut. Be om en ny inbjudan." : "It may have been used already or expired. Ask for a new invitation."}
        </p>
      </>,
    );
  }

  if (signedIn === false) {
    return card(
      <>
        <h1 className="mt-5 text-2xl">{sv ? "Du är inbjuden till en Barnmapp" : "You're invited to a Barnmappen"}</h1>
        <p className="mt-3 text-muted-foreground">
          {sv ? "Logga in eller skapa ett gratis konto för att se familjens barnmappar." : "Sign in or create a free account to see the family's folders."}
        </p>
        <Button size="lg" variant="pop" className="mt-6 w-full" onClick={signInFirst}>
          {sv ? "Fortsätt" : "Continue"}
          <ArrowRight aria-hidden />
        </Button>
      </>,
    );
  }

  if (!info) {
    return card(<LoaderCircle className="mx-auto mt-6 size-6 animate-spin text-muted-foreground" aria-label={sv ? "Laddar" : "Loading"} />);
  }

  if (info.status !== "ok") {
    return card(
      <>
        <h1 className="mt-5 text-2xl">{info.status === "own" ? (sv ? "Det här är din egen familj" : "This is your own family") : sv ? "Du är redan med" : "You're already in"}</h1>
        <Button asChild size="lg" className="mt-6 w-full">
          <Link to="/barn">{sv ? "Till barnmapparna" : "To the folders"}</Link>
        </Button>
      </>,
    );
  }

  return card(
    <>
      <h1 className="mt-5 text-2xl">
        {sv ? "Gå med i " : "Join "}
        <span className="text-accent">{info.family}</span>
      </h1>
      <p className="mt-3 text-muted-foreground">
        {info.role === "editor"
          ? sv
            ? "Du kommer att kunna se och ändra barnens mappar."
            : "You will be able to see and change the children's folders."
          : sv
            ? "Du kommer att kunna se barnens mappar, men inte ändra något."
            : "You will be able to see the children's folders, but not change anything."}
      </p>
      <Button size="lg" variant="pop" className="mt-6 w-full" onClick={() => void join()} disabled={busy}>
        {busy ? <LoaderCircle className="animate-spin" aria-hidden /> : null}
        {sv ? "Gå med" : "Join"}
      </Button>
    </>,
  );
}

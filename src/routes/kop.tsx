import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Check } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PublicHeader } from "@/components/Brand";
import { SiteFooter } from "@/components/SiteFooter";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getAccountAccess } from "@/lib/access.functions";
import { createStripeCheckout } from "@/lib/payments.functions";
import { usePrefs } from "@/lib/prefs";

export const Route = createFileRoute("/kop")({
  head: () => ({
    meta: [
      { title: "Köp Barnmappen – din privata barnsida" },
      { name: "description", content: "Köp åtkomst till din egen privata sida för dina barns information, dokument och kalender." },
      { property: "og:title", content: "Köp Barnmappen" },
      { property: "og:description", content: "Din egen privata sida för allt som rör dina barn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: BuyPage,
});

function BuyPage() {
  const { lang } = usePrefs();
  const sv = lang === "sv";
  const checkout = useServerFn(createStripeCheckout);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [agreeWithdrawal, setAgreeWithdrawal] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
  }, []);

  // Someone who already has access should not be offered to pay again.
  const fetchAccess = useServerFn(getAccountAccess);
  const access = useQuery({ queryKey: ["account-access"], queryFn: () => fetchAccess(), enabled: signedIn === true });
  const owned = access.data && ["paid", "complimentary"].includes(access.data.status);

  async function buy() {
    setBusy(true);
    try {
      const { url } = await checkout({ data: { origin: window.location.origin } });
      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error));
      setBusy(false);
    }
  }

  const features = sv
    ? ["Egen privat adress", "Obegränsat antal barnprofiler", "Dokument upp till 25 MB per fil", "AI-assistent som svarar utifrån din information", "Export och återställning", "PIN-lås och installation som app"]
    : ["Your own private address", "Unlimited child profiles", "Documents up to 25 MB each", "AI assistant answering from your info", "Export and restore", "PIN lock and installable app"];

  return (
    <div className="min-h-dvh">
      <PublicHeader />
      <main className="rise mx-auto max-w-xl px-4 py-10 sm:px-6">
        <h1 className="text-3xl sm:text-4xl">{sv ? "Skaffa din egen Barnmapp" : "Get your own Barnmappen"}</h1>
        <div className="surface mt-8 p-6 sm:p-8">
          <p className="text-4xl font-semibold tracking-tight tabular-nums">
            499 kr <span className="block pt-1 text-sm font-normal tracking-normal text-muted-foreground sm:inline sm:pt-0">{sv ? "engångsköp, inkl. 25 % moms" : "one-time purchase, incl. 25% VAT"}</span>
          </p>
          <ul className="mt-6 space-y-3">
            {features.map((f) => (
              <li key={f} className="group/f flex gap-3">
                <span className="mt-0.5 grid size-5 shrink-0 place-content-center rounded-full bg-accent/15 text-accent transition-[background-color,color,transform] duration-200 ease-out group-hover/f:scale-110 group-hover/f:bg-accent group-hover/f:text-accent-foreground"><Check className="size-3" strokeWidth={3} aria-hidden /></span>
                {f}
              </li>
            ))}
          </ul>

          <div className="well mt-6 p-4 text-sm">
            {sv
              ? "Betalningen hanteras säkert av Stripe. Åtkomsten öppnas automatiskt när betalningen är verifierad."
              : "Payment is handled securely by Stripe. Access opens automatically once your payment is verified."}
          </div>

          {owned ? (
            <div className="mt-6 space-y-3">
              <p className="flex items-center gap-2 font-medium">
                <span className="grid size-6 place-content-center rounded-full bg-accent text-accent-foreground"><Check className="size-3.5" strokeWidth={3} aria-hidden /></span>
                {sv ? "Du har redan full åtkomst." : "You already have full access."}
              </p>
              <Button asChild size="lg" className="w-full">
                <Link to="/barn">{sv ? "Till mina barn" : "To my children"}<ArrowRight aria-hidden /></Link>
              </Button>
            </div>
          ) : signedIn === false ? (
            <div className="mt-6 space-y-3">
              <p className="text-sm text-muted-foreground">
                {sv ? "Skapa först ett konto, sedan genomför du köpet." : "Create an account first, then complete the purchase."}
              </p>
              <Button asChild size="lg" variant="pop" className="w-full">
                <Link to="/auth">{sv ? "Skapa konto / logga in" : "Create account / sign in"}</Link>
              </Button>
            </div>
          ) : (
            <>
            <div className="mt-6 space-y-3 text-sm">
              <label className="flex cursor-pointer gap-3">
                <Checkbox checked={agreeTerms} onCheckedChange={(v) => setAgreeTerms(v === true)} className="mt-0.5" />
                <span>
                  {sv ? "Jag godkänner " : "I accept the "}
                  <Link to="/villkor" className="underline">{sv ? "villkoren" : "terms"}</Link>
                  {sv ? " och har läst " : " and have read the "}
                  <Link to="/integritetspolicy" className="underline">{sv ? "integritetspolicyn" : "privacy policy"}</Link>.
                </span>
              </label>
              <label className="flex cursor-pointer gap-3">
                <Checkbox checked={agreeWithdrawal} onCheckedChange={(v) => setAgreeWithdrawal(v === true)} className="mt-0.5" />
                <span>
                  {sv
                    ? "Jag samtycker till att tjänsten aktiveras direkt och bekräftar att min 14 dagars ångerrätt därmed upphör."
                    : "I agree that the service starts immediately and acknowledge that my 14-day right of withdrawal is thereby lost."}
                </span>
              </label>
            </div>
            <Button size="lg" variant="pop" className="mt-6 w-full" onClick={buy} disabled={busy || !agreeTerms || !agreeWithdrawal}>
              {sv ? "Betala 499 kr med Stripe" : "Pay 499 kr with Stripe"}
            </Button>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

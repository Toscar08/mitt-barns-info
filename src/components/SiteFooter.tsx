import { Link } from "@tanstack/react-router";

import { usePrefs } from "@/lib/prefs";

// Placeholder company details – replace with the real ones before launch.
export const COMPANY = {
  name: "[Bolagsnamn AB]",
  orgNr: "[556XXX-XXXX]",
  address: "[Gatuadress, postnummer ort]",
  email: "[support@barnmappen.se]",
};

export function SiteFooter() {
  const { lang } = usePrefs();
  const sv = lang === "sv";
  return (
    <footer className="mt-16 border-t border-border">
      <div className="mx-auto flex max-w-5xl flex-col gap-3 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
        <p>
          © {new Date().getFullYear()} {COMPANY.name} · {sv ? "Org.nr" : "Reg. no"} {COMPANY.orgNr} · {COMPANY.address} · {COMPANY.email}
        </p>
        <nav className="flex gap-4">
          <Link to="/villkor" className="hover:text-foreground">{sv ? "Villkor" : "Terms"}</Link>
          <Link to="/integritetspolicy" className="hover:text-foreground">{sv ? "Integritetspolicy" : "Privacy policy"}</Link>
        </nav>
      </div>
    </footer>
  );
}

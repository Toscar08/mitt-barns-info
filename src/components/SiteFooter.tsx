import { Link } from "@tanstack/react-router";

import { usePrefs } from "@/lib/prefs";

// Not yet a registered company – add org.nr/address here once one exists.
export const COMPANY = {
  name: "Barnmappen",
  email: "barnmappenab@gmail.com",
};

export function SiteFooter() {
  const { lang } = usePrefs();
  const sv = lang === "sv";
  return (
    <footer className="mt-16 px-3 pb-4 sm:px-6">
      <div className="glass mx-auto flex max-w-6xl flex-col gap-3 rounded-3xl px-6 py-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>
          © {new Date().getFullYear()} {COMPANY.name} · {sv ? "Sverige" : "Sweden"} ·{" "}
          <a href={`mailto:${COMPANY.email}`} className="link-line hover:text-foreground">
            {COMPANY.email}
          </a>
        </p>
        <nav className="flex gap-5">
          <Link to="/villkor" className="link-line hover:text-foreground">
            {sv ? "Villkor" : "Terms"}
          </Link>
          <Link to="/integritetspolicy" className="link-line hover:text-foreground">
            {sv ? "Integritetspolicy" : "Privacy policy"}
          </Link>
        </nav>
      </div>
    </footer>
  );
}

export const RESERVED_SLUGS = [
  "admin",
  "api",
  "auth",
  "app",
  "www",
  "login",
  "signup",
  "activate",
  "buy",
  "kop",
  "barn",
  "support",
  "help",
  "status",
  "static",
  "assets",
  "public",
  "settings",
  "account",
  "dashboard",
  "barnmappen",
  "root",
  "system",
  "security",
  "privacy",
  "terms",
];

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;

export function normalizeSlug(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[åä]/g, "a")
    .replace(/ö/g, "o")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30);
}

export type SlugProblem = "format" | "reserved" | null;

export function validateSlug(slug: string): SlugProblem {
  if (!SLUG_PATTERN.test(slug)) return "format";
  if (RESERVED_SLUGS.includes(slug)) return "reserved";
  return null;
}

/**
 * Keeps identifying details away from the AI provider. Before a request, children's names, phone
 * numbers, e-mail addresses, Swedish personal ID numbers and street addresses are swapped for
 * neutral placeholders such as [BARN1] or [TEL2]. The model answers with the placeholders, and the
 * server puts the real values back before the parent sees the answer. The provider therefore
 * learns that "a child" is allergic to nuts, but not who the child is or how to reach anyone.
 */
export class Redactor {
  private readonly byValue = new Map<string, string>();
  private readonly byToken = new Map<string, string>();
  private readonly counts = new Map<string, number>();

  private token(kind: string, value: string) {
    const key = `${kind}:${value.toLowerCase()}`;
    const known = this.byValue.get(key);
    if (known) return known;
    const n = (this.counts.get(kind) ?? 0) + 1;
    this.counts.set(kind, n);
    const token = `[${kind}${n}]`;
    this.byValue.set(key, token);
    this.byToken.set(token, value);
    return token;
  }

  /** Registers a child's name up front, so it gets the same placeholder everywhere. */
  child(name: string) {
    return this.token("BARN", name.trim());
  }

  /** Replaces every known name and every detected identifier in free text. */
  mask(text: string | null | undefined): string {
    if (!text) return "";
    let out = text;
    // Longest names first, so "Anna-Lena" is not half-replaced by "Anna".
    const names = [...this.byValue.entries()]
      .filter(([key]) => key.startsWith("BARN:"))
      .sort((a, b) => b[0].length - a[0].length);
    for (const [key, token] of names) {
      const name = key.slice("BARN:".length);
      const pattern = new RegExp(`(?<![\\p{L}\\d])${escapeRegExp(name)}(s)?(?![\\p{L}\\d])`, "giu");
      out = out.replace(pattern, (_match, genitive: string | undefined) => token + (genitive ? "s" : ""));
    }
    out = out.replace(EMAIL, (value) => this.token("EPOST", value));
    out = out.replace(PERSONAL_ID, (value) => this.token("PNR", value));
    out = out.replace(PHONE, (value) => this.token("TEL", value.trim()));
    out = out.replace(STREET, (value) => this.token("ADRESS", value));
    return out;
  }

  /** Puts the real values back. Placeholders the model invented are left out rather than shown. */
  restore(text: string): string {
    return text.replace(/\[(BARN|TEL|EPOST|PNR|ADRESS)\d+\]/g, (token) => this.byToken.get(token) ?? "");
  }
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g;
// ÅÅMMDD-NNNN or ÅÅÅÅMMDDNNNN, with or without the dash.
const PERSONAL_ID = /(?<!\d)(?:19|20)?\d{6}[-+ ]?\d{4}(?!\d)/g;
// Swedish and international numbers: 070-123 45 67, 08-123 456, +46 70 123 45 67.
const PHONE = /(?<![\d\w])(?:\+\d{1,3}[\s-]?\(?0?\d{1,3}\)?|\(?0\d{1,3}\)?)[\s-]?\d{2,4}(?:[\s-]?\d{2,4}){1,3}(?![\d\w])/g;
// "Storgatan 12", "Vallens väg 3B". The word must end like a street name.
const STREET = /(?<![\p{L}])[\p{Lu}][\p{L}-]*(?:gatan|vägen|väg|gränd|stigen|allén|torget|plan|backe|backen|street|road|avenue)\s+\d+\s?[A-Za-z]?(?![\p{L}\d])/gu;

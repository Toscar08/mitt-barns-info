/**
 * Fetches an address a user typed in (a calendar link) without letting it reach our own or other
 * private networks. A name is looked up first, and refused if any of its addresses is private,
 * local or reserved; redirects are followed by hand so every hop gets the same check.
 *
 * What remains: a name could in theory point somewhere else between the check and the fetch
 * (DNS rebinding). The hosting platform does not route requests to private networks, so this
 * check is the second of two layers, not the only one.
 */

const MAX_REDIRECTS = 3;
const MAX_BYTES = 3_000_000;
const TIMEOUT_MS = 10_000;

export class UnsafeUrlError extends Error {}

function ipv4Private(ip: string) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) return true;
  const [a, b] = parts as [number, number, number, number];
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) || // carrier-grade NAT
    (a === 169 && b === 254) || // link-local, cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224 // multicast and reserved
  );
}

function ipv6Private(ip: string) {
  const v = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (v === "::" || v === "::1") return true;
  const mapped = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Private(mapped[1]!);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v) || v.startsWith("64:ff9b:") || v.startsWith("2001:db8");
}

const isIpv4 = (host: string) => /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
const isIpv6 = (host: string) => host.includes(":");

/** Looks a name up over DNS-over-HTTPS, which works the same on every server platform. */
async function resolve(host: string) {
  const addresses: string[] = [];
  for (const type of ["A", "AAAA"] as const) {
    const res = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
      headers: { Accept: "application/dns-json" },
    });
    if (!res.ok) throw new UnsafeUrlError("Kunde inte slå upp adressen.");
    const json = (await res.json()) as { Answer?: { type: number; data: string }[] };
    for (const answer of json.Answer ?? []) {
      if (answer.type === 1 || answer.type === 28) addresses.push(answer.data);
    }
  }
  return addresses;
}

export async function assertPublicUrl(url: URL) {
  if (url.protocol !== "https:") throw new UnsafeUrlError("Länken måste börja med https:// eller webcal://");
  if (url.username || url.password) throw new UnsafeUrlError("Ogiltig kalenderlänk");
  if (url.port && url.port !== "443") throw new UnsafeUrlError("Ogiltig kalenderlänk");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!host.includes(".") || /\.(local|internal|localhost|lan|home|corp)$/.test(host) || host === "localhost") {
    throw new UnsafeUrlError("Ogiltig kalenderlänk");
  }
  if (isIpv4(host) || isIpv6(host)) {
    if (isIpv4(host) ? ipv4Private(host) : ipv6Private(host)) throw new UnsafeUrlError("Ogiltig kalenderlänk");
    return;
  }
  const addresses = await resolve(host);
  if (addresses.length === 0) throw new UnsafeUrlError("Adressen finns inte.");
  if (addresses.some((ip) => (isIpv4(ip) ? ipv4Private(ip) : ipv6Private(ip)))) {
    throw new UnsafeUrlError("Ogiltig kalenderlänk");
  }
}

/** Returns the body as text, at most MAX_BYTES, after checking the address and every redirect. */
export async function fetchPublicText(start: URL, accept: string) {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await assertPublicUrl(url);
    const res = await fetch(url.toString(), {
      redirect: "manual",
      headers: { Accept: accept },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) break;
      url = new URL(next, url);
      continue;
    }
    if (!res.ok) throw new Error("Kunde inte hämta kalendern. Kontrollera länken.");
    const length = Number(res.headers.get("content-length") ?? 0);
    if (length > MAX_BYTES) throw new Error("Kalendern är för stor.");
    return (await res.text()).slice(0, MAX_BYTES);
  }
  throw new Error("Kalenderlänken skickar vidare för många gånger.");
}

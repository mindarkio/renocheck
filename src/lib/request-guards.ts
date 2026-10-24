export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  );
}

export function sameOrigin(req: Request): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === new URL(req.url).host;
  } catch {
    return false;
  }
}

const NEXT_FALLBACK = "/account";
const NEXT_BASE = "https://next-path.invalid";

function hasControlOrBackslash(raw: string): boolean {
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (code <= 0x20 || code === 0x7f || code === 0x5c) return true;
  }
  return false;
}

/**
 * Same-site path only. URL parsing strips tab/CR/LF, so "/\t/host" would
 * become "//host"; reject control chars, spaces and backslashes, then
 * resolve against a fixed origin and keep only path, query and hash.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw || raw.length > 512) return NEXT_FALLBACK;
  if (hasControlOrBackslash(raw)) return NEXT_FALLBACK;
  if (!raw.startsWith("/") || raw.startsWith("//")) return NEXT_FALLBACK;
  let url: URL;
  try {
    url = new URL(raw, NEXT_BASE);
  } catch {
    return NEXT_FALLBACK;
  }
  if (url.origin !== NEXT_BASE) return NEXT_FALLBACK;
  return `${url.pathname}${url.search}${url.hash}`;
}

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

/** Same-site path only. Rejects protocol-relative and backslash tricks. */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/account";
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return "/account";
  }
  if (raw.includes("://")) return "/account";
  return raw;
}

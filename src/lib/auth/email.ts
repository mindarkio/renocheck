const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeLoginEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const email = raw.trim().toLowerCase();
  if (email.length < 3 || email.length > 254) return null;
  if (!EMAIL_RE.test(email)) return null;
  return email;
}

export function isSixDigitCode(raw: unknown): raw is string {
  return typeof raw === "string" && /^[0-9]{6}$/.test(raw);
}

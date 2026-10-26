/**
 * Allowlist for an untrusted absolute URL before it is placed in `<a href>`.
 *
 * Search hits keep their original URL through L1, the LLM payload, grading
 * counts, and public-link selection. Those steps are not display. Cached
 * reports stay on REPORT_VERSION 2.7.0, so a non-http(s) URL can already be
 * in the JSON. The render sites call this again, and that is what stops a
 * clickable link.
 *
 * The raw string is not trimmed. The URL parser strips leading C0 controls
 * and spaces, so `"\njavascript:"` and `"\u0000javascript:"` are still
 * `javascript:` after parsing. A control-prefixed `https:` URL is also
 * rejected rather than copied into `href` with the prefix left on.
 */
const DISALLOWED_IN_HREF =
  /[\u0000-\u001F\u007F\u0020\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/u;

export function safeHttpUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  if (DISALLOWED_IN_HREF.test(value)) return null;
  if (!/^https?:\/\//i.test(value)) return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  return value;
}

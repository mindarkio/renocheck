const ALLOWED = new Set([
  "event",
  "surface",
  "placement",
  "rating",
  "code",
  "status",
]);

/** Allowlisted fields only. Drops comment, cookie, IP, and anything else. */
export function logFeedback(
  fields: Record<string, string | number | boolean | null | undefined>,
): void {
  const line: Record<string, string | number | boolean> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!ALLOWED.has(key) || value === undefined || value === null) continue;
    line[key] = value;
  }
  console.info(JSON.stringify(line));
}

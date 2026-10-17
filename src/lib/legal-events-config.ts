/** DEC-0012 — production needs LEGAL_EVENTS_ENABLED=1; dev defaults on unless explicitly off. */
export function isLegalEventsEnabled(): boolean {
  const raw = process.env.LEGAL_EVENTS_ENABLED?.trim().toLowerCase();
  if (raw === "0" || raw === "false" || raw === "no") return false;
  if (raw === "1" || raw === "true" || raw === "yes") return true;
  return process.env.NODE_ENV === "development";
}

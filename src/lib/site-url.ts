/** Canonical production origin (apex, no www). */
export const PRODUCTION_SITE_URL = "https://renocheck.homes";

/**
 * Canonical site origin for metadata, sitemap, robots, JSON-LD.
 * Never falls back to per-deployment `VERCEL_URL` (would leak *.vercel.app canonicals).
 */
export function getSiteUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return PRODUCTION_SITE_URL;
}

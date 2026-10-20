/**
 * Refuse the hosted production database from any runtime that is not
 * Vercel production. The project ref is public (docs/supabase.md).
 */

export const PROD_SUPABASE_PROJECT_REF = "lvrasvtilgzwtfsfjbzd";

export function assertNotProdDbOutsideProd(
  env: Record<string, string | undefined> = process.env,
): void {
  const raw = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL || "";
  let host = raw;
  try {
    if (raw) host = new URL(raw).hostname;
  } catch {
    host = raw;
  }
  if (
    host.includes(PROD_SUPABASE_PROJECT_REF) &&
    env.VERCEL_ENV !== "production"
  ) {
    throw new Error("refusing_prod_db");
  }
}

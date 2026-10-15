import { unstable_cache } from "next/cache";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./supabase/admin";

export type LandingPublicStats = {
  mwcContractorCount: number;
  mwcSourceUpdatedAt: string | null;
};

async function fetchLandingPublicStats(): Promise<LandingPublicStats | null> {
  if (!isSupabaseAdminConfigured()) return null;

  const supabase = getSupabaseAdmin();
  if (!supabase) return null;

  const { count, error: countError } = await supabase
    .from("mwc_contractors")
    .select("*", { count: "exact", head: true });

  if (countError || count == null) return null;

  const { data: latestRow, error: latestError } = await supabase
    .from("mwc_contractors")
    .select("source_updated_at")
    .not("source_updated_at", "is", null)
    .order("source_updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    return { mwcContractorCount: count, mwcSourceUpdatedAt: null };
  }

  return {
    mwcContractorCount: count,
    mwcSourceUpdatedAt: latestRow?.source_updated_at ?? null,
  };
}

/** Cached public registry stats for landing (revalidate hourly). */
export const getLandingPublicStats = unstable_cache(
  fetchLandingPublicStats,
  ["landing-public-stats"],
  { revalidate: 3600 },
);

export function formatMwcRegistryUpdatedAt(iso: string): string {
  return new Date(iso).toLocaleDateString("zh-HK", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Hong_Kong",
  });
}

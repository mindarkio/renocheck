/**
 * D1 full-crawl page limits (offline LRS HTML only — D2 cleans relevance).
 */

export type D1FullCrawlConfig = {
  resultsPerPage: number;
  maxPagesCapPerProfile: number;
};

export const DEFAULT_D1_FULL_CRAWL: D1FullCrawlConfig = {
  resultsPerPage: 10,
  maxPagesCapPerProfile: 80,
};

export type ProfilePageInput = {
  maxPagesDefault?: number;
  observedHitsJu?: number;
};

/** Legacy PoC cap (first pages only). */
export const D1_POC_MAX_PAGES_HARD_CAP = 8;

export function resolveProfileMaxPages(
  profile: ProfilePageInput,
  maxPagesArg: string | null,
  crawl: D1FullCrawlConfig = DEFAULT_D1_FULL_CRAWL,
): number {
  if (maxPagesArg === "full") {
    const hits = profile.observedHitsJu;
    if (hits != null && hits > 0) {
      return Math.min(
        Math.ceil(hits / crawl.resultsPerPage),
        crawl.maxPagesCapPerProfile,
      );
    }
    return profile.maxPagesDefault ?? 8;
  }
  if (maxPagesArg === "profile") {
    return profile.maxPagesDefault ?? 8;
  }
  if (maxPagesArg) {
    const n = Number.parseInt(maxPagesArg, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return Math.min(profile.maxPagesDefault ?? 3, D1_POC_MAX_PAGES_HARD_CAP);
}

export function parseTierFilter(tierArg: string): Set<string> {
  return new Set(
    tierArg
      .split(",")
      .map((t) => t.trim().toUpperCase())
      .filter(Boolean),
  );
}

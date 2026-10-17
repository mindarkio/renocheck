import { stat } from "node:fs/promises";

/** Gitignored `.cache/cause-list/` snapshots (HTML, MWC JSON): refresh or delete after 7 days. */
export const CAUSE_LIST_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function assertCacheFileFresh(
  filePath: string,
  label = "cache file",
): Promise<void> {
  const st = await stat(filePath);
  const ageMs = Date.now() - st.mtimeMs;
  if (ageMs > CAUSE_LIST_CACHE_TTL_MS) {
    const days = Math.floor(ageMs / (24 * 60 * 60 * 1000));
    throw new Error(
      `${label} is older than 7 days (${days}d): ${filePath} — re-fetch or re-export`,
    );
  }
}

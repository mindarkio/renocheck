import { createHash } from "node:crypto";
import {
  normalizeChineseCompanyName,
  normalizeEnglishCompanyName,
} from "../cause-list/normalize";
import type { CrMappedSnapshot } from "./types";

const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 500;

type Entry = { expiresAt: number; snapshot: CrMappedSnapshot; touchedAt: number };

const store = new Map<string, Entry>();

export function crRegistryCacheKey(parts: {
  brnEqual?: string;
  namePrefixes?: string[];
  searchLabelUsed?: string;
}): string {
  const label = parts.searchLabelUsed?.trim() ?? "";
  const payload = JSON.stringify({
    brn: parts.brnEqual?.toUpperCase() ?? "",
    prefixes: (parts.namePrefixes ?? []).slice(0, 4),
    labelStrictEn: label
      ? normalizeEnglishCompanyName(label).normStrict
      : "",
    labelStrictZh: label
      ? normalizeChineseCompanyName(label).normStrict
      : "",
  });
  return createHash("sha256").update(payload).digest("hex");
}

function evictIfNeeded(): void {
  while (store.size >= MAX_ENTRIES) {
    let oldestKey: string | null = null;
    let oldest = Infinity;
    for (const [k, v] of store) {
      if (v.touchedAt < oldest) {
        oldest = v.touchedAt;
        oldestKey = k;
      }
    }
    if (!oldestKey) break;
    store.delete(oldestKey);
  }
}

export function getCrRegistryCached(key: string): CrMappedSnapshot | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    store.delete(key);
    return null;
  }
  e.touchedAt = Date.now();
  return e.snapshot;
}

export function setCrRegistryCached(
  key: string,
  snapshot: CrMappedSnapshot,
): void {
  evictIfNeeded();
  store.set(key, {
    expiresAt: Date.now() + TTL_MS,
    snapshot,
    touchedAt: Date.now(),
  });
}

export function clearCrRegistryCacheForTests(): void {
  store.clear();
}

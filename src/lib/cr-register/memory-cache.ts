import { createHash } from "node:crypto";
import type { CrMappedSnapshot } from "./types";

const TTL_MS = 10 * 60 * 1000;

type Entry = { expiresAt: number; snapshot: CrMappedSnapshot };

const store = new Map<string, Entry>();

export function crRegistryCacheKey(parts: {
  brnEqual?: string;
  namePrefixes?: string[];
}): string {
  const payload = JSON.stringify({
    brn: parts.brnEqual?.toUpperCase() ?? "",
    prefixes: (parts.namePrefixes ?? []).slice(0, 3),
  });
  return createHash("sha256").update(payload).digest("hex");
}

export function getCrRegistryCached(key: string): CrMappedSnapshot | null {
  const e = store.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    store.delete(key);
    return null;
  }
  return e.snapshot;
}

export function setCrRegistryCached(
  key: string,
  snapshot: CrMappedSnapshot,
): void {
  store.set(key, { expiresAt: Date.now() + TTL_MS, snapshot });
}

export function clearCrRegistryCacheForTests(): void {
  store.clear();
}

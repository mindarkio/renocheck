/**
 * Random anonymous id for repeat-use counts.
 * Generated with crypto.randomUUID and stored in localStorage — not a cookie.
 * Never attach it to a name, phone, email, or IP.
 */

export const ANON_ID_STORAGE_KEY = "renocheck:anon-id";

/** UUID version 4, the shape crypto.randomUUID() returns. */
export const ANON_ID_V4_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let memoryId: string | null = null;

export function isAnonId(value: unknown): value is string {
  return typeof value === "string" && ANON_ID_V4_RE.test(value);
}

export function canonicalAnonId(value: string): string {
  return value.toLowerCase();
}

function createAnonId(): string | null {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj || typeof cryptoObj.randomUUID !== "function") return null;
  const id = cryptoObj.randomUUID();
  return isAnonId(id) ? canonicalAnonId(id) : null;
}

/**
 * Read the stored id, or create one. If localStorage throws (private mode),
 * keep the id in memory for this page session — same approach as /quote.
 * Returns null when the platform cannot generate a UUID.
 */
export function getOrCreateAnonId(): string | null {
  if (typeof window === "undefined") return memoryId ?? createAnonId();

  try {
    const existing = localStorage.getItem(ANON_ID_STORAGE_KEY);
    if (isAnonId(existing)) {
      memoryId = canonicalAnonId(existing);
      return memoryId;
    }
    const created = createAnonId();
    if (!created) return memoryId;
    localStorage.setItem(ANON_ID_STORAGE_KEY, created);
    memoryId = created;
    return created;
  } catch {
    if (memoryId && isAnonId(memoryId)) return memoryId;
    memoryId = createAnonId();
    return memoryId;
  }
}

export function resetAnonIdForTests(): void {
  memoryId = null;
}

// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ANON_ID_STORAGE_KEY,
  canonicalAnonId,
  getOrCreateAnonId,
  isAnonId,
  resetAnonIdForTests,
} from "./anon-id";

const STORED = "12345678-1234-4234-8234-123456789abc";

afterEach(() => {
  localStorage.clear();
  resetAnonIdForTests();
});

describe("anonymous id", () => {
  it("accepts only UUID v4", () => {
    expect(isAnonId(STORED)).toBe(true);
    expect(isAnonId(STORED.toUpperCase())).toBe(true);
    expect(isAnonId("12345678-1234-1234-8234-123456789abc")).toBe(false);
    expect(isAnonId("12345678-1234-4234-c234-123456789abc")).toBe(false);
    expect(isAnonId("not-a-uuid")).toBe(false);
    expect(isAnonId(null)).toBe(false);
    expect(canonicalAnonId(STORED.toUpperCase())).toBe(STORED);
  });

  it("creates a random id in localStorage and reuses it", () => {
    const first = getOrCreateAnonId();
    const second = getOrCreateAnonId();
    expect(first).toBe(second);
    expect(isAnonId(first)).toBe(true);
    expect(localStorage.getItem(ANON_ID_STORAGE_KEY)).toBe(first);
    expect(document.cookie).not.toContain(first ?? "missing");
  });

  it("keeps a previously stored id", () => {
    localStorage.setItem(ANON_ID_STORAGE_KEY, STORED.toUpperCase());
    expect(getOrCreateAnonId()).toBe(STORED);
  });

  it("replaces a stored value that is not a UUID", () => {
    localStorage.setItem(ANON_ID_STORAGE_KEY, "legacy-cookie-value");
    const created = getOrCreateAnonId();
    expect(isAnonId(created)).toBe(true);
    expect(created).not.toBe("legacy-cookie-value");
  });

  it("keeps one id in memory when localStorage throws", () => {
    viStoreThrows();
    const first = getOrCreateAnonId();
    const second = getOrCreateAnonId();
    expect(first).toBe(second);
    expect(isAnonId(first)).toBe(true);
  });
});

function viStoreThrows(): void {
  const thrower = () => {
    throw new DOMException("denied", "SecurityError");
  };
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(thrower);
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(thrower);
}

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearCrRegistryCacheForTests,
  crRegistryCacheKey,
  getCrRegistryCached,
  setCrRegistryCached,
} from "./memory-cache";

describe("crRegistryCacheKey (M2)", () => {
  it("different labels produce different keys", () => {
    const a = crRegistryCacheKey({
      namePrefixes: ["ABC"],
      searchLabelUsed: "ABC DECORATION LIMITED",
    });
    const b = crRegistryCacheKey({
      namePrefixes: ["ABC"],
      searchLabelUsed: "ABC DECORATIONS & CO LIMITED",
    });
    expect(a).not.toBe(b);
  });

  it("evicts oldest entry after 500", () => {
    vi.useFakeTimers();
    clearCrRegistryCacheForTests();
    const base = {
      matched: false,
      retrievedAt: "2026-10-18T12:00:00.000Z",
      hints: [] as Array<"incorporation_under_one_year" | "not_found_in_active_list">,
      icrisHomeUrl: "https://www.e-services.cr.gov.hk/",
    };
    for (let i = 0; i < 501; i++) {
      vi.advanceTimersByTime(1);
      setCrRegistryCached(`key-${i}`, { ...base });
    }
    expect(getCrRegistryCached("key-0")).toBeNull();
    expect(getCrRegistryCached("key-500")).not.toBeNull();
    clearCrRegistryCacheForTests();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearCrRegistryCacheForTests();
  });
});

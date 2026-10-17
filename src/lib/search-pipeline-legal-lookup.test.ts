import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  LEGAL_LOOKUP_TIMEOUT_MS,
  emptyLegalLookupResult,
  startLegalLookupForSearch,
} from "./search-pipeline-legal-lookup";

const supabase = {} as SupabaseClient;

vi.mock("./legal-events-config", () => ({
  isLegalEventsEnabled: vi.fn(),
}));

vi.mock("./lookup-legal-judgments", () => ({
  lookupLegalJudgments: vi.fn(),
}));

import { isLegalEventsEnabled } from "./legal-events-config";
import { lookupLegalJudgments } from "./lookup-legal-judgments";

describe("startLegalLookupForSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(isLegalEventsEnabled).mockReturnValue(true);
    vi.mocked(lookupLegalJudgments).mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns empty when legal events disabled", async () => {
    vi.mocked(isLegalEventsEnabled).mockReturnValue(false);
    const result = await startLegalLookupForSearch(supabase, {
      searchLabelUsed: "示例公司",
    });
    expect(result).toEqual(emptyLegalLookupResult());
    expect(lookupLegalJudgments).not.toHaveBeenCalled();
  });

  it("returns empty and logs on lookup error", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(lookupLegalJudgments).mockRejectedValue(new Error("db down"));

    const result = await startLegalLookupForSearch(supabase, {
      searchLabelUsed: "示例公司",
    });

    expect(result).toEqual(emptyLegalLookupResult());
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("legal_lookup_failed"),
    );
  });

  it("returns empty after timeout when lookup is slow", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.mocked(lookupLegalJudgments).mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                events: [{ caseRef: "DCCJ 1/2020" } as never],
                registryAsOf: "2026-01-01T00:00:00.000Z",
              }),
            LEGAL_LOOKUP_TIMEOUT_MS + 500,
          );
        }),
    );

    const resultPromise = startLegalLookupForSearch(supabase, {
      searchLabelUsed: "示例公司",
    });
    await vi.advanceTimersByTimeAsync(LEGAL_LOOKUP_TIMEOUT_MS);
    const result = await resultPromise;

    expect(result).toEqual(emptyLegalLookupResult());
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("legal_lookup_timeout"),
    );
  });

  it("returns lookup result when it finishes within timeout", async () => {
    const payload = {
      events: [],
      registryAsOf: "2026-10-17T12:00:00.000Z",
    };
    vi.mocked(lookupLegalJudgments).mockResolvedValue(payload);

    const result = await startLegalLookupForSearch(supabase, {
      searchLabelUsed: "示例公司",
    });

    expect(result).toEqual(payload);
  });
});

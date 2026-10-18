import { afterEach, describe, expect, it, vi } from "vitest";
import { resetCrCircuitBreakerForTests } from "./cr-register/circuit-breaker";
import { clearCrRegistryCacheForTests } from "./cr-register/memory-cache";
import { resetCrApiThrottleForTests } from "./cr-register/throttle";
import { lookupCompaniesRegistryForSearch } from "./cr-registry-lookup";
import { companyNameOnlySearchInput } from "./normalize-search-input";

function mockFetchNoResult() {
  return {
    ok: false,
    status: 400,
    headers: { get: () => null },
    text: async () =>
      JSON.stringify({ status: 400, message: "No result found." }),
  };
}

describe("lookupCompaniesRegistryForSearch throttle deadline (c-L2)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    clearCrRegistryCacheForTests();
    resetCrApiThrottleForTests();
    resetCrCircuitBreakerForTests();
  });

  it("three concurrent not_found lookups all return lookupStatus ok", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const fetchMock = vi.fn().mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve(mockFetchNoResult()), 300);
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const labels = ["甲工程有限公司", "乙工程有限公司", "丙工程有限公司"];
    const promises = labels.map((label) =>
      lookupCompaniesRegistryForSearch(
        companyNameOnlySearchInput(label),
        label,
        null,
      ),
    );

    await vi.runAllTimersAsync();
    const results = await Promise.all(promises);
    for (const official of results) {
      expect(official.lookupStatus).toBe("ok");
    }
    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});

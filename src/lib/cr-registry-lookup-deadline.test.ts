import { afterEach, describe, expect, it, vi } from "vitest";
import { resetCrCircuitBreakerForTests } from "./cr-register/circuit-breaker";
import { clearCrRegistryCacheForTests } from "./cr-register/memory-cache";
import {
  resetCrApiThrottleForTests,
  scheduleCrApiRequest,
} from "./cr-register/throttle";
import {
  CR_LOOKUP_BUDGET_MS,
  lookupCompaniesRegistryForSearch,
} from "./cr-registry-lookup";
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

  it("returns timeout when queued past the lookup budget (L4)", async () => {
    vi.useFakeTimers({ now: 1_700_000_000_000 });
    resetCrApiThrottleForTests();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    scheduleCrApiRequest(
      () =>
        new Promise<void>((resolve) => {
          setTimeout(() => resolve(), CR_LOOKUP_BUDGET_MS);
        }),
    );

    const label = "合成測試有限公司";
    const pending = lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput(label),
      label,
      null,
    );
    await vi.advanceTimersByTimeAsync(CR_LOOKUP_BUDGET_MS);
    const official = await pending;

    expect(official.lookupStatus).toBe("timeout");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("lookupCompaniesRegistryForSearch CR logs (A3)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
    clearCrRegistryCacheForTests();
    resetCrApiThrottleForTests();
    resetCrCircuitBreakerForTests();
    vi.restoreAllMocks();
  });

  it("logs fetch_count and http_status on no_result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockFetchNoResult()),
    );
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const label = "合成測試有限公司";
    await lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput(label),
      label,
      null,
    );
    const crLine = infoSpy.mock.calls
      .map((c) => c[0])
      .find((line) => String(line).includes('"event":"cr_lookup"'));
    expect(crLine).toBeTruthy();
    const payload = JSON.parse(String(crLine));
    expect(payload.fetch_count).toBeGreaterThanOrEqual(1);
    expect(payload.http_status).toBe(400);
    expect(typeof payload.elapsed_ms).toBe("number");
    expect(payload.cache_hit).toBe(false);
    expect(String(crLine)).not.toContain("合成測試");
  });

  it("logs timeout with fetch_count when upstream hangs", async () => {
    vi.useFakeTimers({ now: 1_700_000_000_000 });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url: string, init?: { signal?: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            const signal = init?.signal;
            const onAbort = () => {
              const err = new Error("The operation was aborted");
              err.name = "AbortError";
              reject(err);
            };
            if (!signal) return;
            if (signal.aborted) onAbort();
            else signal.addEventListener("abort", onAbort, { once: true });
          }),
      ),
    );
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const label = "合成測試有限公司";
    const pending = lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput(label),
      label,
      null,
    );
    await vi.advanceTimersByTimeAsync(CR_LOOKUP_BUDGET_MS + 1);
    await pending;
    const failLine = warnSpy.mock.calls
      .map((c) => c[0])
      .find((line) => String(line).includes('"event":"cr_lookup_failed"'));
    const payload = JSON.parse(String(failLine));
    expect(payload.reason).toBe("timeout");
    expect(payload.http_status).toBeNull();
    expect(payload.fetch_count).toBeGreaterThanOrEqual(1);
  });

  it("logs cache_hit on second lookup with same label", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(mockFetchNoResult()),
    );
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    const label = "合成測試有限公司";
    const input = companyNameOnlySearchInput(label);
    await lookupCompaniesRegistryForSearch(input, label, null);
    await lookupCompaniesRegistryForSearch(input, label, null);
    const lines = infoSpy.mock.calls
      .map((c) => c[0])
      .filter((line) => String(line).includes('"event":"cr_lookup"'));
    const second = JSON.parse(String(lines[lines.length - 1]));
    expect(second.cache_hit).toBe(true);
    expect(second.fetch_count).toBe(0);
  });
});

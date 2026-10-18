import { afterEach, describe, expect, it, vi } from "vitest";
import { resetCrCircuitBreakerForTests } from "./circuit-breaker";
import { resetCrApiThrottleForTests } from "./throttle";
import { searchCrLocalByNameBeginsWith } from "./client";

function mockFetchResponse(init: {
  ok: boolean;
  status: number;
  body: string;
  contentLength?: string | null;
  retryAfter?: string | null;
}) {
  return {
    ok: init.ok,
    status: init.status,
    headers: {
      get: (name: string) => {
        if (name.toLowerCase() === "content-length") {
          return init.contentLength ?? null;
        }
        if (name.toLowerCase() === "retry-after") {
          return init.retryAfter ?? null;
        }
        return null;
      },
    },
    text: async () => init.body,
  };
}

describe("searchCrLocalByNameBeginsWith", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetCrApiThrottleForTests();
    resetCrCircuitBreakerForTests();
  });

  it("maps HTTP 400 no result message to no_result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          ok: false,
          status: 400,
          body: JSON.stringify({ status: 400, message: "No result found." }),
        }),
      ),
    );
    const res = await searchCrLocalByNameBeginsWith("合成測試");
    expect(res).toEqual({ kind: "no_result" });
  });

  it("maps other HTTP 400 to http_400 (M1)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          ok: false,
          status: 400,
          body: JSON.stringify({
            status: 400,
            message: "Invalid requested Filter.",
          }),
        }),
      ),
    );
    const res = await searchCrLocalByNameBeginsWith("合成測試");
    expect(res).toEqual({ kind: "error", message: "http_400" });
  });

  it("maps HTTP 200 + body status 400 to error (M1)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          ok: true,
          status: 200,
          body: JSON.stringify({ status: 400, message: "bad" }),
        }),
      ),
    );
    const res = await searchCrLocalByNameBeginsWith("合成測試");
    expect(res).toEqual({ kind: "error", message: "body_status_400" });
  });

  it("content-length > 2MB → too_large (L-T)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          ok: true,
          status: 200,
          contentLength: "3000000",
          body: "[]",
        }),
      ),
    );
    const res = await searchCrLocalByNameBeginsWith("合成測試");
    expect(res).toEqual({ kind: "error", message: "too_large" });
  });

  it("429 opens circuit — no fetch until cooldown (L-T)", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({
        ok: false,
        status: 429,
        retryAfter: "60",
        body: "{}",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    await searchCrLocalByNameBeginsWith("a");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const res2 = await searchCrLocalByNameBeginsWith("b");
    expect(res2).toEqual({ kind: "error", message: "circuit_open" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(61_000);
    fetchMock.mockResolvedValue(
      mockFetchResponse({
        ok: false,
        status: 400,
        body: JSON.stringify({ status: 400, message: "No result found." }),
      }),
    );
    await searchCrLocalByNameBeginsWith("c");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("three consecutive errors open circuit (L-T)", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({
        ok: false,
        status: 500,
        body: "err",
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    for (let i = 0; i < 3; i++) {
      await searchCrLocalByNameBeginsWith(`x${i}`);
      vi.advanceTimersByTime(1100);
    }
    const blocked = await searchCrLocalByNameBeginsWith("blocked");
    expect(blocked).toEqual({ kind: "error", message: "circuit_open" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("three consecutive upstream timeouts open circuit (c-L3)", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(() => {
      const err = new Error("The operation was aborted");
      err.name = "AbortError";
      return Promise.reject(err);
    });
    vi.stubGlobal("fetch", fetchMock);
    for (let i = 0; i < 3; i++) {
      await searchCrLocalByNameBeginsWith(`t${i}`);
      vi.advanceTimersByTime(1100);
    }
    const blocked = await searchCrLocalByNameBeginsWith("blocked");
    expect(blocked).toEqual({ kind: "error", message: "circuit_open" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("aborted signal → timeout without counting as failure (L-a)", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await searchCrLocalByNameBeginsWith("合成測試", {
      signal: controller.signal,
    });
    expect(res).toEqual({ kind: "error", message: "timeout" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

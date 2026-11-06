import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isCrCircuitOpen,
  resetCrCircuitBreakerForTests,
} from "./circuit-breaker";
import { resetCrApiThrottleForTests } from "./throttle";
import { isCrHtmlNoResultPage, searchCrLocalByNameBeginsWith } from "./client";

/** Fake-timer-friendly stand-in for AbortSignal.timeout in tests. */
function abortSignalAfterMs(ms: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), ms);
  return controller.signal;
}

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

  it("records stats on successful fetch (A3)", async () => {
    const stats = { fetchCount: 0, lastHttpStatus: null as number | null };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          ok: true,
          status: 200,
          body: JSON.stringify([
            {
              Brn: "C0000001",
              English_Company_Name: "ZZQ TESTING LIMITED",
              Chinese_Company_Name: "NULL",
              Company_Type: "Co",
              Date_of_Incorporation: "01-01-2020",
              Address_of_Registered_Office: "HK",
            },
          ]),
        }),
      ),
    );
    await searchCrLocalByNameBeginsWith("ZZQ", { stats });
    expect(stats.fetchCount).toBe(1);
    expect(stats.lastHttpStatus).toBe(200);
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

  it("three consecutive errors open circuit after retries are exhausted (L-T)", async () => {
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
      const pending = searchCrLocalByNameBeginsWith(`x${i}`);
      await vi.advanceTimersByTimeAsync(1_500);
      await pending;
      await vi.advanceTimersByTimeAsync(1_100);
    }
    const blocked = await searchCrLocalByNameBeginsWith("blocked");
    expect(blocked).toEqual({ kind: "error", message: "circuit_open" });
    expect(fetchMock).toHaveBeenCalledTimes(6);
    vi.useRealTimers();
  });

  it("three slow upstream timeouts open circuit (f-L1)", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          const fail = () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          };
          if (!signal) {
            fail();
            return;
          }
          if (signal.aborted) fail();
          else signal.addEventListener("abort", fail, { once: true });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    for (let i = 0; i < 3; i++) {
      const pending = searchCrLocalByNameBeginsWith(`t${i}`, {
        signal: abortSignalAfterMs(3500),
      });
      await vi.advanceTimersByTimeAsync(3600);
      await pending;
      await vi.advanceTimersByTimeAsync(1100);
    }
    const blocked = await searchCrLocalByNameBeginsWith("blocked");
    expect(blocked).toEqual({ kind: "error", message: "circuit_open" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });

  it("fast budget timeouts do not open circuit (f-L1)", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          const fail = () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          };
          if (!signal) {
            fail();
            return;
          }
          if (signal.aborted) fail();
          else signal.addEventListener("abort", fail, { once: true });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    for (let i = 0; i < 3; i++) {
      const pending = searchCrLocalByNameBeginsWith(`f${i}`, {
        signal: abortSignalAfterMs(500),
      });
      await vi.advanceTimersByTimeAsync(600);
      await pending;
      await vi.advanceTimersByTimeAsync(1100);
    }
    expect(isCrCircuitOpen()).toBe(false);
    vi.useRealTimers();
  });

  it("budget TimeoutError signal → timeout without fetch or breaker (L4)", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const res = await searchCrLocalByNameBeginsWith("合成測試", {
      signal: AbortSignal.abort(new DOMException("budget", "TimeoutError")),
    });
    expect(res).toEqual({ kind: "error", message: "timeout" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(isCrCircuitOpen()).toBe(false);
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

  it("classifies the live HTML 400 shell as no_result and does not retry or open the breaker", async () => {
    const html =
      '<!DOCTYPE html><html lang="en"><body>400 Error Invalid Request <a href="./400_ZH.html"></a></body></html>';
    expect(isCrHtmlNoResultPage(400, html)).toBe(true);
    expect(isCrHtmlNoResultPage(502, html)).toBe(false);
    expect(isCrHtmlNoResultPage(400, "<!DOCTYPE html><html>maintenance</html>")).toBe(
      false,
    );
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({ ok: false, status: 400, body: html }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    for (let i = 0; i < 3; i++) {
      const pending = searchCrLocalByNameBeginsWith(`合成${i}`);
      await vi.advanceTimersByTimeAsync(1_100);
      await expect(pending).resolves.toEqual({ kind: "no_result" });
    }
    vi.useRealTimers();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(isCrCircuitOpen()).toBe(false);
  });

  it("does not retry JSON no_result", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({
        ok: false,
        status: 400,
        body: JSON.stringify({ status: 400, message: "No result found." }),
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const res = await searchCrLocalByNameBeginsWith("合成測試");
    expect(res).toEqual({ kind: "no_result" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries HTTP 503 once and returns rows when the second attempt succeeds", async () => {
    vi.useFakeTimers();
    const row = {
      Brn: "C0000001",
      English_Company_Name: "ZZQ TESTING LIMITED",
      Chinese_Company_Name: "NULL",
      Company_Type: "Co",
      Date_of_Incorporation: "01-01-2020",
      Address_of_Registered_Office: "HK",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        mockFetchResponse({ ok: false, status: 503, body: "<html>down</html>" }),
      )
      .mockResolvedValueOnce(
        mockFetchResponse({
          ok: true,
          status: 200,
          body: JSON.stringify([row]),
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const pending = searchCrLocalByNameBeginsWith("ZZQ");
    await vi.advanceTimersByTimeAsync(1_500);
    await expect(pending).resolves.toEqual({ kind: "rows", rows: [row] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(isCrCircuitOpen()).toBe(false);
    vi.useRealTimers();
  });

  it("retries a fast network failure once", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(Object.assign(new TypeError("fetch failed"), { name: "TypeError" }))
      .mockResolvedValueOnce(
        mockFetchResponse({
          ok: false,
          status: 400,
          body: JSON.stringify({ status: 400, message: "No result found." }),
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const pending = searchCrLocalByNameBeginsWith("合成測試");
    await vi.advanceTimersByTimeAsync(1_500);
    await expect(pending).resolves.toEqual({ kind: "no_result" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("retries an attempt timeout when lookup budget remains", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((resolve, reject) => {
          const signal = init?.signal;
          const fail = () => {
            const err = new Error("attempt");
            err.name = "TimeoutError";
            reject(err);
          };
          if (!signal) {
            fail();
            return;
          }
          if (signal.aborted) fail();
          else signal.addEventListener("abort", fail, { once: true });
          if (fetchMock.mock.calls.length >= 2) {
            signal.addEventListener(
              "abort",
              () => undefined,
              { once: true },
            );
            resolve(
              mockFetchResponse({
                ok: false,
                status: 400,
                body: JSON.stringify({ status: 400, message: "No result found." }),
              }),
            );
          }
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const pending = searchCrLocalByNameBeginsWith("合成測試", {
      deadlineMs: Date.now() + 25_000,
    });
    await vi.advanceTimersByTimeAsync(17_500);
    await expect(pending).resolves.toEqual({ kind: "no_result" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });

  it("does not retry when the parent lookup signal already aborted", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockImplementation(
      (_url: string, init?: { signal?: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          const fail = () => {
            const err = new Error("budget");
            err.name = "AbortError";
            reject(err);
          };
          if (!signal) {
            fail();
            return;
          }
          if (signal.aborted) fail();
          else signal.addEventListener("abort", fail, { once: true });
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const pending = searchCrLocalByNameBeginsWith("合成測試", {
      signal: abortSignalAfterMs(500),
      deadlineMs: Date.now() + 25_000,
    });
    await vi.advanceTimersByTimeAsync(1_000);
    await expect(pending).resolves.toEqual({ kind: "error", message: "timeout" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });

  it("HTTP 502 HTML stays an error even if the no-result markers are present", async () => {
    const html =
      '<!DOCTYPE html><html>Invalid Request 400_ZH.html</html>';
    const fetchMock = vi.fn().mockResolvedValue(
      mockFetchResponse({ ok: false, status: 502, body: html }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();
    const pending = searchCrLocalByNameBeginsWith("合成測試");
    await vi.advanceTimersByTimeAsync(1_500);
    await expect(pending).resolves.toEqual({ kind: "error", message: "http_502" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
  });
});

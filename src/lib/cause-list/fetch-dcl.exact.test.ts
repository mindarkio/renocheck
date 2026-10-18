import { describe, expect, it, vi } from "vitest";
import { buildDclLiveUrl, buildWaybackRawUrl } from "./dcl-url";
import {
  assertCauseListFetchAllowed,
  assertLiveDclRobotsAllowed,
  FetchFatal,
  fetchDclHtml,
  isPathDisallowedByRobots,
  loadJudiciaryRobotsPrefixes,
  parseRobotsDisallowPrefixes,
} from "./fetch-dcl";

const PRIMARY = "https://e-services.judiciary.hk/robots.txt";
const FALLBACK = "https://www.e-services.judiciary.hk/robots.txt";

function headersOf(values: Record<string, string> = {}) {
  return { get: (name: string) => values[name.toLowerCase()] ?? null };
}

function http(status: number, body = "", location?: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headersOf(location ? { location } : {}),
    text: async () => body,
  };
}

describe("robots.txt", () => {
  it("blocks /dcl via prefix disallow", () => {
    const prefixes = parseRobotsDisallowPrefixes(
      "User-agent: *\nDisallow: /dcl\nDisallow: /private\n",
    );
    expect(isPathDisallowedByRobots("/dcl/view.jsp", prefixes)).toBe(true);
    expect(isPathDisallowedByRobots("/other", prefixes)).toBe(false);
  });

  it("Disallow: /dcl/view blocks the live view pathname and allows /dcl/", () => {
    const prefixes = parseRobotsDisallowPrefixes("User-agent: *\nDisallow: /dcl/view\n");
    const pathname = new URL(buildDclLiveUrl("16102026", "SMT")).pathname;
    expect(pathname).toBe("/dcl/view.jsp");
    expect(isPathDisallowedByRobots(pathname, prefixes)).toBe(true);
    expect(isPathDisallowedByRobots("/dcl/", prefixes)).toBe(false);
  });

  it("checks robots against the live request pathname", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => "User-agent: *\nDisallow: /dcl/view\n",
      }),
    );
    await expect(
      assertLiveDclRobotsAllowed(buildDclLiveUrl("16102026", "SMT"), "ua-test"),
    ).rejects.toThrow("/dcl/view.jsp");
    vi.unstubAllGlobals();
  });

  it("treats robots 5xx as unavailable and 4xx as allow", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 502, text: async () => "" }),
    );
    await expect(
      assertLiveDclRobotsAllowed(buildDclLiveUrl("16102026", "SMT"), "ua-test"),
    ).rejects.toThrow("robots.txt unavailable (5xx)");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 404, text: async () => "" }),
    );
    await expect(
      assertLiveDclRobotsAllowed(buildDclLiveUrl("16102026", "SMT"), "ua-test"),
    ).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("covers each judiciary robots decision", async () => {
    const log = vi.fn();
    const calls = () => vi.mocked(fetch).mock.calls.map((call) => String(call[0]));

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(http(200, "User-agent: *\nDisallow:\n")));
    await expect(loadJudiciaryRobotsPrefixes("ua-test", log)).resolves.toEqual([]);
    expect(log).toHaveBeenLastCalledWith({
      event: "robots_decision",
      host: "e-services.judiciary.hk",
      status: 200,
      result: "parsed",
    });
    expect(calls()).toEqual([PRIMARY]);

    log.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(http(200, "User-agent: *\nDisallow: /dcl/view\n")),
    );
    await expect(loadJudiciaryRobotsPrefixes("ua-test", log)).resolves.toEqual(["/dcl/view"]);
    expect(calls()).toEqual([PRIMARY]);

    for (const status of [404, 410]) {
      log.mockClear();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(http(status)));
      await expect(loadJudiciaryRobotsPrefixes("ua-test", log)).resolves.toEqual([]);
      expect(log).toHaveBeenLastCalledWith({
        event: "robots_decision",
        host: "e-services.judiciary.hk",
        status,
        result: "allow",
      });
      expect(calls()).toEqual([PRIMARY]);
    }

    for (const status of [401, 403, 429, 400]) {
      log.mockClear();
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(http(status, "secret-body")));
      await expect(loadJudiciaryRobotsPrefixes("ua-test", log)).rejects.toThrow(
        `robots.txt unavailable (${status})`,
      );
      expect(log).toHaveBeenLastCalledWith({
        event: "robots_decision",
        host: "e-services.judiciary.hk",
        status,
        result: "fail_closed",
      });
      expect(JSON.stringify(log.mock.calls)).not.toContain("secret-body");
      expect(calls()).toEqual([PRIMARY]);
    }

    log.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) return http(502, "gateway");
        if (url === FALLBACK) return http(302, "", "/judservice-web/robots.txt");
        if (url === "https://www.e-services.judiciary.hk/judservice-web/robots.txt") {
          return http(404);
        }
        return http(500);
      }),
    );
    await expect(loadJudiciaryRobotsPrefixes("ua-test", log)).resolves.toEqual([]);
    expect(log).toHaveBeenLastCalledWith({
      event: "robots_decision",
      host: "www.e-services.judiciary.hk",
      status: 404,
      result: "allow",
    });
    expect(calls()).toEqual([
      PRIMARY,
      FALLBACK,
      "https://www.e-services.judiciary.hk/judservice-web/robots.txt",
    ]);

    log.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) return http(503);
        return http(200, "User-agent: *\nAllow: /\n");
      }),
    );
    await expect(loadJudiciaryRobotsPrefixes("ua-test", log)).resolves.toEqual([]);
    expect(log).toHaveBeenLastCalledWith({
      event: "robots_decision",
      host: "www.e-services.judiciary.hk",
      status: 200,
      result: "parsed",
    });

    log.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) throw new TypeError("network down");
        return http(410);
      }),
    );
    await expect(loadJudiciaryRobotsPrefixes("ua-test", log)).resolves.toEqual([]);
    expect(log).toHaveBeenLastCalledWith({
      event: "robots_decision",
      host: "www.e-services.judiciary.hk",
      status: 410,
      result: "allow",
    });

    log.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(http(502)));
    await expect(loadJudiciaryRobotsPrefixes("ua-test", log)).rejects.toThrow(
      "robots.txt unavailable (5xx)",
    );
    expect(log).toHaveBeenLastCalledWith({
      event: "robots_decision",
      host: "www.e-services.judiciary.hk",
      status: 502,
      result: "fail_closed",
    });
    expect(calls()).toEqual([PRIMARY, FALLBACK]);

    log.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(loadJudiciaryRobotsPrefixes("ua-test", log)).rejects.toThrow(
      "robots.txt unavailable (network)",
    );
    expect(log).toHaveBeenLastCalledWith({
      event: "robots_decision",
      host: "www.e-services.judiciary.hk",
      status: 0,
      result: "fail_closed",
    });

    log.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url === PRIMARY ? http(500) : http(403, "nope"))),
    );
    await expect(loadJudiciaryRobotsPrefixes("ua-test", log)).rejects.toThrow(
      "robots.txt unavailable (403)",
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain("nope");

    log.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) return http(502);
        return http(302, "", "https://evil.example/robots.txt");
      }),
    );
    await expect(loadJudiciaryRobotsPrefixes("ua-test", log)).rejects.toThrow(
      "robots.txt unavailable (redirect)",
    );
    expect(calls().some((url) => url.includes("evil.example"))).toBe(false);
    expect(log).toHaveBeenLastCalledWith({
      event: "robots_decision",
      host: "www.e-services.judiciary.hk",
      status: 302,
      result: "fail_closed",
    });

    log.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) return http(502);
        return http(302, "", `${url}#next`);
      }),
    );
    await expect(loadJudiciaryRobotsPrefixes("ua-test", log)).rejects.toThrow(
      "robots.txt unavailable (redirect)",
    );
    expect(calls().filter((url) => url.startsWith(FALLBACK))).toHaveLength(4);

    vi.unstubAllGlobals();
  });

  it("rejects a wayback fetch when the live DCL path is disallowed", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes("judiciary.hk")) {
        return {
          ok: true,
          status: 200,
          text: async () => "User-agent: *\nDisallow: /dcl/view\n",
        };
      }
      return { ok: true, status: 200, text: async () => "User-agent: *\n" };
    });
    vi.stubGlobal("fetch", fetchMock);
    const live = buildDclLiveUrl("16102026", "SMT");
    await expect(
      assertCauseListFetchAllowed(live, "ua-test", buildWaybackRawUrl("20251016120000", live)),
    ).rejects.toThrow(/robots\.txt disallows/);
    vi.unstubAllGlobals();
  });
});

describe("fetchDclHtml", () => {
  it("retries 503 then succeeds", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "<html/>" });
    vi.stubGlobal("fetch", fetchMock);

    const promise = fetchDclHtml("https://example.test/page", {
      userAgent: "test",
      maxRetries: 1,
    });
    await vi.runAllTimersAsync();
    const html = await promise;
    expect(html).toBe("<html/>");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("does not retry 403", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      headers: { get: () => null },
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchDclHtml("https://example.test/page", { userAgent: "test", maxRetries: 4 }),
    ).rejects.toBeInstanceOf(FetchFatal);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("waits at least Retry-After before the next 429 attempt", async () => {
    vi.useFakeTimers();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: { get: (name: string) => (name.toLowerCase() === "retry-after" ? "2" : null) },
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => "ok",
      });
    vi.stubGlobal("fetch", fetchMock);
    const promise = fetchDclHtml("https://example.test/page", {
      userAgent: "test",
      maxRetries: 2,
    });
    await vi.advanceTimersByTimeAsync(1999);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(3001);
    await expect(promise).resolves.toBe("ok");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("tries a 503 five times when maxRetries is 4", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      headers: { get: () => null },
    });
    vi.stubGlobal("fetch", fetchMock);
    const promise = fetchDclHtml("https://example.test/page", {
      userAgent: "test",
      maxRetries: 4,
    }).then(
      () => "ok",
      (error: unknown) => error,
    );
    await vi.runAllTimersAsync();
    const result = await promise;
    expect(result).toBeInstanceOf(FetchFatal);
    expect(fetchMock).toHaveBeenCalledTimes(5);
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
});

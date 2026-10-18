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

function http(status: number, body = "", location?: string, contentType?: string) {
  const values: Record<string, string> = {};
  if (location) values.location = location;
  if (contentType) values["content-type"] = contentType;
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: headersOf(values),
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
      appliedTo: "e-services.judiciary.hk",
      basis: "primary",
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
        appliedTo: "e-services.judiciary.hk",
        basis: "primary",
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
        appliedTo: "e-services.judiciary.hk",
        basis: "primary",
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
    await expect(
      loadJudiciaryRobotsPrefixes("ua-test", log, { allowFallback: true }),
    ).resolves.toEqual([]);
    expect(log).toHaveBeenLastCalledWith({
      event: "robots_decision",
      host: "www.e-services.judiciary.hk",
      status: 404,
      result: "allow",
      appliedTo: "e-services.judiciary.hk",
      basis: "fallback_host",
      primaryStatus: 502,
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
    await expect(
      loadJudiciaryRobotsPrefixes("ua-test", log, { allowFallback: true }),
    ).resolves.toEqual([]);
    expect(log).toHaveBeenLastCalledWith({
      event: "robots_decision",
      host: "www.e-services.judiciary.hk",
      status: 200,
      result: "parsed",
      appliedTo: "e-services.judiciary.hk",
      basis: "fallback_host",
      primaryStatus: 503,
    });

    log.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) throw new TypeError("network down");
        return http(410);
      }),
    );
    await expect(
      loadJudiciaryRobotsPrefixes("ua-test", log, { allowFallback: true }),
    ).resolves.toEqual([]);
    expect(log).toHaveBeenLastCalledWith({
      event: "robots_decision",
      host: "www.e-services.judiciary.hk",
      status: 410,
      result: "allow",
      appliedTo: "e-services.judiciary.hk",
      basis: "fallback_host",
      primaryStatus: 0,
    });

    log.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(http(502)));
    await expect(
      loadJudiciaryRobotsPrefixes("ua-test", log, { allowFallback: true }),
    ).rejects.toThrow("robots.txt unavailable (5xx)");
    expect(log).toHaveBeenLastCalledWith({
      event: "robots_decision",
      host: "www.e-services.judiciary.hk",
      status: 502,
      result: "fail_closed",
      appliedTo: "e-services.judiciary.hk",
      basis: "fallback_host",
      primaryStatus: 502,
    });
    expect(calls()).toEqual([PRIMARY, FALLBACK]);

    log.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(
      loadJudiciaryRobotsPrefixes("ua-test", log, { allowFallback: true }),
    ).rejects.toThrow("robots.txt unavailable (network)");
    expect(log).toHaveBeenLastCalledWith({
      event: "robots_decision",
      host: "www.e-services.judiciary.hk",
      status: 0,
      result: "fail_closed",
      appliedTo: "e-services.judiciary.hk",
      basis: "fallback_host",
      primaryStatus: 0,
    });

    log.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url === PRIMARY ? http(500) : http(403, "nope"))),
    );
    await expect(
      loadJudiciaryRobotsPrefixes("ua-test", log, { allowFallback: true }),
    ).rejects.toThrow("robots.txt unavailable (403)");
    expect(JSON.stringify(log.mock.calls)).not.toContain("nope");

    log.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) return http(502);
        return http(302, "", "https://evil.example/robots.txt");
      }),
    );
    await expect(
      loadJudiciaryRobotsPrefixes("ua-test", log, { allowFallback: true }),
    ).rejects.toThrow("robots.txt unavailable (redirect)");
    expect(calls().some((url) => url.includes("evil.example"))).toBe(false);
    expect(log).toHaveBeenLastCalledWith({
      event: "robots_decision",
      host: "www.e-services.judiciary.hk",
      status: 302,
      result: "fail_closed",
      appliedTo: "e-services.judiciary.hk",
      basis: "fallback_host",
      primaryStatus: 502,
    });

    log.mockClear();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) return http(502);
        return http(302, "", `${url}#next`);
      }),
    );
    await expect(
      loadJudiciaryRobotsPrefixes("ua-test", log, { allowFallback: true }),
    ).rejects.toThrow("robots.txt unavailable (redirect)");
    expect(calls().filter((url) => url.startsWith(FALLBACK))).toHaveLength(4);

    vi.unstubAllGlobals();
  });

  const live = buildDclLiveUrl("16102026", "SMT");
  const waybackOf = () => buildWaybackRawUrl("20251016120000", live);
  const calls = () => vi.mocked(fetch).mock.calls.map((call) => String(call[0]));

  it("live primary 502 fails closed without the www host", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(http(502)));
    await expect(assertLiveDclRobotsAllowed(live, "ua-test")).rejects.toThrow(
      "robots.txt unavailable (5xx)",
    );
    expect(calls()).toEqual([PRIMARY]);
    vi.unstubAllGlobals();
  });

  it("live primary network error fails closed without the www host", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(assertLiveDclRobotsAllowed(live, "ua-test")).rejects.toThrow("(network)");
    expect(calls()).toEqual([PRIMARY]);
    vi.unstubAllGlobals();
  });

  it("wayback primary 502 follows the www redirect to a 404 allow", async () => {
    const log = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) return http(502);
        if (url === FALLBACK) return http(302, "", "/judservice-web/robots.txt");
        if (url === "https://www.e-services.judiciary.hk/judservice-web/robots.txt") return http(404);
        return http(500);
      }),
    );
    await expect(
      loadJudiciaryRobotsPrefixes("ua-test", log, { allowFallback: true }),
    ).resolves.toEqual([]);
    expect(log).toHaveBeenLastCalledWith({
      event: "robots_decision",
      host: "www.e-services.judiciary.hk",
      status: 404,
      result: "allow",
      appliedTo: "e-services.judiciary.hk",
      basis: "fallback_host",
      primaryStatus: 502,
    });
    vi.unstubAllGlobals();
  });

  it("logs basis primary when the apex host returns 404", async () => {
    const log = vi.fn();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(http(404)));
    await expect(loadJudiciaryRobotsPrefixes("ua-test", log)).resolves.toEqual([]);
    expect(log).toHaveBeenLastCalledWith({
      event: "robots_decision",
      host: "e-services.judiciary.hk",
      status: 404,
      result: "allow",
      appliedTo: "e-services.judiciary.hk",
      basis: "primary",
    });
    vi.unstubAllGlobals();
  });

  it("rejects an http fallback redirect and does not fetch it", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) return http(502);
        return http(302, "", "http://www.e-services.judiciary.hk/robots.txt");
      }),
    );
    await expect(
      loadJudiciaryRobotsPrefixes("ua-test", undefined, { allowFallback: true }),
    ).rejects.toThrow("(redirect)");
    expect(calls().some((url) => url.startsWith("http://"))).toBe(false);
    vi.unstubAllGlobals();
  });

  it("rejects a fallback redirect onto a lookalike host", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) return http(502);
        return http(302, "", "https://e-services.judiciary.hk.evil.com/robots.txt");
      }),
    );
    await expect(
      loadJudiciaryRobotsPrefixes("ua-test", undefined, { allowFallback: true }),
    ).rejects.toThrow("(redirect)");
    expect(calls().some((url) => url.includes("evil.com"))).toBe(false);
    vi.unstubAllGlobals();
  });

  it("rejects a fallback redirect that hides the host in userinfo", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) return http(502);
        return http(302, "", "https://e-services.judiciary.hk@evil.com/robots.txt");
      }),
    );
    await expect(
      loadJudiciaryRobotsPrefixes("ua-test", undefined, { allowFallback: true }),
    ).rejects.toThrow("(redirect)");
    expect(calls().some((url) => url.includes("evil.com"))).toBe(false);
    vi.unstubAllGlobals();
  });

  it("rejects a fallback redirect to www.judiciary.hk", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) return http(502);
        return http(302, "", "https://www.judiciary.hk/robots.txt");
      }),
    );
    await expect(
      loadJudiciaryRobotsPrefixes("ua-test", undefined, { allowFallback: true }),
    ).rejects.toThrow("(redirect)");
    expect(calls().some((url) => url.includes("www.judiciary.hk"))).toBe(false);
    vi.unstubAllGlobals();
  });

  it("rejects a fallback redirect onto a non-default port", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) return http(502);
        return http(302, "", "https://www.e-services.judiciary.hk:8443/robots.txt");
      }),
    );
    await expect(
      loadJudiciaryRobotsPrefixes("ua-test", undefined, { allowFallback: true }),
    ).rejects.toThrow("(redirect)");
    expect(calls().some((url) => url.includes(":8443"))).toBe(false);
    vi.unstubAllGlobals();
  });

  it("rejects a redirect that has no Location", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(http(302)));
    await expect(loadJudiciaryRobotsPrefixes("ua-test")).rejects.toThrow("(redirect)");
    vi.unstubAllGlobals();
  });

  it("does not try www when the apex redirect leaves the allowed hosts", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) return http(302, "", "https://evil.example/robots.txt");
        return http(200, "User-agent: *\n");
      }),
    );
    await expect(
      loadJudiciaryRobotsPrefixes("ua-test", undefined, { allowFallback: true }),
    ).rejects.toThrow("(redirect)");
    expect(calls()).not.toContain(FALLBACK);
    vi.unstubAllGlobals();
  });

  it("stops after more than three apex redirects", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => http(302, "", `${url}#next`)),
    );
    await expect(loadJudiciaryRobotsPrefixes("ua-test")).rejects.toThrow("(redirect)");
    expect(
      calls().filter(
        (url) => url.startsWith(PRIMARY) || url.includes("e-services.judiciary.hk/robots.txt"),
      ),
    ).toHaveLength(4);
    expect(calls()).not.toContain(FALLBACK);
    vi.unstubAllGlobals();
  });

  it("treats a primary timeout as a network error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new DOMException("t", "TimeoutError")));
    await expect(assertLiveDclRobotsAllowed(live, "ua-test")).rejects.toThrow("(network)");
    expect(calls()).toEqual([PRIMARY]);
    vi.unstubAllGlobals();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) throw new DOMException("t", "TimeoutError");
        if (url === FALLBACK) return http(410);
        return http(200, "User-agent: *\n");
      }),
    );
    await expect(
      assertCauseListFetchAllowed(live, "ua-test", waybackOf()),
    ).resolves.toBeUndefined();
    vi.unstubAllGlobals();
  });

  it("treats a rejected robots body read as a network error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: headersOf(),
        text: async () => {
          throw new Error("body failed");
        },
      }),
    );
    await expect(assertLiveDclRobotsAllowed(live, "ua-test")).rejects.toThrow("(network)");
    expect(calls()).toEqual([PRIMARY]);
    vi.unstubAllGlobals();
  });

  it("treats an HTML 200 without a robots record as a 5xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(http(200, "<html>…", undefined, "text/html")),
    );
    await expect(assertLiveDclRobotsAllowed(live, "ua-test")).rejects.toThrow(
      "robots.txt unavailable (5xx)",
    );
    expect(calls()).toEqual([PRIMARY]);
    vi.unstubAllGlobals();

    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) return http(200, "<html>…", undefined, "text/html");
        return http(404);
      }),
    );
    await expect(
      loadJudiciaryRobotsPrefixes("ua-test", undefined, { allowFallback: true }),
    ).resolves.toEqual([]);
    expect(calls()).toEqual([PRIMARY, FALLBACK]);
    vi.unstubAllGlobals();
  });

  it("obeys a www disallow when wayback falls back from a primary 502", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        if (url === PRIMARY) return http(502);
        if (String(url).includes("www.e-services.judiciary.hk")) {
          return http(200, "User-agent: *\nDisallow: /dcl/view");
        }
        return http(200, "User-agent: *\n");
      }),
    );
    await expect(assertCauseListFetchAllowed(live, "ua-test", waybackOf())).rejects.toThrow(
      /robots\.txt disallows/,
    );
    vi.unstubAllGlobals();
  });

  it("allows a direct www 404 in wayback mode", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => (url === PRIMARY ? http(502) : http(404))),
    );
    await expect(
      loadJudiciaryRobotsPrefixes("ua-test", undefined, { allowFallback: true }),
    ).resolves.toEqual([]);
    expect(calls()).toEqual([PRIMARY, FALLBACK]);
    vi.unstubAllGlobals();
  });

  it("reads at most 512 KiB of a robots body", async () => {
    let reads = 0;
    let cancelled = false;
    const first = new Uint8Array(400 * 1024);
    const second = new Uint8Array(400 * 1024);
    const header = new TextEncoder().encode("User-agent: *\nDisallow:\n");
    first.set(header);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        status: 200,
        ok: true,
        headers: headersOf({ "content-type": "text/plain" }),
        body: {
          getReader: () => ({
            read: async () => {
              reads += 1;
              if (reads === 1) return { done: false, value: first };
              if (reads === 2) return { done: false, value: second };
              return { done: true, value: undefined };
            },
            cancel: async () => {
              cancelled = true;
            },
          }),
        },
        text: async () => {
          throw new Error("full body");
        },
      }),
    );
    await expect(loadJudiciaryRobotsPrefixes("ua-test")).resolves.toEqual([]);
    expect(reads).toBe(2);
    expect(cancelled).toBe(true);
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

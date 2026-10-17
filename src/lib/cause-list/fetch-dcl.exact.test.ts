import { describe, expect, it, vi } from "vitest";
import {
  fetchDclHtml,
  isPathDisallowedByRobots,
  parseRobotsDisallowPrefixes,
} from "./fetch-dcl";

describe("robots.txt", () => {
  it("blocks /dcl via prefix disallow", () => {
    const prefixes = parseRobotsDisallowPrefixes(
      "User-agent: *\nDisallow: /dcl\nDisallow: /private\n",
    );
    expect(isPathDisallowedByRobots("/dcl/view.jsp", prefixes)).toBe(true);
    expect(isPathDisallowedByRobots("/other", prefixes)).toBe(false);
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
});

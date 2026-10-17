import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { buildDclLiveUrl } from "./dcl-url";
import {
  assertLiveDclRobotsAllowed,
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

  it("fetch-cause-list passes the request URL into the robots check", () => {
    const src = readFileSync("scripts/cause-list/fetch-cause-list.ts", "utf8");
    expect(src).toContain("assertLiveDclRobotsAllowed(requestUrl");
    expect(src).not.toContain('"/dcl/"');
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

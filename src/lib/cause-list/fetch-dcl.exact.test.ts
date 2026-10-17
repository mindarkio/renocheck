import { describe, expect, it, vi } from "vitest";
import { fetchDclHtml } from "./fetch-dcl";

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

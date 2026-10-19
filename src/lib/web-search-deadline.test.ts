import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchSerpOrganicHits } from "./web-search";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("fetchSerpOrganicHits deadline (PR24 S1)", () => {
  it("does not call fetch once the pipeline deadline has passed", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key-not-real");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await expect(
      fetchSerpOrganicHits("q", { pages: 2, deadlineMs: Date.now() - 1 }),
    ).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caps the per-attempt timeout at the remaining deadline", async () => {
    vi.stubEnv("SERPER_API_KEY", "test-key-not-real");
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ organic: [] }), { status: 200 }),
      ),
    );
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    await fetchSerpOrganicHits("q", {
      pages: 1,
      deadlineMs: Date.now() + 5_000,
    });
    const ms = timeoutSpy.mock.calls[0]?.[0] ?? Infinity;
    expect(ms).toBeLessThanOrEqual(5_000);
    expect(ms).toBeGreaterThan(0);
  });
});

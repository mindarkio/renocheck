import { mkdtemp, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FetchFatal } from "../bd-register/fetch-csv";
import { fetchMissingSnapshots } from "./backfill-fetch";
import type { CauseListSnapshot } from "./cdx";

function snap(n: number): CauseListSnapshot {
  const day = String(n).padStart(2, "0");
  return {
    court: "SMT",
    dateDdMmYyyy: `${day}112024`,
    iso: `2024-11-${day}`,
    timestamp: "20241101120000",
    original: `https://e-services.judiciary.hk/dcl/view.jsp?date=${day}112024&court=SMT`,
  };
}

describe("fetchMissingSnapshots rate limit", () => {
  let dir = "";

  afterEach(async () => {
    vi.unstubAllGlobals();
    if (dir) await rm(dir, { recursive: true, force: true });
  });

  it("stops after five consecutive 403s and does not request the rest", async () => {
    dir = await mkdtemp(path.join(tmpdir(), "cause-list-fetch-"));
    const fetchHtml = vi.fn(async () => {
      throw new FetchFatal("fetch failed 403 https://example.test/page");
    });
    const stats = await fetchMissingSnapshots(
      [1, 2, 3, 4, 5, 6, 7].map(snap),
      {
        cacheDir: dir,
        archiveRules: [],
        politeWait: async () => {},
        fetchHtml,
      },
    );
    expect(fetchHtml).toHaveBeenCalledTimes(5);
    expect(stats).toEqual({ fetchFailures: 5, stoppedReason: "rate_limited" });
    expect(await readdir(dir)).toEqual([]);
  });
});

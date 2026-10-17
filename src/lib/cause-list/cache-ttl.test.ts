import { describe, expect, it } from "vitest";
import { mkdir, writeFile, utimes } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { assertCacheFileFresh, CAUSE_LIST_CACHE_TTL_MS } from "./cache-ttl";

describe("assertCacheFileFresh", () => {
  it("throws when file is older than 7 days", async () => {
    const dir = join(tmpdir(), `renocheck-cache-ttl-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const file = join(dir, "stale.csv");
    await writeFile(file, "x", "utf8");
    const eightDaysAgo = new Date(Date.now() - CAUSE_LIST_CACHE_TTL_MS - 24 * 60 * 60 * 1000);
    await utimes(file, eightDaysAgo, eightDaysAgo);
    await expect(assertCacheFileFresh(file, "BD register cache")).rejects.toThrow(
      /older than 7 days/,
    );
  });
});

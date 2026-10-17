import { describe, expect, it } from "vitest";
import { mkdir, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { resolveCandidateRetrievedAt } from "./candidate-meta";
import { sha256Hex } from "./fetch-csv";

describe("resolveCandidateRetrievedAt", () => {
  async function withTempDir(run: (dir: string) => Promise<void>) {
    const dir = join(tmpdir(), `renocheck-bd-meta-${Date.now()}-${Math.random()}`);
    await mkdir(dir, { recursive: true });
    try {
      await run(dir);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  }

  it("returns retrieved_at when sha256 matches candidate file", async () => {
    await withTempDir(async (dir) => {
      const candidate = join(dir, "registers_full_list.csv");
      const meta = join(dir, "registers_full_list.meta.json");
      const body = Buffer.from("synthetic,candidate,bytes\n", "utf8");
      await writeFile(candidate, body);
      await writeFile(
        meta,
        JSON.stringify({
          retrieved_at: "2026-10-17T12:00:00.000Z",
          sha256: sha256Hex(body),
        }),
      );
      await expect(resolveCandidateRetrievedAt(candidate, meta)).resolves.toBe(
        "2026-10-17T12:00:00.000Z",
      );
    });
  });

  it("returns null when sha256 does not match candidate file", async () => {
    await withTempDir(async (dir) => {
      const candidate = join(dir, "registers_full_list.csv");
      const meta = join(dir, "registers_full_list.meta.json");
      await writeFile(candidate, Buffer.from("current-bytes\n", "utf8"));
      await writeFile(
        meta,
        JSON.stringify({
          retrieved_at: "2026-10-17T12:00:00.000Z",
          sha256: "deadbeef",
        }),
      );
      await expect(resolveCandidateRetrievedAt(candidate, meta)).resolves.toBeNull();
    });
  });
});

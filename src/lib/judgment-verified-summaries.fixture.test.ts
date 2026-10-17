import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { parseVerifiedSummariesFile } from "./judgment-verified-summaries";

const FIXTURE = resolve(
  process.cwd(),
  "scripts/fixtures/judgment-summaries-verified.json",
);

describe("judgment-summaries-verified fixture", () => {
  it("parses with zod", () => {
    const raw = JSON.parse(readFileSync(FIXTURE, "utf8"));
    const rows = parseVerifiedSummariesFile(raw);
    expect(rows.length).toBe(70);
    expect(rows.every((r) => r.hearing_points_source === "ai_verified")).toBe(
      true,
    );
  });
});

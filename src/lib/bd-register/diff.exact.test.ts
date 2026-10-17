import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { diffBdMwc } from "./diff";
import { parseBdRegisterCsv } from "./parse";

const BASELINE = readFileSync(
  resolve(__dirname, "fixtures/registers.fixture.csv"),
  "utf8",
);

function buildCandidateCsv(): string {
  const lines = BASELINE.trimEnd().split("\n");
  const header = lines[0]!;
  const body = lines
    .slice(1)
    .filter((line) => !line.startsWith('"MWC 10/2026"'))
    .map((line) =>
      line.includes('"MWC 11/2026"')
        ? line.replace(
            "SYNTHETIC GAMMA CO., LTD. (IN LIQUIDATION)",
            "SYNTHETIC GAMMA RENAMED LIMITED",
          )
        : line,
    );
  body.push(
    '"MWC 13/2026","MWC","","","SYNTHETIC EPSILON LIMITED","合成己有限公司","","","","","","","01/06/2028","","","","","","","","","",""',
  );
  return [header, ...body].join("\n");
}

describe("diffBdMwc (exact)", () => {
  it("reports added, removed, and changed MWC company regNos", () => {
    const base = parseBdRegisterCsv(BASELINE);
    const cand = parseBdRegisterCsv(buildCandidateCsv());
    const diff = diffBdMwc(base, cand);
    expect(diff.added).toEqual(["MWC 13/2026"]);
    expect(diff.removed).toEqual(["MWC 10/2026"]);
    expect(diff.changed).toEqual(["MWC 11/2026"]);
    expect(diff.unchanged).toBe(2);
  });

  it("treats renewalPending change as changed MWC row", () => {
    const base = parseBdRegisterCsv(BASELINE);
    const kappa = base.find((e) => e.regNo === "MWC 15/2026")!;
    const cand = base.map((e) =>
      e.regNo === "MWC 15/2026" ? { ...kappa, renewalPending: true } : e,
    );
    const diff = diffBdMwc(base, cand);
    expect(diff.changed).toEqual(["MWC 15/2026"]);
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { mwcCompanyRegNos, parseBdRegisterCsv } from "./parse";

const FIXTURE = readFileSync(
  resolve(__dirname, "fixtures/registers.fixture.csv"),
  "utf8",
);

describe("parseBdRegisterCsv (exact)", () => {
  it("parses synthetic contractor rows only", () => {
    const entries = parseBdRegisterCsv(FIXTURE);
    expect(entries.map((e) => e.regNo)).toEqual([
      "MWC 10/2026",
      "MWC(W) 88/2026",
      "GBC 20/2026",
      "MWC 11/2026",
    ]);
  });

  it("normalizes company names and strips (IN LIQUIDATION)", () => {
    const entries = parseBdRegisterCsv(FIXTURE);
    const alpha = entries.find((e) => e.regNo === "MWC 10/2026")!;
    expect(alpha.nameEn).toBe("SYNTHETIC ALPHA ENGINEERING LTD");
    expect(alpha.nameZh).toBe("合成甲工程有限公司");

    const gamma = entries.find((e) => e.regNo === "MWC 11/2026")!;
    expect(gamma.nameEn).toBe("SYNTHETIC GAMMA LTD");
    expect(gamma.expiryDate).toBe("2027-10-10");
  });

  it("omits personal names for MWC(W)", () => {
    const ind = parseBdRegisterCsv(FIXTURE).find((e) => e.regNo === "MWC(W) 88/2026")!;
    expect(ind.nameEn).toBeUndefined();
    expect(ind.nameZh).toBeUndefined();
    const blob = JSON.stringify(ind);
    expect(blob).not.toContain("SOLE");
    expect(blob).not.toContain("獨資");
  });

  it("does not leak AS / personal fields in output", () => {
    const blob = JSON.stringify(parseBdRegisterCsv(FIXTURE));
    expect(blob).not.toContain("SHOULD NOT LOG");
    expect(blob).not.toContain("不應輸出");
    expect(blob).not.toContain("IGNORED");
  });

  it("mwcCompanyRegNos counts company MWC only", () => {
    const set = mwcCompanyRegNos(parseBdRegisterCsv(FIXTURE));
    expect([...set].sort()).toEqual(["MWC 10/2026", "MWC 11/2026"]);
  });
});

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parse } from "csv-parse/sync";
import {
  BD_REGISTERS_CSV_COLUMN_COUNT,
  BD_REGISTERS_CSV_HEADER,
} from "./csv-header";
import {
  decodeBdRegisterCsvBytes,
  mwcCompanyRegNos,
  parseBdRegisterCsv,
  parseBdRegisterCsvRows,
  parseBdRegisterCsvWithMeta,
} from "./parse";
import { matchCauseListCases } from "../cause-list/match";
import type { ParsedCauseListCase } from "../cause-list/types";

const FIXTURE = readFileSync(
  resolve(__dirname, "fixtures/registers.fixture.csv"),
  "utf8",
);

function defendantCase(rawName: string): ParsedCauseListCase {
  return {
    court: "SMT",
    caseNo: "T/1",
    hearingDate: "2026-10-16",
    claimNature: "Work Done",
    parties: [{ role: "defendant", rawName }],
  };
}

describe("parseBdRegisterCsv (exact)", () => {
  it("fixture uses official 23-column CSV header", () => {
    const header = FIXTURE.split(/\r?\n/)[0]?.trim() ?? "";
    expect(header).toBe(BD_REGISTERS_CSV_HEADER);
    expect(header.split(",")).toHaveLength(BD_REGISTERS_CSV_COLUMN_COUNT);
  });

  it("parsed row keys match 23-column header list", () => {
    const rows = parse(FIXTURE, {
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
    }) as Record<string, string>[];
    expect(Object.keys(rows[0] ?? {}).sort()).toEqual(
      BD_REGISTERS_CSV_HEADER.split(",").sort(),
    );
  });

  it("parses synthetic contractor rows only (de-duplicated)", () => {
    const entries = parseBdRegisterCsv(FIXTURE);
    expect(entries.map((e) => e.regNo)).toEqual([
      "MWC 10/2026",
      "MWC(W) 88/2026",
      "GBC 20/2026",
      "MWC 11/2026",
      "MWC 12/2026",
      "MWC 14/2026",
      "MWC 15/2026",
    ]);
  });

  it("de-duplicates duplicate AS rows for same regNo", () => {
    const { rawContractorRows, entries } = parseBdRegisterCsvWithMeta(FIXTURE);
    expect(rawContractorRows).toBe(8);
    expect(entries.filter((e) => e.regNo === "MWC 10/2026")).toHaveLength(1);
  });

  it("keeps display company names (not normStrict) and strips (IN LIQUIDATION)", () => {
    const entries = parseBdRegisterCsv(FIXTURE);
    const alpha = entries.find((e) => e.regNo === "MWC 10/2026")!;
    expect(alpha.nameEn).toBe("SYNTHETIC ALPHA ENGINEERING LIMITED");
    expect(alpha.nameZh).toBe("合成甲工程有限公司");
    expect(alpha.normStrictEn).toBe("SYNTHETIC ALPHA ENGINEERING LTD");

    const gamma = entries.find((e) => e.regNo === "MWC 11/2026")!;
    expect(gamma.nameEn).toBe("SYNTHETIC GAMMA CO., LTD.");
    expect(gamma.nameZh).toBe("合成丙有限公司");
    expect(gamma.expiryDate).toBe("2027-10-10");
    expect(gamma.flag).toBe("S");
  });

  it("strips <br> in AS fields without leaking AS text", () => {
    const delta = parseBdRegisterCsv(FIXTURE).find((e) => e.regNo === "MWC 12/2026")!;
    expect(delta.nameEn).toBe("SYNTHETIC DELTA LIMITED");
    const blob = JSON.stringify(delta);
    expect(blob).not.toContain("LINE");
    expect(blob).not.toContain("行一");
  });

  it("omits personal names for MWC(W)", () => {
    const ind = parseBdRegisterCsv(FIXTURE).find((e) => e.regNo === "MWC(W) 88/2026")!;
    expect(ind.nameEn).toBeUndefined();
    expect(ind.nameZh).toBeUndefined();
    const blob = JSON.stringify(ind);
    expect(blob).not.toContain("SOLE");
    expect(blob).not.toContain("獨資");
  });

  it("marks unincorporated MWC without leaking personal names", () => {
    const row = parseBdRegisterCsv(FIXTURE).find((e) => e.regNo === "MWC 14/2026")!;
    expect(row).toEqual({
      registerType: "MWC",
      regNo: "MWC 14/2026",
      expiryDate: "2028-06-01",
      unincorporated: true,
    });
    const blob = JSON.stringify(parseBdRegisterCsv(FIXTURE));
    expect(blob).not.toContain("FAKE PERSON KAPPA");
    expect(blob).not.toContain("假人甲");
  });

  it("does not leak AS / personal fields in output", () => {
    const blob = JSON.stringify(parseBdRegisterCsv(FIXTURE));
    expect(blob).not.toContain("SHOULD NOT LOG");
    expect(blob).not.toContain("不應輸出");
    expect(blob).not.toContain("IGNORED");
  });

  it("mwcCompanyRegNos counts corporate MWC only", () => {
    const set = mwcCompanyRegNos(parseBdRegisterCsv(FIXTURE));
    expect([...set].sort()).toEqual([
      "MWC 10/2026",
      "MWC 11/2026",
      "MWC 12/2026",
      "MWC 15/2026",
    ]);
  });

  it("BOM prefix still parses", () => {
    expect(parseBdRegisterCsv("\uFEFF" + FIXTURE).length).toBe(7);
  });

  it("CRLF fixture parses", () => {
    expect(parseBdRegisterCsv(FIXTURE.replace(/\n/g, "\r\n")).length).toBe(7);
  });

  it("throws on renamed ENGLISH_COMPANY_NAME header", () => {
    const bad = FIXTURE.replace("ENGLISH_COMPANY_NAME", "ENGLISH_CO");
    try {
      parseBdRegisterCsv(bad);
      expect.fail("expected throw");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toMatch(/BD CSV header missing: ENGLISH_COMPANY_NAME/);
      expect(msg).not.toContain("FAKE PERSON");
    }
  });

  it("throws on renamed REGISTRATION_TYPE header", () => {
    const bad = FIXTURE.replace("REGISTRATION_TYPE", "REG_TYPE");
    expect(() => parseBdRegisterCsv(bad)).toThrow(/BD CSV header missing: REGISTRATION_TYPE/);
  });

  it("throws on UTF-16-like content", () => {
    expect(() => parseBdRegisterCsv("\u0000\u0000")).toThrow(/not a UTF-8 CSV/);
  });

  it("throws on XML error page", () => {
    expect(() => parseBdRegisterCsv("<?xml version=\"1.0\"?><Error>AccessDenied</Error>")).toThrow(
      /not a UTF-8 CSV/,
    );
  });

  it("maps FLAG @ to renewalPending (not flag)", () => {
    const header = FIXTURE.split("\n")[0]!;
    const row =
      '"MWC 16/2026","MWC","","","SYNTHETIC LAMBDA LIMITED","合成己有限公司","","","","","","","01/06/2028","@","","","","","","","","",""';
    const entry = parseBdRegisterCsv([header, row].join("\n")).find(
      (e) => e.regNo === "MWC 16/2026",
    )!;
    expect(entry.renewalPending).toBe(true);
    expect(entry.flag).toBeUndefined();
  });

  it("rejects Big5-encoded bytes (not UTF-8)", () => {
    const big5Hk = Buffer.from([0xb9, 0x71, 0xa6, 0x57]);
    expect(() => decodeBdRegisterCsvBytes(big5Hk)).toThrow(/not a UTF-8 CSV/);
  });

  it("throws CSV_INVALID_CLOSING_QUOTE on bad quotes", () => {
    const header = FIXTURE.split("\n")[0]!;
    const bad = `${header}\n"MWC 99/2026","MWC","","","BAD"QUOTE CO","短名有限公司","","","","","","","01/06/2028","","","","","","","","","",""`;
    try {
      parseBdRegisterCsvRows(bad);
      expect.fail("expected throw");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toMatch(/CSV_INVALID_CLOSING_QUOTE/);
      expect(msg).not.toContain("BAD");
      expect(msg).not.toContain("短名");
    }
  });

  it("throws on inconsistent column count", () => {
    const lines = FIXTURE.split("\n");
    const shortRow = `"MWC 99/2026","MWC","","","SHORTCO","短名"`;
    const bad = [lines[0], shortRow].join("\n");
    try {
      parseBdRegisterCsvRows(bad);
      expect.fail("expected throw");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toMatch(/BD CSV parse error/);
      expect(msg).not.toContain("SHORTCO");
      expect(msg).not.toContain("短名");
    }
  });

  it("registry from BD display names supports cause-list C / A tiers", () => {
    const gamma = parseBdRegisterCsv(FIXTURE).find((e) => e.regNo === "MWC 11/2026")!;
    const kappa = parseBdRegisterCsv(FIXTURE).find((e) => e.regNo === "MWC 15/2026")!;
    const registry = [
      {
        id: "gamma",
        namesEn: gamma.nameEn ? [gamma.nameEn] : [],
        namesZh: ["合成丙（香港）有限公司"],
      },
      {
        id: "kappa",
        namesEn: kappa.nameEn ? [kappa.nameEn] : [],
        namesZh: kappa.nameZh ? [kappa.nameZh] : [],
      },
    ];

    const cMatch = matchCauseListCases([defendantCase("合成丙有限公司")], registry);
    expect(cMatch[0]?.confidence).toBe("C");
    expect(cMatch[0]?.reviewOnly).toBe(true);

    const aMatch = matchCauseListCases([defendantCase("合成丙（香港）有限公司")], registry);
    expect(aMatch[0]?.confidence).toBe("A");

    const kZhMatch = matchCauseListCases([defendantCase("合成丁有限公司")], [
      {
        id: "kappa",
        namesEn: kappa.nameEn ? [kappa.nameEn] : [],
        namesZh: ["合成丁（香港）有限公司"],
      },
    ]);
    expect(kZhMatch[0]?.confidence).toBe("C");
    expect(kZhMatch[0]?.reviewOnly).toBe(true);

    const kEnMatch = matchCauseListCases(
      [defendantCase("SYNTHETIC KAPPA (HONG KONG) LIMITED")],
      [
        {
          id: "kappa",
          namesEn: kappa.nameEn ? [kappa.nameEn] : [],
          namesZh: kappa.nameZh ? [kappa.nameZh] : [],
        },
      ],
    );
    expect(kEnMatch[0]?.confidence).toBe("C");
  });
});

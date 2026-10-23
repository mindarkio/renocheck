import { describe, expect, it } from "vitest";
import type { CrApiLocalRow } from "./types";
import { pickMatchedRows, tierForRow } from "./match";

function row(
  brn: string,
  en: string,
  zh = "NULL",
): CrApiLocalRow {
  return {
    Brn: brn,
    English_Company_Name: en,
    Chinese_Company_Name: zh,
    Company_Type: "Private company limited by shares",
    Date_of_Incorporation: "01-01-2020",
    Address_of_Registered_Office: "HK",
  };
}

describe("tierForRow (N1)", () => {
  it("English-first label vs bilingual row → B (B1)", () => {
    const tier = tierForRow(
      {
        Brn: "C2",
        English_Company_Name: "ZZQ TESTING LIMITED",
        Chinese_Company_Name: "合成測試有限公司",
        Company_Type: "Co",
        Date_of_Incorporation: "01-01-2020",
        Address_of_Registered_Office: "HK",
      },
      "ZZQ TESTING LIMITED 合成測試有限公司",
    );
    expect(tier).toBe("B");
  });

  it("3D prefix label vs Chinese row → B (B1)", () => {
    const tier = tierForRow(
      {
        Brn: "C3",
        English_Company_Name: "NULL",
        Chinese_Company_Name: "3D裝修有限公司",
        Company_Type: "Co",
        Date_of_Incorporation: "01-01-2020",
        Address_of_Registered_Office: "HK",
      },
      "3D裝修有限公司",
    );
    expect(tier).toBe("B");
  });

  it("mixed label matches English row only → B", () => {
    const tier = tierForRow(
      {
        Brn: "C1",
        English_Company_Name: "ZZQ TESTING LIMITED",
        Chinese_Company_Name: "NULL",
        Company_Type: "Co",
        Date_of_Incorporation: "01-01-2020",
        Address_of_Registered_Office: "HK",
      },
      "合成測試有限公司 ZZQ TESTING LIMITED",
    );
    expect(tier).toBe("B");
  });
});

describe("pickMatchedRows (M3)", () => {
  const label = "SUN HUNG KAI & CO LIMITED";

  it("[B,C different Brn] → B tier row", () => {
    const pick = pickMatchedRows(
      [
        row("C1111111", "OTHER NAME LIMITED"),
        row("C2222222", "SUN HUNG KAI & CO LIMITED"),
      ],
      label,
    );
    expect(pick).not.toBe("ambiguous");
    if (pick === "ambiguous" || pick === null || pick.tier === "D") {
      throw new Error("expected match");
    }
    expect(pick.tier).toBe("B");
    expect(pick.row.Brn).toBe("C2222222");
  });

  it("[B1,B2] → ambiguous", () => {
    const pick = pickMatchedRows(
      [
        row("C1111111", "SUN HUNG KAI & CO LIMITED"),
        row("C2222222", "SUN HUNG KAI & CO LIMITED"),
      ],
      label,
    );
    expect(pick).toBe("ambiguous");
  });

  it("100 rows with only C tier → null", () => {
    const cLabel = "DECORATION WORKS LIMITED";
    const rows: CrApiLocalRow[] = [];
    for (let i = 0; i < 100; i++) {
      rows.push(
        row(`C${String(i).padStart(7, "0")}`, `DECORATION WORKS (HK) LIMITED`),
      );
    }
    expect(tierForRow(rows[0]!, cLabel)).toBe("C");
    expect(pickMatchedRows(rows, cLabel)).toBe(null);
  });

  it("1–2 rows that are not B/C are grade D candidates, not a match", () => {
    const one = pickMatchedRows(
      [row("C9000001", "OTHER WORKS LIMITED", "其他工程有限公司")],
      "完全唔同有限公司",
    );
    expect(one).toMatchObject({ tier: "D" });
    if (!one || one === "ambiguous" || one.tier !== "D") {
      throw new Error("expected D");
    }
    expect(one.rows).toHaveLength(1);
    expect(one.rows[0]?.Brn).toBe("C9000001");

    const two = pickMatchedRows(
      [
        row("C9000001", "OTHER WORKS LIMITED", "其他工程有限公司"),
        row("C9000002", "ELSE WORKS LIMITED", "別家工程有限公司"),
      ],
      "完全唔同有限公司",
    );
    if (!two || two === "ambiguous" || two.tier !== "D") {
      throw new Error("expected D");
    }
    expect(two.rows).toHaveLength(2);
  });

  it("three non-matching rows are not candidates and not a match", () => {
    expect(
      pickMatchedRows(
        [
          row("C9000001", "OTHER WORKS LIMITED", "其他工程有限公司"),
          row("C9000002", "ELSE WORKS LIMITED", "別家工程有限公司"),
          row("C9000003", "THIRD WORKS LIMITED", "第三工程有限公司"),
        ],
        "完全唔同有限公司",
      ),
    ).toBe(null);
  });
});

import { describe, expect, it } from "vitest";
import { companiesRegistrySchema } from "../report-schema";
import { mapCrApiRowToSnapshot } from "./map-row";
import type { CrApiLocalRow } from "./types";

describe("mapCrApiRowToSnapshot (L4)", () => {
  it("slices long names and parses valid ISO date", () => {
    const longEn = "A".repeat(300);
    const row: CrApiLocalRow = {
      Brn: "C1234567",
      English_Company_Name: longEn,
      Chinese_Company_Name: "測".repeat(250),
      Company_Type: "T".repeat(200),
      Date_of_Incorporation: "15-03-2024",
      Address_of_Registered_Office: "HK",
    };
    const mapped = mapCrApiRowToSnapshot(row, {
      matchTier: "B",
      retrievedAt: "2026-10-18T12:00:00.000Z",
    });
    expect(mapped.nameEn?.length).toBe(200);
    expect(mapped.nameZh?.length).toBe(200);
    expect(mapped.companyType?.length).toBe(120);
    expect(mapped.incorporationDate).toBe("2024-03-15");

    const official = companiesRegistrySchema.parse({
      lookupStatus: "ok",
      matched: true,
      matchTier: mapped.matchTier,
      brNo: mapped.brNo,
      companyType: mapped.companyType,
      nameZh: mapped.nameZh,
      nameEn: mapped.nameEn,
      incorporationDate: mapped.incorporationDate,
      retrievedAt: mapped.retrievedAt,
      hints: mapped.hints,
      icrisHomeUrl: mapped.icrisHomeUrl,
    });
    expect(official.nameEn?.length).toBe(200);
  });

  it("drops invalid incorporation ISO", () => {
    const mapped = mapCrApiRowToSnapshot(
      {
        Brn: "C1234567",
        English_Company_Name: "TEST",
        Chinese_Company_Name: "NULL",
        Company_Type: "Co",
        Date_of_Incorporation: "bad",
        Address_of_Registered_Office: "HK",
      },
      { matchTier: "B", retrievedAt: "2026-10-18T12:00:00.000Z" },
    );
    expect(mapped.incorporationDate).toBeUndefined();
  });
});

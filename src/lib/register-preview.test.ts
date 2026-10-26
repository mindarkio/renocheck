import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { buildRegisterPreview } from "./register-preview";
import {
  MWC_NAME_CANDIDATE_LIMIT,
  resetMwcCompanyNameEnColumnProbeForTests,
  type MwcRow,
} from "./mwc-lookup";

function row(
  companyName: string,
  registrationNo: string,
): MwcRow {
  return {
    company_name: companyName,
    company_name_en: null,
    phone: "90000000",
    registration_no: registrationNo,
    expiry_date: null,
    primary_signatory_name: "合成簽署",
    source_updated_at: null,
  };
}

function client(rows: MwcRow[]): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        ilike: () => ({
          limit: async () => ({ data: rows, error: null }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("buildRegisterPreview", () => {
  beforeEach(() => {
    resetMwcCompanyNameEnColumnProbeForTests();
  });

  it("returns a picker for 2 and 8 rows, with the exact-row tag, and no phone", async () => {
    const two = await buildRegisterPreview(
      client([
        row("合成設計有限公司", "MWC 2/2026"),
        row("合成設計", "MWC(W) 1/2026"),
      ]),
      "合成設計",
    );
    expect(two.matchCount).toBe(2);
    expect(two.windowFull).toBe(false);
    expect(two.candidates).toHaveLength(2);
    expect(two.candidates[0]).toMatchObject({
      companyName: "合成設計",
      registrationNo: "MWC(W) 1/2026",
      exact: true,
    });
    expect(two.candidates[1]?.exact).toBe(false);
    const packed = JSON.stringify(two);
    expect(packed).not.toContain("90000000");
    expect(packed).not.toContain("合成簽署");
    expect(packed).not.toContain("phone");

    const eight = await buildRegisterPreview(
      client(
        Array.from({ length: 8 }, (_, i) => row(`合成設計${i}有限公司`, `MWC ${i}/2026`)),
      ),
      "合成設計",
    );
    expect(eight.matchCount).toBe(8);
    expect(eight.candidates).toHaveLength(8);
  });

  it("withholds the list at 9 rows and when the lookup window is full", async () => {
    const nine = await buildRegisterPreview(
      client(Array.from({ length: 9 }, (_, i) => row(`合成設計${i}有限公司`, `MWC ${i}/2026`))),
      "合成設計",
    );
    expect(nine.matchCount).toBe(9);
    expect(nine.windowFull).toBe(false);
    expect(nine.candidates).toEqual([]);

    const capped = await buildRegisterPreview(
      client(
        Array.from({ length: MWC_NAME_CANDIDATE_LIMIT }, (_, i) =>
          row(`合成設計${i}有限公司`, `MWC ${i}/2026`),
        ),
      ),
      "合成設計",
    );
    expect(capped.matchCount).toBe(20);
    expect(capped.windowFull).toBe(true);
    expect(capped.candidates).toEqual([]);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  lookupMwcWithMeta,
  resetMwcCompanyNameEnColumnProbeForTests,
  type MwcRow,
} from "./mwc-lookup";

const supabaseError = { data: null, error: { message: "x" } };

const hangWai: MwcRow = {
  company_name: "恆偉工程公司",
  company_name_en: "HANG WAI ENGINEERING LIMITED",
  phone: null,
  registration_no: "MWC-00001",
  expiry_date: null,
  primary_signatory_name: null,
  source_updated_at: null,
};

function nameLookupClient(
  onIlike: (
    column: string,
    pattern: string,
  ) => { data: MwcRow[] | null; error: { message: string; code?: string } | null },
): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        ilike: (column: string, pattern: string) => ({
          limit: async () => onIlike(column, pattern),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

describe("lookupMwcWithMeta", () => {
  beforeEach(() => {
    resetMwcCompanyNameEnColumnProbeForTests();
  });
  it("throws mwc_lookup_failed when company name query returns error", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          ilike: () => ({
            limit: async () => supabaseError,
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      lookupMwcWithMeta(supabase, {
        matchType: "company_name",
        companyName: "合成測試有限公司",
      }),
    ).rejects.toThrow("mwc_lookup_failed");
  });

  it("throws mwc_lookup_failed when phone query returns error", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            limit: () => ({
              maybeSingle: async () => supabaseError,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      lookupMwcWithMeta(supabase, {
        matchType: "phone",
        phone: "91234567",
      }),
    ).rejects.toThrow("mwc_lookup_failed");
  });

  it("throws mwc_lookup_failed when br query returns error", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          ilike: () => ({
            limit: () => ({
              maybeSingle: async () => supabaseError,
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;

    await expect(
      lookupMwcWithMeta(supabase, {
        matchType: "br",
        br: "12345678",
      }),
    ).rejects.toThrow("mwc_lookup_failed");
  });

  it("escapes ilike wildcards in the BR pattern", async () => {
    const patterns: string[] = [];
    const supabase = {
      from: () => ({
        select: () => ({
          ilike: (_column: string, pattern: string) => {
            patterns.push(pattern);
            return {
              limit: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
            };
          },
        }),
      }),
    } as unknown as SupabaseClient;
    await lookupMwcWithMeta(supabase, { matchType: "br", br: "12_34%" });
    expect(patterns).toEqual(["%12\\_34\\%%"]);
  });

  it("finds 恒偉 via the 恆偉 variant and escapes ilike wildcards", async () => {
    const patterns: string[] = [];
    const supabase = nameLookupClient((column, pattern) => {
      patterns.push(`${column}:${pattern}`);
      if (column === "company_name_en") {
        return {
          data: null,
          error: {
            code: "PGRST204",
            message:
              "Could not find the 'company_name_en' column of 'mwc_contractors' in the schema cache",
          },
        };
      }
      if (pattern.includes("恆偉")) return { data: [hangWai], error: null };
      return { data: [], error: null };
    });

    const found = await lookupMwcWithMeta(supabase, {
      matchType: "company_name",
      companyName: "恒偉工程公司",
    });
    expect(found.row?.company_name).toBe("恆偉工程公司");
    expect(found.ambiguous).toBe(false);
    expect(patterns.some((p) => p.includes("\\_"))).toBe(false);

    const wildcards: string[] = [];
    const wildcardClient = nameLookupClient((column, pattern) => {
      wildcards.push(pattern);
      if (column === "company_name_en") {
        return {
          data: null,
          error: {
            code: "42703",
            message: "column mwc_contractors.company_name_en does not exist",
          },
        };
      }
      return { data: [], error: null };
    });
    await lookupMwcWithMeta(wildcardClient, {
      matchType: "company_name",
      companyName: "A_B%工程",
    });
    expect(wildcards.some((pattern) => pattern.includes("A\\_B\\%工程"))).toBe(
      true,
    );
  });

  it("searches company_name_en and then skips it after a missing-column error", async () => {
    const columns: string[] = [];
    const supabase = nameLookupClient((column, pattern) => {
      columns.push(column);
      if (column === "company_name") return { data: [], error: null };
      if (pattern.includes("HANG WAI")) return { data: [hangWai], error: null };
      return { data: [], error: null };
    });
    const found = await lookupMwcWithMeta(supabase, {
      matchType: "company_name",
      companyName: "HANG WAI ENGINEERING LIMITED",
    });
    expect(found.row?.registration_no).toBe("MWC-00001");
    expect(columns).toContain("company_name_en");

    columns.length = 0;
    resetMwcCompanyNameEnColumnProbeForTests();
    const missing = nameLookupClient((column) => {
      columns.push(column);
      if (column === "company_name_en") {
        return {
          data: null,
          error: {
            code: "PGRST204",
            message:
              "Could not find the 'company_name_en' column of 'mwc_contractors' in the schema cache",
          },
        };
      }
      return { data: [], error: null };
    });
    await lookupMwcWithMeta(missing, {
      matchType: "company_name",
      companyName: "SYNTH ALPHA LIMITED",
    });
    expect(columns).toContain("company_name_en");
    const afterProbe = columns.length;
    await lookupMwcWithMeta(missing, {
      matchType: "company_name",
      companyName: "SYNTH BETA LIMITED",
    });
    const enCallsAfter = columns
      .slice(afterProbe)
      .filter((column) => column === "company_name_en").length;
    expect(enCallsAfter).toBe(0);
  });

  describe("company_name_en query scope (review fix)", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("does not query company_name_en for Han terms", async () => {
      const columns: string[] = [];
      const supabase = nameLookupClient((column) => {
        columns.push(column);
        return { data: [], error: null };
      });
      await lookupMwcWithMeta(supabase, {
        matchType: "company_name",
        companyName: "合成測試有限公司",
      });
      expect(columns.length).toBeGreaterThan(0);
      expect(columns).not.toContain("company_name_en");
    });

    it("re-probes company_name_en after the absent window", async () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-10-23T18:00:00.000Z"));
      const columns: string[] = [];
      let missingColumn = true;
      const supabase = nameLookupClient((column) => {
        columns.push(column);
        if (column === "company_name_en" && missingColumn) {
          return {
            data: null,
            error: {
              code: "42703",
              message: "column mwc_contractors.company_name_en does not exist",
            },
          };
        }
        return { data: [], error: null };
      });
      await lookupMwcWithMeta(supabase, {
        matchType: "company_name",
        companyName: "SYNTH ALPHA LIMITED",
      });
      missingColumn = false;
      columns.length = 0;
      await lookupMwcWithMeta(supabase, {
        matchType: "company_name",
        companyName: "SYNTH BETA LIMITED",
      });
      expect(columns).not.toContain("company_name_en");
      vi.setSystemTime(new Date("2026-10-23T18:11:00.000Z"));
      await lookupMwcWithMeta(supabase, {
        matchType: "company_name",
        companyName: "SYNTH BETA LIMITED",
      });
      expect(columns).toContain("company_name_en");
    });
  });

  describe("company_name + company_name_en merge (review tests)", () => {
    const synth = (reg: string, en: string): MwcRow => ({
      company_name: `合成${reg}工程有限公司`,
      company_name_en: en,
      phone: null,
      registration_no: reg,
      expiry_date: null,
      primary_signatory_name: null,
      source_updated_at: null,
    });

    it("dedupes the same registration across both columns and stays unambiguous", async () => {
      const row = synth("MWC-90001", "SYNTH ALPHA LIMITED");
      const supabase = nameLookupClient(() => ({ data: [row], error: null }));
      const found = await lookupMwcWithMeta(supabase, {
        matchType: "company_name",
        companyName: "SYNTH ALPHA LIMITED",
      });
      expect(found.row?.registration_no).toBe("MWC-90001");
      expect(found.ambiguous).toBe(false);
    });

    it("one company_name hit plus a different company_name_en hit is ambiguous", async () => {
      const supabase = nameLookupClient((column) => ({
        data: [
          column === "company_name"
            ? synth("MWC-90001", "SYNTH ALPHA LIMITED")
            : synth("MWC-90002", "SYNTH ALPHA HOLDINGS LIMITED"),
        ],
        error: null,
      }));
      const found = await lookupMwcWithMeta(supabase, {
        matchType: "company_name",
        companyName: "SYNTH ALPHA",
      });
      expect(found.row?.registration_no).toBe("MWC-90001");
      expect(found.ambiguous).toBe(true);
    });

    it("throws when company_name_en fails for a reason other than a missing column", async () => {
      const supabase = nameLookupClient((column) =>
        column === "company_name_en"
          ? { data: null, error: { code: "57014", message: "canceling statement due to statement timeout" } }
          : { data: [], error: null },
      );
      await expect(
        lookupMwcWithMeta(supabase, {
          matchType: "company_name",
          companyName: "SYNTH ALPHA LIMITED",
        }),
      ).rejects.toThrow("mwc_lookup_failed");

      const otherColumn = nameLookupClient((column) =>
        column === "company_name_en"
          ? { data: null, error: { code: "42703", message: "column mwc_contractors.other_col does not exist" } }
          : { data: [], error: null },
      );
      await expect(
        lookupMwcWithMeta(otherColumn, {
          matchType: "company_name",
          companyName: "SYNTH ALPHA LIMITED",
        }),
      ).rejects.toThrow("mwc_lookup_failed");
    });
  });
});

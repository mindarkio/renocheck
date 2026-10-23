import { beforeEach, describe, expect, it } from "vitest";
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
      companyName: "合成測試有限公司",
    });
    const afterProbe = columns.length;
    await lookupMwcWithMeta(missing, {
      matchType: "company_name",
      companyName: "另一合成有限公司",
    });
    const enCallsAfter = columns
      .slice(afterProbe)
      .filter((column) => column === "company_name_en").length;
    expect(enCallsAfter).toBe(0);
  });
});

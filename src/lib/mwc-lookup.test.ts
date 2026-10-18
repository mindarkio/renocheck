import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupMwcWithMeta } from "./mwc-lookup";

const supabaseError = { data: null, error: { message: "x" } };

describe("lookupMwcWithMeta", () => {
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
});

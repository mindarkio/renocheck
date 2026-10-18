import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { lookupMwcWithMeta } from "./mwc-lookup";

describe("lookupMwcWithMeta", () => {
  it("throws mwc_lookup_failed when supabase returns error", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          ilike: () => ({
            limit: async () => ({
              data: null,
              error: { message: "x" },
            }),
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
});

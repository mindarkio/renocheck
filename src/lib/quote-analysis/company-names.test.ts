import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  error: null as { code?: string; message?: string } | null,
  eqs: [] as Array<[string, string]>,
}));

vi.mock("@/lib/db-guard", () => ({
  assertNotProdDbOutsideProd: () => {},
}));

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      update: () => {
        const query = {
          eq(column: string, value: string) {
            state.eqs.push([column, value]);
            return query;
          },
          then(resolve: (value: { error: typeof state.error }) => void) {
            resolve({ error: state.error });
          },
        };
        return query;
      },
    }),
  }),
}));

import { saveQuoteCompanyNames } from "./company-names";

const USER = "11111111-1111-4111-8111-111111111111";
const OTHER = "99999999-9999-4999-8999-999999999999";
const ID = "22222222-2222-4222-8222-222222222222";

describe("saveQuoteCompanyNames", () => {
  beforeEach(() => {
    state.error = null;
    state.eqs = [];
  });

  it("writes both names only for the authenticated owner", async () => {
    const result = await saveQuoteCompanyNames({
      analysisId: ID,
      userId: USER,
      extracted: "合成測試工程有限公司",
      confirmed: "合成測試工程有限公司",
    });
    expect(result).toBe("saved");
    expect(state.eqs).toEqual([
      ["id", ID],
      ["user_id", USER],
    ]);
    expect(state.eqs.some((pair) => pair[1] === OTHER)).toBe(false);
  });

  it("fails soft when the columns are not migrated yet", async () => {
    state.error = {
      code: "PGRST204",
      message: "Could not find the extracted_company_name column of quote_analyses in the schema cache",
    };
    await expect(
      saveQuoteCompanyNames({
        analysisId: ID,
        userId: USER,
        extracted: "合成測試工程有限公司",
      }),
    ).resolves.toBe("skipped");
  });

  it("is removed with the quote row on purge and account deletion", () => {
    const migration = readFileSync(
      "supabase/migrations/20261028140000_quote_analysis_company_names.sql",
      "utf8",
    );
    expect(migration).toContain("add column if not exists extracted_company_name text");
    expect(migration).toContain("add column if not exists confirmed_company_name text");
    expect(migration).toMatch(/char_length\(extracted_company_name\) <= 100\b/);
    expect(migration).toMatch(/char_length\(confirmed_company_name\) <= 100\b/);
    expect(migration).not.toMatch(/pg_catalog\.(least|greatest)/);
    const purge = readFileSync("supabase/migrations/20261023220000_quote_analysis.sql", "utf8");
    expect(purge).toContain("delete from public.quote_analyses");
    const deletion = readFileSync("src/lib/auth/delete-account.ts", "utf8");
    expect(deletion).toContain('.from("quote_analyses")');
    expect(deletion).toContain(".delete()");
  });
});

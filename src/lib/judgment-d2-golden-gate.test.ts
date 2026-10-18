import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  D2_GOLDEN_MWC_COLUMNS,
  D2_MWC_ANON_DENIED_MESSAGE,
  d2MwcFailureText,
  decideD2GoldenRun,
  decideD2MwcDatabase,
  d2GoldenMwcSelectList,
  loadD2GoldenMwcRows,
  selectD2GoldenSupabaseKey,
} from "./judgment-d2-golden-gate";
import { stripSecretEnv } from "../test/strip-secret-env";

const PROD_URL = "https://ProdProjectRef.supabase.co";
const NON_PROD_URL = "https://devprojectref.supabase.co";
const DEFAULT_PROD_URL = "https://lvrasvtilgzwtfsfjbzd.supabase.co";

describe("decideD2GoldenRun", () => {
  it("skips when RUN_D2_GOLDEN is unset", () => {
    const decision = decideD2GoldenRun({});
    expect(decision.action).toBe("skip");
    if (decision.action !== "skip") return;
    expect(decision.reason).toContain("RUN_D2_GOLDEN is not 1");
    expect(decision.reason).toContain("pnpm test:d2");
  });

  it("fails when RUN_D2_GOLDEN=1 and the URL ref is a configured prod ref", () => {
    const decision = decideD2GoldenRun({
      RUN_D2_GOLDEN: "1",
      NEXT_PUBLIC_SUPABASE_URL: PROD_URL,
      SUPABASE_PROD_PROJECT_REFS: " prodprojectref , otherref ",
    });
    expect(decision.action).toBe("fail");
    if (decision.action !== "fail") return;
    expect(decision.reason).toContain("prodprojectref");
    expect(decision.reason).toContain("is listed in SUPABASE_PROD_PROJECT_REFS");
    expect(decision.reason).not.toContain("built-in production project ref");
    expect(decision.reason).toContain("Refusing to read production");
    expect(decision.reason).toContain(D2_MWC_ANON_DENIED_MESSAGE);
    expect(decision.reason).not.toContain("D2_GOLDEN_ALLOW_PROD_READONLY");
  });

  it("fails closed for the default production ref when the env list is unset", () => {
    const decision = decideD2GoldenRun({
      RUN_D2_GOLDEN: "1",
      NEXT_PUBLIC_SUPABASE_URL: DEFAULT_PROD_URL,
    });
    expect(decision.action).toBe("fail");
    if (decision.action !== "fail") return;
    expect(decision.reason).toContain("lvrasvtilgzwtfsfjbzd");
    expect(decision.reason).toContain("is a built-in production project ref");
    expect(decision.reason).not.toContain("listed in SUPABASE_PROD_PROJECT_REFS");
    expect(decision.reason).toContain("Refusing to read production");
  });

  it("fails for the default production ref when the host is uppercase", () => {
    const decision = decideD2GoldenRun({
      RUN_D2_GOLDEN: "1",
      NEXT_PUBLIC_SUPABASE_URL: "https://LVRASVTILGZWTFSFJBZD.supabase.co/",
    });
    expect(decision.action).toBe("fail");
    if (decision.action !== "fail") return;
    expect(decision.reason).toContain("lvrasvtilgzwtfsfjbzd");
    expect(decision.reason).toContain("is a built-in production project ref");
    expect(decision.reason).toContain("Refusing to read production");
  });

  it("fails for an unrecognised host", () => {
    const decision = decideD2GoldenRun({
      RUN_D2_GOLDEN: "1",
      NEXT_PUBLIC_SUPABASE_URL: "https://db.example.com",
    });
    expect(decision.action).toBe("fail");
    if (decision.action !== "fail") return;
    expect(decision.reason).toContain("Unrecognised");
  });

  it("fails when the Supabase URL cannot be parsed", () => {
    const decision = decideD2GoldenRun({
      RUN_D2_GOLDEN: "1",
      NEXT_PUBLIC_SUPABASE_URL: "not a url",
    });
    expect(decision).toEqual({
      action: "fail",
      reason: "Invalid Supabase URL.",
    });
  });

  it("runs for a local Supabase URL", () => {
    expect(
      decideD2GoldenRun({
        RUN_D2_GOLDEN: "1",
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      }),
    ).toEqual({ action: "run" });
  });

  it("refuses a prod ref even when the old read-only allow flag is set", () => {
    for (const decision of [
      decideD2GoldenRun({
        RUN_D2_GOLDEN: "1",
        NEXT_PUBLIC_SUPABASE_URL: DEFAULT_PROD_URL,
        D2_GOLDEN_ALLOW_PROD_READONLY: "1",
      }),
      decideD2MwcDatabase({
        NEXT_PUBLIC_SUPABASE_URL: PROD_URL,
        SUPABASE_PROD_PROJECT_REFS: "prodprojectref",
        D2_GOLDEN_ALLOW_PROD_READONLY: "1",
      }),
    ]) {
      expect(decision.action).toBe("fail");
      if (decision.action !== "fail") return;
      expect(decision.reason).toContain("Refusing to read production");
      expect(decision.reason).toContain(D2_MWC_ANON_DENIED_MESSAGE);
    }
  });

  it("runs when RUN_D2_GOLDEN=1 and the URL ref is not in the prod list", () => {
    expect(
      decideD2GoldenRun({
        RUN_D2_GOLDEN: "1",
        SUPABASE_URL: NON_PROD_URL,
        SUPABASE_PROD_PROJECT_REFS: "prodprojectref",
      }),
    ).toEqual({ action: "run" });
  });
});

describe("decideD2MwcDatabase", () => {
  it("fails for the production project URL", () => {
    expect(
      decideD2MwcDatabase({
        NEXT_PUBLIC_SUPABASE_URL: "https://lvrasvtilgzwtfsfjbzd.supabase.co",
      }).action,
    ).toBe("fail");
  });

  it("fails for an unrecognised host", () => {
    expect(
      decideD2MwcDatabase({
        NEXT_PUBLIC_SUPABASE_URL: "https://example.com",
      }).action,
    ).toBe("fail");
  });

  it("runs for local Supabase", () => {
    expect(
      decideD2MwcDatabase({
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      }).action,
    ).toBe("run");
  });

  it("filter script does not read .env.local and calls the prod gate", () => {
    const source = readFileSync(
      resolve(process.cwd(), "scripts/filter-judgment-candidates-d2.ts"),
      "utf8",
    );
    expect(source).not.toContain(".env.local");
    expect(source).not.toContain("loadEnvFile");
    expect(source).not.toContain("dotenv");
    // `process.env` is the explicit shell export, not a dotenv file load.
    expect(source.replaceAll("process.env", "")).not.toContain(".env");
    expect(source).toContain("decideD2MwcDatabase(");
  });

  it("write-golden script does not read .env.local and calls the prod gate", () => {
    const source = readFileSync(
      resolve(process.cwd(), "scripts/write-judgment-d2-filter-golden.ts"),
      "utf8",
    );
    expect(source).not.toContain(".env.local");
    expect(source).not.toContain("loadEnvFile");
    expect(source).not.toContain("dotenv");
    // `process.env` is the explicit shell export, not a dotenv file load.
    expect(source.replaceAll("process.env", "")).not.toContain(".env");
    expect(source).toContain("decideD2MwcDatabase(");
  });
});

describe("selectD2GoldenSupabaseKey", () => {
  it("uses the anon key and ignores a service-role value", () => {
    const choice = selectD2GoldenSupabaseKey({
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-test-value",
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test-value",
    });
    expect(choice).toEqual({
      ok: true,
      key: "anon-test-value",
      source: "anon",
    });
  });

  it("never uses a service-role key", () => {
    const allowFlag = `D2_GOLDEN_${"ALLOW"}_SERVICE_ROLE`;
    const choice = selectD2GoldenSupabaseKey({
      SUPABASE_SERVICE_ROLE_KEY: "x",
      [allowFlag]: "1",
    });
    expect(choice.ok).toBe(false);
    if (choice.ok) return;
    expect(choice.reason).toBe(
      "D2 golden needs NEXT_PUBLIC_SUPABASE_ANON_KEY (service role is never used).",
    );
  });
});

describe("D2 golden MWC select", () => {
  it("selects company_name and registration_no only", () => {
    expect([...D2_GOLDEN_MWC_COLUMNS]).toEqual([
      "company_name",
      "registration_no",
    ]);
    expect(d2GoldenMwcSelectList()).toBe("company_name, registration_no");
  });
});

type NameRow = { company_name: string; registration_no: string };

function nameRows(count: number, start = 0): NameRow[] {
  return Array.from({ length: count }, (_, i) => ({
    company_name: `Co ${start + i}`,
    registration_no: `MWC ${start + i}`,
  }));
}

function errorClient(error: { code?: string; message?: string }) {
  const client = {
    from(table: string) {
      if (table !== "mwc_contractors") throw new Error(`unexpected table ${table}`);
      return {
        select() {
          return {
            order() {
              return {
                range() {
                  return Promise.resolve({ data: null, error, count: null });
                },
              };
            },
          };
        },
      };
    },
  };
  return client as unknown as Pick<SupabaseClient, "from">;
}

function fakeMwcClient(pages: NameRow[][], count: number) {
  const selectArgs: unknown[][] = [];
  const orderCalls: Array<[string, { ascending: boolean }]> = [];
  let index = 0;
  const client = {
    from(table: string) {
      if (table !== "mwc_contractors") throw new Error(`unexpected table ${table}`);
      return {
        select(...args: unknown[]) {
          selectArgs.push(args);
          return {
            order(column: string, options: { ascending: boolean }) {
              orderCalls.push([column, options]);
              return {
                range(from: number, to: number) {
                  if (to !== from + 999) throw new Error(`unexpected range ${from}-${to}`);
                  const data = pages[index] ?? [];
                  index += 1;
                  return Promise.resolve({ data, error: null, count });
                },
              };
            },
          };
        },
      };
    },
  };
  return {
    client: client as unknown as Pick<SupabaseClient, "from">,
    selectArgs,
    orderCalls,
  };
}

describe("loadD2GoldenMwcRows", () => {
  it("pages 1000/1000/341 when count is 2341", async () => {
    const { client, selectArgs, orderCalls } = fakeMwcClient(
      [nameRows(1000, 0), nameRows(1000, 1000), nameRows(341, 2000)],
      2341,
    );
    const rows = await loadD2GoldenMwcRows(client);
    expect(rows).toHaveLength(2341);
    expect(rows[0]?.primary_signatory_name).toBeNull();
    expect(rows[0]?.phone).toBeNull();
    expect(selectArgs.length).toBeGreaterThan(0);
    for (const args of selectArgs) {
      expect(args[0]).toBe("company_name, registration_no");
      expect(args[1]).toEqual({ count: "exact" });
    }
    expect(orderCalls).toEqual(
      selectArgs.map(() => ["id", { ascending: true }]),
    );
  });

  it("accepts short pages 500/500/0 when count is 1000", async () => {
    const { client } = fakeMwcClient([nameRows(500, 0), nameRows(500, 500), []], 1000);
    const rows = await loadD2GoldenMwcRows(client);
    expect(rows).toHaveLength(1000);
  });

  it("replaces 42501 and permission denied without row text", async () => {
    let thrown: unknown;
    try {
      await loadD2GoldenMwcRows(
        errorClient({
          code: "42501",
          message: "permission denied for table mwc_contractors Co Secret Name",
        }),
      );
    } catch (error) {
      thrown = error;
    }
    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toBe(D2_MWC_ANON_DENIED_MESSAGE);
    expect((thrown as Error).message).not.toContain("Co Secret Name");

    const textual = d2MwcFailureText({
      message: "permission denied for relation mwc_contractors phone 91234567",
    });
    expect(textual).toBe(D2_MWC_ANON_DENIED_MESSAGE);
    expect(textual).not.toContain("91234567");
  });

  it("rejects an empty read", async () => {
    const { client } = fakeMwcClient([[]], 0);
    await expect(loadD2GoldenMwcRows(client)).rejects.toThrow(/too few rows/);
  });

  it("rejects when the pages are shorter than count", async () => {
    const { client } = fakeMwcClient([nameRows(1000, 0), nameRows(500, 1000), []], 2000);
    await expect(loadD2GoldenMwcRows(client)).rejects.toThrow(/row count mismatch/);
  });
});

describe("stripSecretEnv", () => {
  it("removes secret-shaped names and keeps the anon key", () => {
    const env = {
      SUPABASE_SERVICE_ROLE_KEY: "x",
      SUPABASE_SECRET_KEY: "y",
      VITE_SUPABASE_SERVICE_ROLE_KEY: "z",
      NEXT_PUBLIC_SUPABASE_ANON_KEY: "a",
    };
    expect(stripSecretEnv(env).sort()).toEqual([
      "SUPABASE_SECRET_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "VITE_SUPABASE_SERVICE_ROLE_KEY",
    ]);
    expect(env).toEqual({ NEXT_PUBLIC_SUPABASE_ANON_KEY: "a" });
  });

  it("does not leave SUPABASE_SERVICE_ROLE_KEY on process.env", () => {
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import {
  D2_GOLDEN_MWC_COLUMNS,
  SERVICE_ROLE_ENV_NAMES,
  decideD2GoldenRun,
  partitionServiceRoleEnv,
  selectD2GoldenSupabaseKey,
} from "./judgment-d2-golden-gate";

const PROD_URL = "https://ProdProjectRef.supabase.co";
const NON_PROD_URL = "https://devprojectref.supabase.co";

describe("decideD2GoldenRun", () => {
  it("skips when RUN_D2_GOLDEN is unset", () => {
    const decision = decideD2GoldenRun({});
    expect(decision.action).toBe("skip");
    if (decision.action !== "skip") return;
    expect(decision.reason).toContain("RUN_D2_GOLDEN is not 1");
    expect(decision.reason).toContain("pnpm test:d2");
  });

  it("skips when RUN_D2_GOLDEN=1 and the URL ref is a configured prod ref", () => {
    const decision = decideD2GoldenRun({
      RUN_D2_GOLDEN: "1",
      NEXT_PUBLIC_SUPABASE_URL: PROD_URL,
      SUPABASE_PROD_PROJECT_REFS: " prodprojectref , otherref ",
    });
    expect(decision.action).toBe("skip");
    if (decision.action !== "skip") return;
    expect(decision.reason).toContain("prodprojectref");
    expect(decision.reason).toContain("SUPABASE_PROD_PROJECT_REFS");
    expect(decision.reason).toContain("D2_GOLDEN_ALLOW_PROD_READONLY=1");
  });

  it("runs when RUN_D2_GOLDEN=1, the ref is prod, and the read-only allow flag is set", () => {
    expect(
      decideD2GoldenRun({
        RUN_D2_GOLDEN: "1",
        NEXT_PUBLIC_SUPABASE_URL: PROD_URL,
        SUPABASE_PROD_PROJECT_REFS: "prodprojectref",
        D2_GOLDEN_ALLOW_PROD_READONLY: "1",
      }),
    ).toEqual({ action: "run" });
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

describe("selectD2GoldenSupabaseKey", () => {
  it("prefers the anon key and does not require service role", () => {
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

  it("refuses service role unless D2_GOLDEN_ALLOW_SERVICE_ROLE=1", () => {
    const choice = selectD2GoldenSupabaseKey({
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test-value",
    });
    expect(choice.ok).toBe(false);
    if (choice.ok) return;
    expect(choice.reason).toContain("D2_GOLDEN_ALLOW_SERVICE_ROLE=1");
  });

  it("accepts service role only when explicitly allowed and no anon key is set", () => {
    expect(
      selectD2GoldenSupabaseKey({
        D2_GOLDEN_ALLOW_SERVICE_ROLE: "1",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-value",
      }),
    ).toEqual({
      ok: true,
      key: "service-role-test-value",
      source: "service_role",
    });
  });
});

describe("partitionServiceRoleEnv", () => {
  it("drops service-role env names unless the opt-in path is explicitly allowed", () => {
    const blocked = partitionServiceRoleEnv(
      {
        SUPABASE_SERVICE_ROLE_KEY: "service-role-test-value",
        NEXT_PUBLIC_SUPABASE_URL: NON_PROD_URL,
      },
      false,
    );
    expect(blocked.stripped.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(blocked.stripped.NEXT_PUBLIC_SUPABASE_URL).toBe(NON_PROD_URL);
    expect(blocked.serviceRole).toEqual({});

    const allowed = partitionServiceRoleEnv(
      { SUPABASE_SERVICE_ROLE_KEY: "service-role-test-value" },
      true,
    );
    expect(allowed.stripped.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
    expect(allowed.serviceRole).toEqual({
      SUPABASE_SERVICE_ROLE_KEY: "service-role-test-value",
    });
  });

  it("lists the service-role env names stripped from normal Vitest runs", () => {
    expect([...SERVICE_ROLE_ENV_NAMES]).toEqual(["SUPABASE_SERVICE_ROLE_KEY"]);
  });
});

describe("D2 golden MWC select", () => {
  it("selects company_name and registration_no only", () => {
    expect([...D2_GOLDEN_MWC_COLUMNS]).toEqual([
      "company_name",
      "registration_no",
    ]);
  });
});

describe("Vitest service-role strip", () => {
  it("does not leave SUPABASE_SERVICE_ROLE_KEY on process.env", () => {
    expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeUndefined();
  });
});

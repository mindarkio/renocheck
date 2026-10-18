import { afterEach, describe, expect, it, vi } from "vitest";

const { searchCrLocalByNameBeginsWith, searchCrLocalByBrnEqual } = vi.hoisted(
  () => ({
    searchCrLocalByNameBeginsWith: vi.fn(),
    searchCrLocalByBrnEqual: vi.fn(),
  }),
);

vi.mock("./cr-register/client", () => ({
  searchCrLocalByNameBeginsWith,
  searchCrLocalByBrnEqual,
}));

import { clearCrRegistryCacheForTests } from "./cr-register/memory-cache";
import { resetCrApiThrottleForTests } from "./cr-register/throttle";
import {
  isCrCircuitOpen,
  resetCrCircuitBreakerForTests,
} from "./cr-register/circuit-breaker";
import type { CrApiLocalRow } from "./cr-register/types";
import { allNameSearchPrefixAttempts } from "./cr-register/prefix";
import { lookupCompaniesRegistryForSearch } from "./cr-registry-lookup";
import { companyNameOnlySearchInput } from "./normalize-search-input";
import {
  shouldShowMwcMissFallbackNote,
  shouldShowMwcMissWithCrFoundNote,
  shouldShowUnverifiedCompanyRegistrationAlert,
} from "./unverified-company-registration";
import { REPORT_VERSION } from "./constants";
import { buildEvaluationStub } from "./evaluation-stub";
import type { RiskReport } from "./report-schema";
import { CR_ESERVICES_URL } from "./report-trust-copy-zh";

function row(en: string, brn = "C1566911"): CrApiLocalRow {
  return {
    Brn: brn,
    English_Company_Name: en,
    Chinese_Company_Name: "NULL",
    Company_Type: "Private company limited by shares",
    Date_of_Incorporation: "01-01-2020",
    Address_of_Registered_Office: "HK",
  };
}

afterEach(() => {
  vi.clearAllMocks();
  clearCrRegistryCacheForTests();
  resetCrApiThrottleForTests();
  resetCrCircuitBreakerForTests();
});

describe("lookupCompaniesRegistryForSearch", () => {
  it("SUN HUNG KAI prefix → tier B match (B1)", async () => {
    searchCrLocalByNameBeginsWith.mockResolvedValue({
      kind: "rows",
      rows: [row("SUN HUNG KAI & CO LIMITED")],
    });
    const official = await lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput("SUN HUNG KAI & CO LIMITED"),
      "SUN HUNG KAI & CO LIMITED",
      null,
    );
    expect(official.lookupStatus).toBe("ok");
    expect(official.matched).toBe(true);
    expect(official.matchTier).toBe("B");
    expect(official.hints).not.toContain("not_found_in_active_list");
    expect(searchCrLocalByNameBeginsWith).toHaveBeenCalledWith(
      "SUN HUNG KAI",
      expect.anything(),
    );
  });

  it("all prefix attempts 400 → not_found", async () => {
    searchCrLocalByNameBeginsWith.mockResolvedValue({ kind: "no_result" });
    const official = await lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput("合成測試有限公司"),
      "合成測試有限公司",
      null,
    );
    expect(official.hints).toContain("not_found_in_active_list");
  });

  it("Brn 400 + name hit → tier B, no not_found (M7)", async () => {
    searchCrLocalByBrnEqual.mockResolvedValue({ kind: "no_result" });
    searchCrLocalByNameBeginsWith.mockResolvedValue({
      kind: "rows",
      rows: [
        {
          Brn: "C9999999",
          English_Company_Name: "NULL",
          Chinese_Company_Name: "合成測試有限公司",
          Company_Type: "Co",
          Date_of_Incorporation: "01-01-2020",
          Address_of_Registered_Office: "HK",
        },
      ],
    });
    const official = await lookupCompaniesRegistryForSearch(
      {
        companyName: "合成測試有限公司",
        br: "C1234567",
        matchType: "br",
      },
      "合成測試有限公司",
      null,
    );
    expect(official.matched).toBe(true);
    expect(official.matchTier).toBe("B");
    expect(official.hints).not.toContain("not_found_in_active_list");
  });

  it("Brn hit but name mismatch → inconclusive, no MWC note (M7)", async () => {
    searchCrLocalByBrnEqual.mockResolvedValue({
      kind: "rows",
      rows: [row("COMPLETELY DIFFERENT LIMITED")],
    });
    const official = await lookupCompaniesRegistryForSearch(
      {
        companyName: "合成測試有限公司",
        br: "C1234567",
        matchType: "br",
      },
      "合成測試有限公司",
      null,
    );
    expect(official.matched).toBe(false);
    const report = riskReportFromCr(official);
    expect(shouldShowMwcMissWithCrFoundNote(report)).toBe(false);
    expect(shouldShowUnverifiedCompanyRegistrationAlert(report)).toBe(false);
  });

  it("phone search → skipped", async () => {
    const official = await lookupCompaniesRegistryForSearch(
      { phone: "91234567", matchType: "phone" },
      "91234567",
      null,
    );
    expect(official.lookupStatus).toBe("skipped");
  });

  it("mixed label: English-only row → tier B (N1)", async () => {
    searchCrLocalByNameBeginsWith.mockImplementation(async (prefix) => {
      if (prefix === "ZZQ TESTING" || prefix === "ZZQ DECORATION") {
        return {
          kind: "rows",
          rows: [row("ZZQ TESTING LIMITED")],
        };
      }
      return { kind: "no_result" };
    });
    const label = "合成測試有限公司 ZZQ TESTING LIMITED";
    const official = await lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput(label),
      label,
      null,
    );
    expect(official.matched).toBe(true);
    expect(official.matchTier).toBe("B");
  });

  it("合成測試有限公司 all 400 → 2 fetches (N4 cache)", async () => {
    searchCrLocalByNameBeginsWith.mockResolvedValue({ kind: "no_result" });
    await lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput("合成測試有限公司"),
      "合成測試有限公司",
      null,
    );
    expect(searchCrLocalByNameBeginsWith).toHaveBeenCalledTimes(2);
  });

  it("mixed label all 400 → 4 fetches (N4)", async () => {
    searchCrLocalByNameBeginsWith.mockResolvedValue({ kind: "no_result" });
    await lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput("ABC裝修有限公司 ABC DECORATION LIMITED"),
      "ABC裝修有限公司 ABC DECORATION LIMITED",
      null,
    );
    expect(searchCrLocalByNameBeginsWith).toHaveBeenCalledTimes(4);
  });

  it("long mixed label all 400 → at most 4 fetches (c-L4)", async () => {
    searchCrLocalByNameBeginsWith.mockResolvedValue({ kind: "no_result" });
    const label = "合成工程有限公司（香港） ZZQ ENGINEERING LIMITED (HK)";
    expect(allNameSearchPrefixAttempts(label).length).toBeGreaterThan(4);
    const official = await lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput(label),
      label,
      null,
    );
    expect(searchCrLocalByNameBeginsWith.mock.calls.length).toBeLessThanOrEqual(
      4,
    );
    expect(official.hints).toContain("not_found_in_active_list");
  });

  it("lookup budget exceeded → lookupStatus timeout (c-L5)", async () => {
    vi.useFakeTimers();
    searchCrLocalByNameBeginsWith.mockImplementation(
      (_prefix, options?: { signal?: AbortSignal }) =>
        new Promise((resolve) => {
          const signal = options?.signal;
          const onAbort = () =>
            resolve({ kind: "error", message: "timeout" });
          if (!signal) {
            resolve({ kind: "no_result" });
            return;
          }
          if (signal.aborted) onAbort();
          else signal.addEventListener("abort", onAbort, { once: true });
        }),
    );
    const label = "合成測試有限公司";
    const pending = lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput(label),
      label,
      null,
    );
    await vi.advanceTimersByTimeAsync(6001);
    const official = await pending;
    expect(official.lookupStatus).toBe("timeout");
    expect(isCrCircuitOpen()).toBe(false);
    vi.useRealTimers();
  });

  it("truncated prefix C rows + full prefix B row → tier B (N4)", async () => {
    const cRows: CrApiLocalRow[] = [];
    for (let i = 0; i < 100; i++) {
      cRows.push(row(`DECORATION WORKS (HK ${i}) LIMITED`, `C${String(i).padStart(7, "0")}`));
    }
    searchCrLocalByNameBeginsWith.mockImplementation(async (prefix) => {
      if (prefix === "DECORATION WORKS") {
        return { kind: "rows", rows: cRows };
      }
      if (prefix === "DECORATION WORKS LIMITED") {
        return {
          kind: "rows",
          rows: [row("DECORATION WORKS LIMITED")],
        };
      }
      return { kind: "no_result" };
    });
    const official = await lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput("DECORATION WORKS LIMITED"),
      "DECORATION WORKS LIMITED",
      null,
    );
    expect(official.matched).toBe(true);
    expect(official.matchTier).toBe("B");
  });

  it("null incorporation date → ok matched without incorporationDate (N3)", async () => {
    searchCrLocalByNameBeginsWith.mockResolvedValue({
      kind: "rows",
      rows: [
        {
          Brn: "C1234567",
          English_Company_Name: "NULL",
          Chinese_Company_Name: "合成測試有限公司",
          Company_Type: "Co",
          Date_of_Incorporation: null as unknown as string,
          Address_of_Registered_Office: "HK",
        },
      ],
    });
    const official = await lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput("合成測試有限公司"),
      "合成測試有限公司",
      null,
    );
    expect(official.lookupStatus).toBe("ok");
    expect(official.matched).toBe(true);
    expect(official.incorporationDate).toBeUndefined();
  });

  it("client throw → lookupStatus error, no reject (N3)", async () => {
    searchCrLocalByNameBeginsWith.mockRejectedValue(new Error("boom"));
    await expect(
      lookupCompaniesRegistryForSearch(
        companyNameOnlySearchInput("合成測試有限公司"),
        "合成測試有限公司",
        null,
      ),
    ).resolves.toEqual({
      lookupStatus: "error",
      retrievedAt: expect.any(String),
      hints: [],
      icrisHomeUrl: CR_ESERVICES_URL,
    });
  });

  it("two labels → distinct brNo, multiple fetches (L-T)", async () => {
    searchCrLocalByNameBeginsWith.mockImplementation(async (prefix) => {
      if (prefix === "ZZQ DECORATION" || prefix === "ZZQ DECORATION LIMITED") {
        return {
          kind: "rows",
          rows: [row("ZZQ DECORATION LIMITED", "C1111111")],
        };
      }
      if (prefix === "ZZQ DECORATIONS" || prefix === "ZZQ DECORATIONS & CO LIMITED") {
        return {
          kind: "rows",
          rows: [row("ZZQ DECORATIONS & CO LIMITED", "C2222222")],
        };
      }
      return { kind: "no_result" };
    });
    const a = await lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput("ZZQ DECORATION LIMITED"),
      "ZZQ DECORATION LIMITED",
      null,
    );
    clearCrRegistryCacheForTests();
    const b = await lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput("ZZQ DECORATIONS & CO LIMITED"),
      "ZZQ DECORATIONS & CO LIMITED",
      null,
    );
    expect(a.brNo).toBe("C1111111");
    expect(b.brNo).toBe("C2222222");
    expect(searchCrLocalByNameBeginsWith.mock.calls.length).toBeGreaterThan(1);
  });
});

function riskReportFromCr(
  cr: NonNullable<RiskReport["official"]["companiesRegistry"]>,
): RiskReport {
  const evaluation = buildEvaluationStub({
    overallGrade: "C",
    confidence: "medium",
    mwcMatched: false,
    boundHitCount: 0,
    highlightCount: 0,
  });
  return {
    reportVersion: REPORT_VERSION,
    entity: {
      displayName: "合成測試有限公司",
      matchType: "company_name",
      queryEcho: "合成測試有限公司",
      searchLabelUsed: "合成測試有限公司",
      nameAlignment: "user_only",
    },
    grade: "C",
    confidence: "medium",
    evaluation,
    summaryZh: "摘要",
    official: { mwcMatched: false, companiesRegistry: cr },
    signals: {
      discussionCount: 0,
      themes: [],
      retrievalEvidence: [],
      contractChecklist: ["佔位"],
      actionableClauses: [],
    },
    disclaimerVersion: "1.0.0",
    generatedAt: "2026-10-18T12:00:00.000Z",
  };
}

describe("C.2c gating with lookup output", () => {
  it("ambiguous → fallback note, no alert (L7)", async () => {
    searchCrLocalByNameBeginsWith.mockResolvedValue({
      kind: "rows",
      rows: [
        row("AAA LIMITED", "C1111111"),
        row("AAA LIMITED", "C2222222"),
      ],
    });
    const official = await lookupCompaniesRegistryForSearch(
      companyNameOnlySearchInput("AAA LIMITED"),
      "AAA LIMITED",
      null,
    );
    const report = riskReportFromCr(official);
    expect(shouldShowUnverifiedCompanyRegistrationAlert(report)).toBe(false);
    expect(shouldShowMwcMissFallbackNote(report)).toBe(true);
  });

  it("no companiesRegistry on report → fallback only", () => {
    const report = riskReportFromCr({
      lookupStatus: "ok",
      matched: false,
      hints: ["not_found_in_active_list"],
      retrievedAt: "2026-10-18T12:00:00.000Z",
      icrisHomeUrl: CR_ESERVICES_URL,
    });
    const withoutCr: RiskReport = {
      ...report,
      official: { mwcMatched: false },
    };
    expect(
      shouldShowUnverifiedCompanyRegistrationAlert(withoutCr),
    ).toBe(false);
    expect(shouldShowMwcMissWithCrFoundNote(withoutCr)).toBe(false);
    expect(shouldShowMwcMissFallbackNote(withoutCr)).toBe(true);
  });
});

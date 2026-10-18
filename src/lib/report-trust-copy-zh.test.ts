import { describe, expect, it } from "vitest";
import { defaultContractChecklist } from "./contract-checklist";
import {
  collectReportTrustCopyStrings,
  ICRIS_HOME_URL,
  JUDICIARY_DAILY_CAUSE_LIST_URL,
  REPORT_TRUST_FORBIDDEN_ZH,
} from "./report-trust-copy-zh";

describe("report-trust-copy-zh", () => {
  it("contract checklist has at least six neutral questions", () => {
    const items = defaultContractChecklist();
    expect(items.length).toBeGreaterThanOrEqual(6);
    expect(items.every((s) => s.trim().length > 0)).toBe(true);
  });

  it("official URLs have no entity-specific query prefills", () => {
    expect(ICRIS_HOME_URL).not.toContain("?");
    expect(JUDICIARY_DAILY_CAUSE_LIST_URL).toMatch(/^https:\/\//);
    expect(JUDICIARY_DAILY_CAUSE_LIST_URL).not.toContain("company");
  });

  it("user-facing copy avoids forbidden accusatory terms", () => {
    const blob = collectReportTrustCopyStrings().join("\n");
    for (const term of REPORT_TRUST_FORBIDDEN_ZH) {
      expect(blob).not.toContain(term);
    }
  });
});

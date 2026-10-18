import { describe, expect, it } from "vitest";
import { defaultContractChecklist } from "./contract-checklist";
import { buildJudiciaryDeepLinks } from "./judiciary-search-deep-links";
import {
  collectReportTrustCopyStrings,
  DEFAULT_CONTRACT_CHECKLIST_ZH,
  JUDICIARY_DAILY_CAUSE_LIST_URL,
  REPORT_TRUST_FORBIDDEN_ZH,
  REPORT_TRUST_NEGATED_ALLOWLIST_ZH,
} from "./report-trust-copy-zh";

function assertClean(text: string): void {
  let t = text;
  for (const ok of REPORT_TRUST_NEGATED_ALLOWLIST_ZH) {
    t = t.split(ok).join("");
  }
  for (const w of REPORT_TRUST_FORBIDDEN_ZH) {
    expect(t).not.toContain(w);
  }
}

const BANNED_SUBSTRINGS = [
  "刊憲",
  "數日",
  "小型申索",
  "觸犯",
  "LRS",
  "傢俬",
  "授權前",
  "匿名條數",
] as const;

describe("report-trust-copy-zh", () => {
  it("contract checklist has at least six neutral questions", () => {
    expect(DEFAULT_CONTRACT_CHECKLIST_ZH.length).toBeGreaterThanOrEqual(6);
    expect(
      DEFAULT_CONTRACT_CHECKLIST_ZH.every((s) => s.trim().length > 0),
    ).toBe(true);
  });

  it("defaultContractChecklist stays on three LLM pipeline lines", () => {
    expect(defaultContractChecklist()).toEqual([
      "工程範圍、物料品牌與單價是否寫清？",
      "付款期數是否與工程進度掛鈎？",
      "保養期、延誤責任與終止合約條款是否明確？",
    ]);
  });

  it("user-facing copy passes forbidden-word check", () => {
    assertClean(collectReportTrustCopyStrings().join("\n"));
    assertClean(
      buildJudiciaryDeepLinks("合成測試有限公司").dailyCauseListNote,
    );
    expect(
      buildJudiciaryDeepLinks("合成測試有限公司").dailyCauseListSearch,
    ).toBe(JUDICIARY_DAILY_CAUSE_LIST_URL);
  });

  it("copy avoids banned substrings", () => {
    const blob = collectReportTrustCopyStrings().join("\n");
    for (const sub of BANNED_SUBSTRINGS) {
      expect(blob).not.toContain(sub);
    }
  });
});

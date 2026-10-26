import { describe, expect, it } from "vitest";
import {
  decideRegisterCandidateGate,
  toPublicMwcCandidate,
} from "./register-candidate-gate";
import type { MwcRow } from "./mwc-lookup";

function row(partial: Partial<MwcRow> & Pick<MwcRow, "company_name" | "registration_no">): MwcRow {
  return {
    phone: "90000000",
    primary_signatory_name: "合成簽署",
    expiry_date: null,
    source_updated_at: null,
    ...partial,
  };
}

describe("decideRegisterCandidateGate", () => {
  it("runs today's report for 0 or 1 row", () => {
    expect(decideRegisterCandidateGate({ matchCount: 0, windowFull: false })).toBe("report");
    expect(decideRegisterCandidateGate({ matchCount: 1, windowFull: false })).toBe("report");
  });

  it("shows a picker for 2 and 8 rows", () => {
    expect(decideRegisterCandidateGate({ matchCount: 2, windowFull: false })).toBe("picker");
    expect(decideRegisterCandidateGate({ matchCount: 8, windowFull: false })).toBe("picker");
  });

  it("asks for a full name at 9 rows and when the 20-row window is full", () => {
    expect(decideRegisterCandidateGate({ matchCount: 9, windowFull: false })).toBe("too_many");
    expect(decideRegisterCandidateGate({ matchCount: 20, windowFull: true })).toBe("too_many");
    expect(decideRegisterCandidateGate({ matchCount: 8, windowFull: true })).toBe("too_many");
  });
});

describe("toPublicMwcCandidate", () => {
  it("tags the exact row and drops phone and signatory", () => {
    const exact = toPublicMwcCandidate(
      row({
        company_name: "合成設計",
        company_name_en: "SYNTH DESIGN",
        registration_no: "MWC 10/2026",
      }),
      "合成設計",
    );
    const longer = toPublicMwcCandidate(
      row({
        company_name: "合成設計有限公司",
        registration_no: "MWC(W) 12/2026",
      }),
      "合成設計",
    );
    expect(exact.exact).toBe(true);
    expect(longer.exact).toBe(false);
    expect(exact.companyNameEn).toBe("SYNTH DESIGN");
    expect(JSON.stringify(exact)).not.toContain("90000000");
    expect(JSON.stringify(exact)).not.toContain("合成簽署");
    expect(Object.keys(exact).sort()).toEqual([
      "companyName",
      "companyNameEn",
      "exact",
      "registrationNo",
    ]);
    expect(longer.registrationNo).toBe("MWC(W) 12/2026");
  });

  it("hides an English line that repeats the Chinese name", () => {
    const same = toPublicMwcCandidate(
      row({
        company_name: "合成設計",
        company_name_en: "合成設計",
        registration_no: "MWC 1/2026",
      }),
      "其他",
    );
    expect(same.companyNameEn).toBeNull();
  });
});

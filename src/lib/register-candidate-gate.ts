import { foldMwcName, isExactMwcNameMatch, type MwcRow } from "./mwc-lookup";

/** 2–8 rows show a picker. 9 or more, or a full 20-row window, does not. */
export const REGISTER_PICKER_MAX = 8;

export type RegisterCandidateGate = "report" | "picker" | "too_many";

export function decideRegisterCandidateGate(input: {
  matchCount: number;
  windowFull: boolean;
}): RegisterCandidateGate {
  if (input.windowFull || input.matchCount >= REGISTER_PICKER_MAX + 1) {
    return "too_many";
  }
  if (input.matchCount >= 2) return "picker";
  return "report";
}

/** Register fields the picker may show. Phone and signatory are never copied. */
export type PublicMwcCandidate = {
  companyName: string;
  companyNameEn: string | null;
  registrationNo: string;
  exact: boolean;
};

export function toPublicMwcCandidate(row: MwcRow, typed: string): PublicMwcCandidate {
  const english = row.company_name_en?.trim() ?? "";
  const sameAsChinese =
    english.length > 0 && foldMwcName(english) === foldMwcName(row.company_name);
  return {
    companyName: row.company_name,
    companyNameEn: english && !sameAsChinese ? english : null,
    registrationNo: row.registration_no,
    exact: isExactMwcNameMatch(row, typed),
  };
}

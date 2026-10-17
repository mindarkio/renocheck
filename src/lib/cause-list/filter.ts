import type { ParsedCauseListCase } from "./types";

const SMT_INCLUDED_NATURES = [
  "WORK DONE",
  "SERVICE CHARGE",
  "BREACH",
  "REFUND",
  "COMPENSATION",
  "MISC",
  "MISCELLANEOUS",
  "GOODS",
];

const SMT_EXCLUDED_NATURES = [
  "RATES",
  "GOVERNMENT RENT",
  "MANAGEMENT FEE",
  "CARD LOAN",
  "RENOVATION CONTRIBUTION",
  "維修費",
];

const EXCLUDED_PREFIXES = [
  "DCEC",
  "DCPI",
  "HCPI",
  "DCCC",
  "CWUP",
  "HCCW",
  "LDPD",
  "LDPE",
  "LDRT",
];

function casePrefix(caseNo: string): string {
  const m = caseNo.trim().match(/^([A-Z]+)/i);
  return m ? m[1].toUpperCase() : "";
}

function normalizeNature(nature?: string): string {
  return (nature ?? "").toUpperCase().replace(/\s+/g, " ");
}

export function isRenovationRelevantCase(caseRow: ParsedCauseListCase): boolean {
  const prefix = casePrefix(caseRow.caseNo);
  const nature = normalizeNature(caseRow.claimNature);

  if (SMT_EXCLUDED_NATURES.some((x) => nature.includes(x))) return false;
  if (nature.includes("RENOVATION CONTRIBUTION") || nature.includes("維修費")) {
    return false;
  }

  if (EXCLUDED_PREFIXES.some((p) => prefix === p || prefix.startsWith(p))) {
    return false;
  }

  if (caseRow.court === "SMT") {
    return SMT_INCLUDED_NATURES.some((token) => nature.includes(token));
  }

  if (caseRow.court === "DC") {
    return prefix === "DCCJ";
  }

  if (caseRow.court === "CACFI") {
    return prefix === "HCA" || prefix === "HCCT";
  }

  if (caseRow.court === "LANDS") {
    return prefix === "LDBM";
  }

  return false;
}

export function isDefendantSideRole(role: string): boolean {
  return role === "defendant" || role === "respondent";
}

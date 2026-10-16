/** D2 v3d — drop / force-keep / labour review (Aaron 2026-10-16). */

import { defendantHasEngineeringKeyword } from "./judgment-d2-case-policy";
import { classifyDefendantEntity } from "./judgment-d2-entity";
import { caseRefPrefix } from "./judgment-d2-parties";

export const AUTO_DROP_CASE_PREFIXES_V3D = new Set([
  "FCMC",
  "FCJA",
  "CAMP",
  "HCAL",
  "FACC",
]);

const FORCE_KEEP_RAW = ["HCSA 18/2025", "CACV 131/2005", "CACV 82/2015"];

export function normalizeCaseRefKey(caseRef: string): string {
  const c = caseRef.replace(/\s+/g, "").toUpperCase();
  const m = c.match(/^([A-Z]{2,6})(\d+\/\d{4})$/);
  if (m) return `${m[1]}${m[2]}`;
  return c;
}

const FORCE_KEEP_KEYS = new Set(FORCE_KEEP_RAW.map(normalizeCaseRefKey));

export function isForceKeepCaseRef(caseRef: string): boolean {
  return FORCE_KEEP_KEYS.has(normalizeCaseRefKey(caseRef));
}

export function isAutoDropCasePrefixV3d(caseRef: string): boolean {
  return AUTO_DROP_CASE_PREFIXES_V3D.has(caseRefPrefix(caseRef));
}

export function isLabourPrefixDrop(caseRef: string): boolean {
  const p = caseRefPrefix(caseRef);
  return p === "HCLA" || p === "DCEC";
}

/** @deprecated use isLabourPrefixDrop */
export const isLabourPrefixReview = isLabourPrefixDrop;

export function extractSoleProprietorOwnerName(defendantLabel: string): string | null {
  const raw = defendantLabel.trim();
  const parenOp = raw.match(/^(.+?)[（(]\s*經營/u)?.[1]?.trim();
  if (parenOp && parenOp.length >= 2) return parenOp;
  const cn = raw.match(/^(.+?)\s*經營/u)?.[1]?.trim();
  if (cn && cn.length >= 2) return cn;
  const en = raw.match(/^(.+?)\s+trading\s+as\s+/iu)?.[1]?.trim();
  if (en && en.length >= 2) return en;
  const ta = raw.match(/^(.+?)\s+t\/a\s+/iu)?.[1]?.trim();
  if (ta && ta.length >= 2) return ta;
  return null;
}

const OWNERS_CORP_RE =
  /業主立案法團|owners?\s+of|incorporated\s+owners|業主立案法團/i;

const GOVERNMENT_DEFENDANT_RE =
  /政府|律政司|secretary\s+for\s+justice|the\s+government|hong\s+kong\s+special\s+administrative\s+region|hong\s+kong\s+sar/i;

export function isDefendantOwnersCorporation(defendantLabel: string): boolean {
  return OWNERS_CORP_RE.test(defendantLabel.trim());
}

export function isDefendantGovernment(defendantLabel: string): boolean {
  return GOVERNMENT_DEFENDANT_RE.test(defendantLabel.trim());
}

const ENGINEERING_COMPANY_RE =
  /工程|裝修|承建|建築|室內|水電|裝飾|ENGINEERING|CONSTRUCTION|DECORATION|CONTRACTOR|INTERIORS/i;

export function partyIsEngineeringCompany(partyLabel: string): boolean {
  const raw = partyLabel.trim();
  if (raw.length < 2) return false;
  if (defendantHasEngineeringKeyword(raw)) return true;
  if (
    classifyDefendantEntity(raw) === "company" &&
    ENGINEERING_COMPANY_RE.test(raw)
  ) {
    return true;
  }
  return false;
}

/** 工程／裝修公司只在原告一側 → drop（被告唔係工程公司）。 */
export function isEngineeringCompanyPlaintiffOnly(
  plaintiffLabel: string,
  defendantLabel: string,
): boolean {
  return (
    partyIsEngineeringCompany(plaintiffLabel) &&
    !partyIsEngineeringCompany(defendantLabel)
  );
}

/** 獨資：抽出商號作 review alias。 */
export function extractSoleProprietorTradeAlias(
  defendantLabel: string,
): string | null {
  const raw = defendantLabel.trim();
  const parenTrade = raw.match(/[（(]\s*經營\s*([^)）]+)[)）]/u)?.[1]?.trim();
  if (parenTrade && parenTrade.length >= 2) return parenTrade;
  const cn = raw.match(/經營(.+)$/u)?.[1]?.trim();
  if (cn && cn.length >= 2) return cn.replace(/[)）]\s*$/u, "").trim();
  const en = raw.match(/\btrading\s+as\s+(.+)$/i)?.[1]?.trim();
  if (en && en.length >= 2) return en;
  const ta = raw.match(/\bt\/a\s+(.+)$/i)?.[1]?.trim();
  if (ta && ta.length >= 2) return ta;
  return null;
}

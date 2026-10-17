import type { CauseListParty, CauseListPartyRole, ParsedCorporateParty } from "./types";

const ROLE_LINE_RE = /^([PDAR]\d+)\s*[:：]\s*(.+)$/iu;
const T_A_RE =
  /\b(t\/a|trading as)\b|所經營|前經營|經營/iu;
const FORMERLY_RE = /前經營/;

const STRIP_CLAUSE_RE =
  /\((?:The Executor of|The Personal Representative of|Or The Account Holder)[^)]*\)/gi;

const TRUSTEE_OF_RE = /\bas\s+trustee\s+of\b/i;
const LIMITED_PARTNERSHIP_RE = /\bLIMITED\s+PARTNERSHIP\b/i;
const LIMITED_EDITION_RE = /\bLIMITED\s+EDITION\b/i;

const IO_MARKERS_RE = /業主立案法團|INCORPORATED OWNERS/i;
const IN_LIQUIDATION_RE = /\s*\(IN\s+LIQUIDATION\)\s*$/i;

function stripLiquidationSuffix(name: string): string {
  return name.replace(IN_LIQUIDATION_RE, "").trim();
}

export type SplitPartyBlockOptions = {
  /** When false, do not split on inline AND (SMT / labeled blocks). */
  splitInlineAnd?: boolean;
};

function mapRoleLabel(label: string): CauseListPartyRole {
  const u = label.toUpperCase();
  if (u.startsWith("C") || u.includes("CLAIMANT")) return "claimant";
  if (u.startsWith("D") || u.includes("DEFENDANT")) return "defendant";
  if (u.startsWith("P") || u.includes("PLAINTIFF")) return "plaintiff";
  if (u.startsWith("R") || u.includes("RESPONDENT")) return "respondent";
  if (u.startsWith("A") || u.includes("APPLICANT")) return "applicant";
  return "unknown";
}

/** Split a multi-party block on role lines; optional inline AND split (M5). */
export function splitPartyBlock(
  block: string,
  defaultRole: CauseListPartyRole,
  options: SplitPartyBlockOptions = {},
): CauseListParty[] {
  const splitInlineAnd = options.splitInlineAnd ?? false;
  const lines = block
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const parties: CauseListParty[] = [];

  const pushChunk = (chunk: string, role: CauseListPartyRole) => {
    const trimmed = chunk.trim();
    if (!trimmed) return;
    const pm = trimmed.match(ROLE_LINE_RE);
    if (pm) {
      const pos = pm[1].toUpperCase();
      parties.push({
        role: mapRoleLabel(pos[0]),
        position: pos,
        rawName: pm[2].trim(),
      });
      return;
    }
    parties.push({ role, rawName: trimmed });
  };

  for (const line of lines) {
    const roleMatch = line.match(
      /^(Claimant|Defendant|Plaintiff|Respondent|Applicant)\s*(\d+)?\s*[:：]?\s*(.+)$/iu,
    );
    if (roleMatch) {
      const label = roleMatch[1];
      const role = mapRoleLabel(label);
      pushChunk(roleMatch[3], role);
      continue;
    }

    const posMatch = line.match(ROLE_LINE_RE);
    if (posMatch) {
      const pos = posMatch[1].toUpperCase();
      const role = mapRoleLabel(pos[0]);
      parties.push({
        role,
        position: pos,
        rawName: posMatch[2].trim(),
      });
      continue;
    }

    if (splitInlineAnd) {
      const chunks = line.split(/\s+AND\s+|\s+And\s+/);
      for (const chunk of chunks) pushChunk(chunk, defaultRole);
    } else {
      pushChunk(line, defaultRole);
    }
  }

  if (parties.length === 0 && block.trim()) {
    parties.push({ role: defaultRole, rawName: block.trim() });
  }
  return parties;
}

function splitTradingAs(rawName: string): {
  legalName: string;
  tradeName?: string;
  formerlyTradedAs: boolean;
} {
  const formerly = FORMERLY_RE.test(rawName);
  const parts = rawName.split(T_A_RE);
  if (parts.length >= 2) {
    const tradeName = parts
      .slice(1)
      .join(" ")
      .replace(/^(t\/a|trading as)\s*/i, "")
      .trim();
    return {
      legalName: parts[0].trim(),
      tradeName: tradeName || undefined,
      formerlyTradedAs: formerly,
    };
  }
  return { legalName: rawName.trim(), formerlyTradedAs: formerly };
}

function stripBracketedChineseAlias(name: string): string {
  return name.replace(/\([\u4e00-\u9fff][^)]*\)/gu, "").trim();
}

/** M1: corporate entity detection (excludes IO, LP, trustee-of, Limited Edition). */
export function isCorporateEntityName(name: string): boolean {
  let cleaned = stripLiquidationSuffix(name.replace(STRIP_CLAUSE_RE, "").trim());
  if (IO_MARKERS_RE.test(cleaned)) return false;
  if (TRUSTEE_OF_RE.test(cleaned)) return false;
  if (LIMITED_PARTNERSHIP_RE.test(cleaned)) return false;
  if (LIMITED_EDITION_RE.test(cleaned)) return false;

  cleaned = stripBracketedChineseAlias(cleaned);

  if (/有限責任公司|有限公司/u.test(cleaned)) return true;

  const upper = cleaned.toUpperCase();
  if (/\b(LIMITED|LTD\.?)\s*$/i.test(upper)) return true;

  return false;
}

export function isIncorporatedOwners(name: string): boolean {
  return IO_MARKERS_RE.test(name);
}

function legalNameIsMatchableCorporate(legalName: string): boolean {
  return isCorporateEntityName(legalName);
}

/** Drop natural persons silently (no logging). */
export function parseCorporateParties(
  parties: CauseListParty[],
): ParsedCorporateParty[] {
  const out: ParsedCorporateParty[] = [];
  for (const p of parties) {
    const raw = stripLiquidationSuffix(p.rawName.replace(STRIP_CLAUSE_RE, "").trim());
    if (!raw) continue;
    const { legalName, tradeName, formerlyTradedAs } = splitTradingAs(raw);
    const legalNameClean = stripLiquidationSuffix(legalName);

    if (!legalNameIsMatchableCorporate(legalNameClean)) {
      continue;
    }

    const incorporatedOwners = isIncorporatedOwners(legalNameClean);
    out.push({
      role: p.role,
      position: p.position,
      rawName: p.rawName,
      legalName: legalNameClean,
      tradeName: tradeName || undefined,
      formerlyTradedAs: formerlyTradedAs || undefined,
      incorporatedOwners,
    });
  }
  return out;
}

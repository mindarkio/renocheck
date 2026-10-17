import type { CauseListParty, CauseListPartyRole, ParsedCorporateParty } from "./types";

const ROLE_LINE_RE = /^([PDAR]\d+)\s*[:：]\s*(.+)$/iu;
const T_A_RE =
  /\b(t\/a|trading as)\b|所經營|前經營|經營/iu;
const FORMERLY_RE = /前經營/;

const CORPORATE_MARKERS_RE =
  /\b(LIMITED|LTD\.?|INCORPORATED|INC\.?|CORPORATION|CORP\.?|LLP)\b|有限公司|業主立案法團|INCORPORATED OWNERS/i;

const IO_MARKERS_RE = /業主立案法團|INCORPORATED OWNERS/i;

const STRIP_CLAUSE_RE =
  /\((?:The Executor of|The Personal Representative of|Or The Account Holder)[^)]*\)/gi;

function mapRoleLabel(label: string): CauseListPartyRole {
  const u = label.toUpperCase();
  if (u.startsWith("C") || u.includes("CLAIMANT")) return "claimant";
  if (u.startsWith("D") || u.includes("DEFENDANT")) return "defendant";
  if (u.startsWith("P") || u.includes("PLAINTIFF")) return "plaintiff";
  if (u.startsWith("R") || u.includes("RESPONDENT")) return "respondent";
  if (u.startsWith("A") || u.includes("APPLICANT")) return "applicant";
  return "unknown";
}

/** Split a multi-party block on AND / role lines. */
export function splitPartyBlock(
  block: string,
  defaultRole: CauseListPartyRole,
): CauseListParty[] {
  const lines = block
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  const parties: CauseListParty[] = [];

  for (const line of lines) {
    const roleMatch = line.match(
      /^(Claimant|Defendant|Plaintiff|Respondent|Applicant)\s*(\d+)?\s*[:：]?\s*(.+)$/iu,
    );
    if (roleMatch) {
      const label = roleMatch[1];
      const role = mapRoleLabel(label);
      parties.push({
        role,
        position: roleMatch[2] ? `${label[0]}${roleMatch[2]}` : undefined,
        rawName: roleMatch[3].trim(),
      });
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

    const chunks = line.split(/\s+AND\s+|\s+And\s+/);
    for (const chunk of chunks) {
      const trimmed = chunk.trim();
      if (!trimmed) continue;
      const pm = trimmed.match(ROLE_LINE_RE);
      if (pm) {
        const pos = pm[1].toUpperCase();
        parties.push({
          role: mapRoleLabel(pos[0]),
          position: pos,
          rawName: pm[2].trim(),
        });
      } else {
        parties.push({ role: defaultRole, rawName: trimmed });
      }
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

export function isCorporateEntityName(name: string): boolean {
  const cleaned = name.replace(STRIP_CLAUSE_RE, "").trim();
  return CORPORATE_MARKERS_RE.test(cleaned);
}

export function isIncorporatedOwners(name: string): boolean {
  return IO_MARKERS_RE.test(name);
}

/** Drop natural persons silently (no logging). */
export function parseCorporateParties(
  parties: CauseListParty[],
): ParsedCorporateParty[] {
  const out: ParsedCorporateParty[] = [];
  for (const p of parties) {
    const raw = p.rawName.replace(STRIP_CLAUSE_RE, "").trim();
    if (!raw) continue;
    const { legalName, tradeName, formerlyTradedAs } = splitTradingAs(raw);
    if (!isCorporateEntityName(legalName) && !(tradeName && isCorporateEntityName(tradeName))) {
      continue;
    }
    const incorporatedOwners =
      isIncorporatedOwners(legalName) || (tradeName ? isIncorporatedOwners(tradeName) : false);
    out.push({
      role: p.role,
      position: p.position,
      rawName: p.rawName,
      legalName,
      tradeName: tradeName || undefined,
      formerlyTradedAs,
      incorporatedOwners,
    });
  }
  return out;
}

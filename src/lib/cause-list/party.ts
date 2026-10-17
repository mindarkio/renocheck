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

/** A comma before a corporate suffix, optionally with one bracket group in between, stays in the name. */
const CORPORATE_COMMA_GUARD_RE =
  /^\s*(?:[(（][^()（）]*[)）]\s*)?(?:CO\b|COMPANY\b|LTD|LIMITED|INC)\b/i;

/** Former-name and trading-as clauses are part of the previous party, not a new defendant. */
const MERGED_CLAUSE_RE = /^(?:FORMERLY\b|F\/K\/A\b|前稱|T\/A\b|TRADING\s+AS\b|經營)/i;

/** A wrapped line that is only the regional suffix of the previous party. */
const BRACKET_SUFFIX_LINE_RE =
  /^\s*[(（][^()（）]*[)）]\s*(?:CO\b|COMPANY\b|LTD|LIMITED|INC)\b/i;

/**
 * Split a party line on commas that are outside brackets.
 * A comma immediately before LTD / LIMITED / INC, or before a bracket then those words, stays inside the name.
 */
export function splitTopLevelPartyCommas(line: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "(" || ch === "（") depth += 1;
    else if ((ch === ")" || ch === "）") && depth > 0) depth -= 1;
    else if (depth === 0 && (ch === "," || ch === "，")) {
      const rest = line.slice(i + 1);
      if (CORPORATE_COMMA_GUARD_RE.test(rest)) continue;
      const chunk = line.slice(start, i).trim();
      if (chunk) parts.push(chunk);
      start = i + 1;
    }
  }
  const tail = line.slice(start).trim();
  if (tail) parts.push(tail);
  return mergeClauseSegments(parts);
}

function joinBracketSuffixLines(lines: string[]): string[] {
  const joined: string[] = [];
  for (const line of lines) {
    if (joined.length > 0 && BRACKET_SUFFIX_LINE_RE.test(line)) {
      joined[joined.length - 1] = `${joined[joined.length - 1]} ${line}`.trim();
      continue;
    }
    joined.push(line);
  }
  return joined;
}

function mergeClauseSegments(parts: string[]): string[] {
  const merged: string[] = [];
  for (const part of parts) {
    if (merged.length > 0 && MERGED_CLAUSE_RE.test(part)) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}, ${part}`;
      continue;
    }
    merged.push(part);
  }
  return merged;
}

function unmatchedOpens(name: string): number[] {
  const opens: number[] = [];
  for (let i = 0; i < name.length; i++) {
    const ch = name[i];
    if (ch === "(" || ch === "（") opens.push(i);
    else if ((ch === ")" || ch === "）") && opens.length > 0) opens.pop();
  }
  return opens;
}

function stripTrailingBrackets(name: string): string {
  let cleaned = name.trim();
  let previous = "";
  while (cleaned !== previous) {
    previous = cleaned;
    const opens = unmatchedOpens(cleaned);
    if (opens.length > 0) {
      cleaned = cleaned.slice(0, opens[opens.length - 1]).trim();
      continue;
    }
    cleaned = cleaned.replace(/\s*[（(][^（()）]*[）)]\s*$/u, "").trim();
  }
  return cleaned;
}

function stripFormerNameClause(name: string): string {
  return name
    .replace(/(^|\s+)FORMERLY\s+KNOWN\s+AS\b[\s\S]*$/i, "")
    .replace(/(^|\s+)F\/K\/A\b[\s\S]*$/i, "")
    .replace(/(^|\s*)前稱[\s\S]*$/u, "")
    .replace(/[,，]\s*$/u, "")
    .trim();
}

const KEPT_TRAILING_BRACKET_RE =
  /LIMITED|LTD\.?|有限公司|有限責任公司|IN\s+LIQUIDATION|清盤|HONG\s+KONG|H\.K\.|香港|中國|國際|亞洲|(?:^|[^A-Z0-9])HK(?:[^A-Z0-9]|$)/i;

function trailingBracket(name: string): { start: number; inner: string; unclosed: boolean } | null {
  const trimmed = name.trimEnd();
  if (!trimmed) return null;
  const opens = unmatchedOpens(trimmed);
  if (opens.length > 0) {
    const start = opens[opens.length - 1];
    return { start, inner: trimmed.slice(start + 1), unclosed: true };
  }
  if (!trimmed.endsWith(")") && !trimmed.endsWith("）")) return null;
  let depth = 0;
  for (let i = trimmed.length - 1; i >= 0; i--) {
    const ch = trimmed[i];
    if (ch === ")" || ch === "）") depth += 1;
    else if (ch === "(" || ch === "（") {
      depth -= 1;
      if (depth === 0) {
        return { start: i, inner: trimmed.slice(i + 1, trimmed.length - 1), unclosed: false };
      }
    }
  }
  return null;
}

/** Drop trailing notes. Keep a closed alias, region, or liquidation bracket. An unclosed "(" is never kept. */
export function stripNonAliasTrailingBrackets(name: string): string {
  let cleaned = name.trim();
  for (;;) {
    const span = trailingBracket(cleaned);
    if (!span) return cleaned;
    if (!span.unclosed && KEPT_TRAILING_BRACKET_RE.test(span.inner)) return cleaned;
    cleaned = cleaned.slice(0, span.start).trim();
  }
}

/** Split a multi-party block on role lines; optional inline AND split (M5). */
export function splitPartyBlock(
  block: string,
  defaultRole: CauseListPartyRole,
  options: SplitPartyBlockOptions = {},
): CauseListParty[] {
  const splitInlineAnd = options.splitInlineAnd ?? false;
  const lines = joinBracketSuffixLines(
    block
      .split(/\n+/)
      .map((l) => l.trim())
      .filter(Boolean),
  );
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
    const segments = splitTopLevelPartyCommas(line);
    for (const segment of segments) {
      const roleMatch = segment.match(
        /^(Claimant|Defendant|Plaintiff|Respondent|Applicant)\s*(\d+)?\s*[:：]?\s*(.+)$/iu,
      );
      if (roleMatch) {
        const label = roleMatch[1];
        const role = mapRoleLabel(label);
        pushChunk(roleMatch[3], role);
        continue;
      }

      const posMatch = segment.match(ROLE_LINE_RE);
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
        const chunks = segment.split(/\s+AND\s+|\s+And\s+/);
        for (const chunk of chunks) pushChunk(chunk, defaultRole);
      } else {
        pushChunk(segment, defaultRole);
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

/** M1: corporate entity detection (excludes IO, LP, trustee-of, Limited Edition). */
export function isCorporateEntityName(name: string): boolean {
  let cleaned = stripLiquidationSuffix(name.replace(STRIP_CLAUSE_RE, "").trim());
  if (IO_MARKERS_RE.test(cleaned)) return false;
  if (TRUSTEE_OF_RE.test(cleaned)) return false;
  if (LIMITED_PARTNERSHIP_RE.test(cleaned)) return false;
  if (LIMITED_EDITION_RE.test(cleaned)) return false;

  cleaned = stripTrailingBrackets(cleaned);
  cleaned = stripFormerNameClause(cleaned);
  cleaned = stripTrailingBrackets(cleaned);

  return /(LIMITED|LTD\.?|有限公司|有限責任公司)$/iu.test(cleaned);
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
    const legalNameClean = stripFormerNameClause(stripLiquidationSuffix(legalName));

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

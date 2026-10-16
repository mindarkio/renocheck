/** D2 v2 — defendant entity classification (deterministic, no LLM). */

export type DefendantEntityKind =
  | "company"
  | "natural_person"
  | "sole_proprietor"
  | "unknown";

const COMPANY_MARKERS =
  /有限公司|有限責任公司|公司|集團|企業|工程|裝修|承建|建材|室內|設計|裝飾|DECORATION|ENGINEERING|CONSTRUCTION|CONTRACTOR|LIMITED|LTD\.?|INC\.?|COMPANY|CO\.|CORP\.?|TRADING|ENTERPRISES|WORKSHOP|INTERIORS/i;

const SOLE_PROP_PATTERN = /經營|trading as|\bt\/a\b/i;

/** CJK personal names are often 2–4 chars with no company marker. */
function looksLikeCjkPersonalName(label: string): boolean {
  const t = label.trim();
  if (!/^[\u4e00-\u9fff]{2,4}$/u.test(t)) return false;
  return !COMPANY_MARKERS.test(t);
}

function looksLikeEnglishPersonalName(label: string): boolean {
  const t = label.trim();
  if (COMPANY_MARKERS.test(t)) return false;
  if (/\b(LTD|LIMITED|LLC|INC|CO\.|COMPANY|CORP)\b/i.test(t)) return false;
  const parts = t.split(/\s+/).filter(Boolean);
  if (parts.length < 2 || parts.length > 4) return false;
  return parts.every(
    (p) => /^[A-Z][A-Za-z.'-]*$/u.test(p) && p.length <= 24,
  );
}

/** Strip co-party suffixes before entity classification. */
export function normalizeDefendantLabelForEntity(defendantLabel: string): string {
  return defendantLabel
    .trim()
    .replace(/\s*(及另一人|及另\d+人)\s*$/u, "")
    .replace(/\s+AND\s+OTHERS?\s*$/i, "")
    .replace(/\s+AND\s+ANOTHER\s*$/i, "")
    .trim();
}

export function classifyDefendantEntity(defendantLabel: string): DefendantEntityKind {
  const raw = normalizeDefendantLabelForEntity(defendantLabel);
  if (raw.length < 2) return "unknown";

  if (SOLE_PROP_PATTERN.test(raw)) {
    return "sole_proprietor";
  }

  if (COMPANY_MARKERS.test(raw)) {
    return "company";
  }

  if (looksLikeCjkPersonalName(raw)) {
    return "natural_person";
  }

  if (looksLikeEnglishPersonalName(raw)) {
    return "natural_person";
  }

  if (/^[A-Z][A-Z\s.&'-]{6,}$/i.test(raw) && /\s/.test(raw)) {
    return "company";
  }

  if (
    raw.length >= 6 &&
    /[A-Za-z]/.test(raw) &&
    /\b(LTD|LIMITED|LLC|INC|CO\.|COMPANY|CORP)\b/i.test(raw)
  ) {
    return "company";
  }

  return "unknown";
}

export type MatchConfidence = "high" | "review";

/** High = auto-import path; review = queue only (Aaron 2026-10-16). */
export function defendantMatchConfidence(
  entity: DefendantEntityKind,
  renovationRelevant: boolean,
  priorityCasePrefix: boolean,
): MatchConfidence {
  if (entity === "natural_person" || entity === "sole_proprietor") {
    return "review";
  }
  if (entity === "unknown") return "review";
  if (entity === "company" && (renovationRelevant || priorityCasePrefix)) {
    return "high";
  }
  return "review";
}

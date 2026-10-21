import type { z } from "zod";
import type { discussionHighlightSchema } from "./report-schema";

type Highlight = z.infer<typeof discussionHighlightSchema>;

/** Shared snippet lexicon (L1 bound counts + display). 「溝通」 excluded — DEC P0 false-positive fix. */
export const DISPUTE_SNIPPET_PATTERN =
  /超支|爛尾|糾紛|投訴|苦主|工程質素|中伏|拖工|走數|爭議/gu;

const NEGATION_BEFORE_PATTERN = /(冇|無|沒有|未有|零|唔會)/u;

export function isDisputeIncidentType(
  incidentType: Highlight["incidentType"],
): boolean {
  return (
    incidentType === "payment_dispute" ||
    incidentType === "quality_defect" ||
    incidentType === "delay_abandonment"
  );
}

/** P1: only structured incident types count as dispute highlights (not theme / free text). */
export function isDisputeHighlight(h: Highlight): boolean {
  return isDisputeIncidentType(h.incidentType);
}

export function highlightSuggestsDispute(h: Highlight): boolean {
  return isDisputeHighlight(h);
}

export function snippetHasDisputeKeyword(text: string): boolean {
  const normalized = text.normalize("NFKC");
  const re = new RegExp(DISPUTE_SNIPPET_PATTERN.source, "gu");
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalized)) !== null) {
    const start = match.index;
    const before = normalized.slice(Math.max(0, start - 3), start);
    if (NEGATION_BEFORE_PATTERN.test(before)) continue;
    return true;
  }
  return false;
}

export function hostFromHighlightUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

export function normalizeTitleForSyndicationDedupe(title: string): string {
  return title
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
}

/** Syndicated republications share normalised title (host may differ). */
export function syndicationKeyFromHighlight(h: Highlight): string {
  return normalizeTitleForSyndicationDedupe(
    h.summaryZh || h.factSummary || "",
  );
}

/** Dedupe syndicated stories (normalised title); keeps first occurrence. */
export function dedupeDisputeHighlights(highlights: Highlight[]): Highlight[] {
  const seen = new Set<string>();
  const out: Highlight[] = [];
  for (const h of highlights) {
    if (!isDisputeHighlight(h)) continue;
    const key = syndicationKeyFromHighlight(h);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out;
}

export function parseHighlightYear(h: Highlight): number | null {
  const raw = h.approxYear?.trim();
  if (raw && /^\d{4}$/.test(raw)) {
    const y = Number.parseInt(raw, 10);
    return Number.isFinite(y) ? y : null;
  }
  const fromHint = h.dateHint?.match(/20\d{2}/);
  if (fromHint) return Number.parseInt(fromHint[0], 10);
  return null;
}

export function isRecentHighlight(h: Highlight, generatedAt: string): boolean {
  const y = parseHighlightYear(h);
  if (y == null) return false;
  const anchor = new Date(generatedAt);
  const anchorYear = Number.isFinite(anchor.getFullYear())
    ? anchor.getFullYear()
    : new Date().getFullYear();
  return y >= anchorYear - 2;
}

export function ratedDisputeHighlights(
  highlights: Highlight[],
  generatedAt: string,
): Highlight[] {
  return dedupeDisputeHighlights(highlights).filter((h) =>
    isRecentHighlight(h, generatedAt),
  );
}

export function countDistinctHosts(highlights: Highlight[]): number {
  const hosts = new Set<string>();
  for (const h of highlights) {
    const host = hostFromHighlightUrl(h.url);
    if (host) hosts.add(host);
  }
  return hosts.size;
}

export function meetsHighRiskDisputeEvidence(
  highlights: Highlight[],
  generatedAt: string,
): boolean {
  const rated = ratedDisputeHighlights(highlights, generatedAt);
  return rated.length >= 2 && countDistinctHosts(rated) >= 2;
}

export function meetsSevereDisputeEvidence(
  highlights: Highlight[],
  generatedAt: string,
): boolean {
  return ratedDisputeHighlights(highlights, generatedAt).length >= 3;
}

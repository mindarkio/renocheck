import type { z } from "zod";
import type { discussionHighlightSchema } from "./report-schema";

type Highlight = z.infer<typeof discussionHighlightSchema>;

/** Shared snippet lexicon (L1 bound counts + display). 「溝通」 excluded — DEC P0 false-positive fix. Traditional + simplified. */
export const DISPUTE_SNIPPET_PATTERN =
  /超支|爛尾|烂尾|糾紛|纠纷|投訴|投诉|苦主|工程質素|工程质素|中伏|拖工|走數|走数|爭議|争议|延誤|延误|欠薪|追數|追数|漏水/u;

const NEGATOR = /(冇|無|无|沒有|没有|未有|零|唔會|不會|不会)/u;
/** Negator characters that are part of a non-negating word (無端走數、無數投訴、零星投訴…). */
const NON_NEGATING_COMPOUND = /(無端|无端|無數|无数|無法|无法|無理|无理|無良|无良|零星|零碎)$/u;
/** Double negation = affirmation (唔係冇投訴、並非零投訴、唔係唔會走數). */
const DOUBLE_NEGATION = /(唔係|並非|并非|不是|唔通)(冇|無|无|沒有|没有|未有|零|唔會|不會|不会)$/u;

/** NFKC, then drop emoji / variation selectors / ZWJ and whitespace between Han characters. */
export function normalizeSignalText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D]/gu, "")
    .replace(/(?<=\p{Script=Han})\s+(?=\p{Script=Han})/gu, "");
}

function isNegatedAt(text: string, start: number): boolean {
  const before = text.slice(Math.max(0, start - 6), start);
  const window = before.slice(-3);
  if (!NEGATOR.test(window)) return false;
  if (NON_NEGATING_COMPOUND.test(before)) return false;
  if (DOUBLE_NEGATION.test(before)) return false;
  return true;
}

/** True when `pattern` matches at least once without a negator in the 3 characters before it. */
export function hasUnnegatedMatch(text: string, pattern: RegExp): boolean {
  const normalized = normalizeSignalText(text);
  const re = new RegExp(pattern.source, "gu");
  let match: RegExpExecArray | null;
  while ((match = re.exec(normalized)) !== null) {
    if (!isNegatedAt(normalized, match.index)) return true;
  }
  return false;
}

export function snippetHasDisputeKeyword(text: string): boolean {
  return hasUnnegatedMatch(text, DISPUTE_SNIPPET_PATTERN);
}

export function isDisputeIncidentType(
  incidentType: Highlight["incidentType"],
): boolean {
  return (
    incidentType === "payment_dispute" ||
    incidentType === "quality_defect" ||
    incidentType === "delay_abandonment"
  );
}

/** P0: only structured incident types count as dispute highlights (not theme / free text). */
export function isDisputeHighlight(h: Highlight): boolean {
  return isDisputeIncidentType(h.incidentType);
}

export function highlightSuggestsDispute(h: Highlight): boolean {
  return isDisputeHighlight(h);
}

export function hostFromHighlightUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}

const SITE_ALIASES: Record<string, string> = {
  "lih.kg": "lihkg.com",
  "fb.com": "facebook.com",
  "fb.watch": "facebook.com",
  "twitter.com": "x.com",
  "t.co": "x.com",
  "youtu.be": "youtube.com",
  "instagr.am": "instagram.com",
};
const TWO_LEVEL_SUFFIX = /\.(com|org|net|edu|gov|idv)\.(hk|tw|cn|sg|my|au|uk)$|\.co\.(uk|jp|kr|nz)$/;

/** One key per site: drops www./m./amp. and subdomains, folds known aliases (lih.kg → lihkg.com). */
export function siteKeyFromUrl(url: string): string {
  let host = hostFromHighlightUrl(url).replace(/\.$/, "");
  if (!host) return "";
  host = SITE_ALIASES[host] ?? host;
  const labels = host.split(".");
  const keep = TWO_LEVEL_SUFFIX.test(host) ? 3 : 2;
  const site = labels.slice(-keep).join(".");
  return SITE_ALIASES[site] ?? site;
}

/** URL without query/hash/trailing slash, site-folded host. */
export function canonicalHighlightUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${siteKeyFromUrl(url)}${u.pathname.replace(/\/+$/, "")}`;
  } catch {
    return url;
  }
}

export function normalizeTitleForSyndicationDedupe(title: string): string {
  return normalizeSignalText(title)
    .replace(/\s+/g, "")
    .replace(/[^\p{L}\p{N}]/gu, "")
    .toLowerCase();
}

/** Drop a trailing site name: 「標題 - 香港經濟日報」「標題｜明報」「標題 | Yahoo」 → 「標題」. */
export function stripSiteSuffix(title: string): string {
  const head = title.split(/\s+[-–—|｜]\s+|｜/u)[0]?.trim() ?? "";
  return head.length >= 8 ? head : title;
}

/** url → source page title (from retrievalEvidence / webHits). */
export type SourceTitleByUrl = Record<string, string>;

/** Syndicated republications share the source headline; fall back to the LLM summary. */
export function syndicationKeyFromHighlight(
  h: Highlight,
  titles?: SourceTitleByUrl,
): string {
  const title = normalizeTitleForSyndicationDedupe(
    stripSiteSuffix(titles?.[h.url] ?? ""),
  );
  if (title.length >= 8) return `t:${title}`;
  return `s:${normalizeTitleForSyndicationDedupe(h.summaryZh || h.factSummary || "")}`;
}

/** Dedupe by canonical URL and by syndicated story; keeps first occurrence. */
export function dedupeDisputeHighlights(
  highlights: Highlight[],
  titles?: SourceTitleByUrl,
): Highlight[] {
  const seenStory = new Set<string>();
  const seenUrl = new Set<string>();
  const out: Highlight[] = [];
  for (const h of highlights) {
    if (!isDisputeHighlight(h)) continue;
    const url = canonicalHighlightUrl(h.url);
    const story = syndicationKeyFromHighlight(h, titles);
    if (seenUrl.has(url) || seenStory.has(story)) continue;
    seenUrl.add(url);
    seenStory.add(story);
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
  return y >= anchorYear - 2 && y <= anchorYear;
}

export function ratedDisputeHighlights(
  highlights: Highlight[],
  generatedAt: string,
  titles?: SourceTitleByUrl,
): Highlight[] {
  return dedupeDisputeHighlights(highlights, titles).filter((h) =>
    isRecentHighlight(h, generatedAt),
  );
}

export function countDistinctHosts(highlights: Highlight[]): number {
  const sites = new Set<string>();
  for (const h of highlights) {
    const site = siteKeyFromUrl(h.url);
    if (site) sites.add(site);
  }
  return sites.size;
}

export function meetsHighRiskDisputeEvidence(
  highlights: Highlight[],
  generatedAt: string,
  titles?: SourceTitleByUrl,
): boolean {
  const rated = ratedDisputeHighlights(highlights, generatedAt, titles);
  return rated.length >= 2 && countDistinctHosts(rated) >= 2;
}

export function meetsSevereDisputeEvidence(
  highlights: Highlight[],
  generatedAt: string,
  titles?: SourceTitleByUrl,
): boolean {
  const rated = ratedDisputeHighlights(highlights, generatedAt, titles);
  return rated.length >= 3 && countDistinctHosts(rated) >= 2;
}

import { snippetHasDisputeKeyword, hasUnnegatedMatch } from "./dispute-signals";
import {
  matchesPhoneAnchor,
  PRAISE_SNIPPET_PATTERN,
} from "./search-evidence-filter";
import type { WebSearchHit } from "./web-search";

/**
 * Display filter for 「相關公開連結」.
 *
 * L1 (`filterWebSearchHitsForLlm`) only checks that a company token or phone
 * appears somewhere. Forum questions and listicles pass, then fill the
 * default 15-hit cap because Facebook ranks high in the host sort.
 *
 * This filter does not change that L1 set. Grading still uses `boundHitCount`
 * and dispute/praise counts on the full L1 hits, and the LLM still sees them.
 * Only `retrievalEvidence` (the link list) is reduced.
 *
 * A discussion summary is a highlight list. The risk-report prompt leaves
 * highlights empty when a hit is not a citable incident, and calibration then
 * uses the bound-but-no-highlight summary. Dropping questions here does not
 * invent that summary.
 */

/** After the signal filter, do not pad the link list. */
export const PUBLIC_LINK_DISPLAY_CAP = 8;

/** Characters before the entity match and after it, on normalized text. */
const ENTITY_RADIUS = 24;

/** Name anchors shorter than this match too many unrelated pages. */
const MIN_ANCHOR_CHARS = 4;

const QUESTION_CUE =
  /有否|有冇|有沒有|有没有|有無人|有无人|有無.{0,8}(?:人|用過|用过|幫襯|帮衬)|想請教|想请教|請問|请问|請教大家|想問|想问|求問|求问|求推薦|求推荐|求介紹|求介绍|效果如何|好唔好|好不好|可唔可以|可不可以|點樣|点样|幫襯過|帮衬过|用過未|用过未|用過嗎|用过吗|推薦嗎|推荐吗|值得[嗎吗]|有人(?:用過|用过|幫襯|帮衬|試過|试过|知)/u;

/** First-hand incident. Overrides a question. Excludes 中伏 — common in group names. */
const FIRST_HAND =
  /我(?:用過|用过|幫襯|帮衬|訂金|订金|訂咗|订了|搵(?:過|咗|了)|找(?:過|了))|本人(?:用過|用过|幫襯|帮衬|訂金|订金)|親身|亲身|實測|实测|伏咗|伏了|訂金|订金|尾數|尾数|失聯|失联|唔覆|不回覆|不回复|被坑|被呃|被騙|被骗|呃錢|呃钱|執笠|执笠|走佬|爛尾|烂尾|超支|走數|走数|拖工|漏水|甩皮|脫落|脱落|跳樓|跳楼/u;

const NEWS_OR_REGISTRY =
  /判詞|判词|裁決|裁决|裁定|審裁|审裁|入稟|入禀|小額錢債|小额钱债|清盤|清盘|破產|破产|檢控|检控|屋宇署|公司註冊處|公司注册处|承建商名冊|承建商名册|註冊承建商|注册承建商/u;

const PRAISE_DETAIL =
  /準時|准时|手工|做工|態度|态度|跟進|跟进|價錢|价钱|收費|收费|報價|报价|完工|個月|个月|細心|细心|乾淨|干净|守時|守时|售後|售后|甩皮|漏水|跟足/u;

/**
 * English markers. Text is whitespace-stripped before matching, so there are
 * no word boundaries: avoid short stems that hide inside other words
 * (sued ⊂ issued, court ⊂ courtesy).
 */
const EN_FIRST_HAND =
  /deposit|abandon|disappear|unfinished|leak|scam|ripoff|rip-off|overcharg|nevercameback|stoppedreplying/i;
const EN_DISPUTE = /complain|dispute|delayed|poorworkmanship|defect/i;
const EN_NEWS =
  /smallclaims|tribunal|lawsuit|judgment|judgement|windingup|liquidat|bankrupt|prosecut|buildingsdepartment|registeredcontractor|companiesregistry/i;
const EN_QUESTION =
  /hasanyone|anyoneused|anyonetried|anyoneknow|anyreview|anyrecommend|anyexperience|isitworth|isitgood|recommendations\?/i;

const RECRUITMENT =
  /招聘|請人|请人|徵人|征人|出糧|出粮|請緊|请紧|兼職|兼职|全職|全职|職位|职位|月薪|日薪/u;

export type PublicLinkDropReason =
  | "weak_entity"
  | "recruitment"
  | "listicle"
  | "bare_question"
  | "no_signal"
  | "over_cap";

export type PublicLinkKeepReason =
  | "news_or_registry"
  | "dispute_or_experience"
  | "specific_praise"
  | "cited_highlight";

export type PublicLinkDecision = {
  keep: boolean;
  reason: PublicLinkDropReason | PublicLinkKeepReason;
};

export type PublicLinkSelection = {
  hits: WebSearchHit[];
  kept: number;
  dropped: Record<PublicLinkDropReason, number>;
};

function emptyDropped(): Record<PublicLinkDropReason, number> {
  return {
    weak_entity: 0,
    recruitment: 0,
    listicle: 0,
    bare_question: 0,
    no_signal: 0,
    over_cap: 0,
  };
}

/** Same folding as L1 token match (NFKC, drop whitespace, ASCII parens). */
export function normalizePublicLinkText(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")");
}

function anchorTokens(tokens: string[]): string[] {
  const long = new Set<string>();
  const short = new Set<string>();
  for (const raw of tokens) {
    const t = normalizePublicLinkText(raw);
    if (/^\d{8}$/.test(t)) continue;
    if (t.length >= MIN_ANCHOR_CHARS) long.add(t);
    else if (t.length >= 2) short.add(t);
  }
  // A 2–3 character brand already bound L1. Without this fallback every link
  // for that company is hidden, including real disputes.
  return [...(long.size > 0 ? long : short)];
}

function matchSpans(
  text: string,
  anchors: string[],
): { start: number; end: number }[] {
  const spans: { start: number; end: number }[] = [];
  for (const anchor of anchors) {
    let from = 0;
    while (from < text.length) {
      const i = text.indexOf(anchor, from);
      if (i < 0) break;
      spans.push({ start: i, end: i + anchor.length });
      from = i + Math.max(1, anchor.length);
    }
  }
  return spans;
}

const LIST_MARKER = /\d{1,2}[.、．]/g;

function windowsAround(
  text: string,
  spans: { start: number; end: number }[],
  clipToListItem = false,
): string[] {
  const marks = clipToListItem
    ? [...text.matchAll(LIST_MARKER)].map((m) => m.index ?? 0)
    : [];
  return spans.map((span) => {
    // marks is sorted: binary-search the item that contains this span.
    let left = 0;
    let right = marks.length;
    while (left < right) {
      const mid = (left + right) >> 1;
      if (marks[mid]! <= span.start) left = mid + 1;
      else right = mid;
    }
    const lo = left > 0 ? marks[left - 1]! : 0;
    let next = left;
    while (next < marks.length && marks[next]! < span.end) next += 1;
    const hi = next < marks.length ? marks[next]! : text.length;
    // In a numbered list, another item's incident must not count for this company.
    return text.slice(
      Math.max(lo, span.start - ENTITY_RADIUS),
      Math.min(hi, span.end + ENTITY_RADIUS),
    );
  });
}

function isQuestion(text: string): boolean {
  return QUESTION_CUE.test(text) || EN_QUESTION.test(text);
}

function isNumberedList(text: string): boolean {
  const numbered = text.match(LIST_MARKER);
  return Boolean(numbered && numbered.length >= 2);
}

function isListicle(text: string): boolean {
  if (isNumberedList(text)) return true;
  return /十大|八大|五強|盤點|合集|推薦名單|公司名單|邊間好/.test(text);
}

function isRecruitment(text: string): boolean {
  return RECRUITMENT.test(text);
}

function hasSpecificPraise(window: string): boolean {
  if (!hasUnnegatedMatch(window, PRAISE_SNIPPET_PATTERN)) return false;
  return PRAISE_DETAIL.test(window);
}

function signalInWindows(
  windows: string[],
  question: boolean,
): PublicLinkKeepReason | null {
  for (const w of windows) {
    if (FIRST_HAND.test(w) || EN_FIRST_HAND.test(w)) {
      return "dispute_or_experience";
    }
    // A court / registry / news marker is never "question-only". `question`
    // is detected on the whole title+snippet, so a reader's 「請問」 in a
    // news snippet must not hide the ruling.
    if (NEWS_OR_REGISTRY.test(w) || EN_NEWS.test(w)) return "news_or_registry";
    if (question) continue;
    if (snippetHasDisputeKeyword(w) || EN_DISPUTE.test(w)) {
      return "dispute_or_experience";
    }
    if (hasSpecificPraise(w)) return "specific_praise";
  }
  return null;
}

function rankOf(reason: PublicLinkKeepReason): number {
  if (reason === "cited_highlight" || reason === "news_or_registry") return 0;
  if (reason === "dispute_or_experience") return 1;
  return 2;
}

/**
 * Whether one L1 hit is worth showing as a public link.
 * `tokens` are the same entity tokens L1 used.
 */
export function classifyPublicLinkHit(
  hit: WebSearchHit,
  tokens: string[],
  normalizedPhone?: string,
): PublicLinkDecision {
  const anchors = anchorTokens(tokens);
  const phone = normalizedPhone?.replace(/\D/g, "");
  const hasPhone = Boolean(phone && phone.length === 8);
  const titleNorm = normalizePublicLinkText(hit.title);
  const snippetNorm = normalizePublicLinkText(hit.snippet);
  const full = `${titleNorm}${snippetNorm}`;
  const visibleRaw = `${hit.title}\n${hit.snippet}`;

  const nameInTitle = matchSpans(titleNorm, anchors).length > 0;
  const nameInSnippet = matchSpans(snippetNorm, anchors).length > 0;
  const phoneInTitle = hasPhone && matchesPhoneAnchor(hit.title, phone!);
  const phoneInVisible = hasPhone && matchesPhoneAnchor(visibleRaw, phone!);

  if (!nameInTitle && !nameInSnippet && !phoneInVisible) {
    return { keep: false, reason: "weak_entity" };
  }

  // Title names another subject; a passing mention in the snippet only counts
  // if that snippet itself carries the signal.
  const entityInTitle = nameInTitle || phoneInTitle;
  const scope = entityInTitle ? full : snippetNorm;
  const spans = matchSpans(scope, anchors);
  const windows =
    spans.length > 0
      ? windowsAround(scope, spans, isNumberedList(full))
      : phoneInVisible
        ? [scope]
        : [];

  const question = isQuestion(full);
  const signal = signalInWindows(windows, question);
  if (signal) return { keep: true, reason: signal };

  if (isRecruitment(full)) return { keep: false, reason: "recruitment" };
  if (isListicle(full)) return { keep: false, reason: "listicle" };
  if (question) return { keep: false, reason: "bare_question" };
  return { keep: false, reason: "no_signal" };
}

/**
 * Signal-bearing L1 hits for the public link list.
 * URLs in `alwaysIncludeUrls` (highlight citations) stay even if the heuristic
 * would drop them, so a formed summary still has its sources in the list.
 */
export function selectPublicLinkHits(
  hits: WebSearchHit[],
  tokens: string[],
  opts?: {
    normalizedPhone?: string;
    alwaysIncludeUrls?: ReadonlySet<string>;
  },
): PublicLinkSelection {
  const dropped = emptyDropped();
  const force = opts?.alwaysIncludeUrls;
  const rows = hits.map((hit, index) => {
    if (force?.has(hit.url)) {
      return {
        hit,
        index,
        keep: true,
        reason: "cited_highlight" as const,
        rank: 0,
      };
    }
    const decision = classifyPublicLinkHit(
      hit,
      tokens,
      opts?.normalizedPhone,
    );
    if (!decision.keep) {
      dropped[decision.reason as PublicLinkDropReason] += 1;
      return {
        hit,
        index,
        keep: false,
        reason: decision.reason,
        rank: 9,
      };
    }
    const reason = decision.reason as PublicLinkKeepReason;
    return { hit, index, keep: true, reason, rank: rankOf(reason) };
  });

  const keptRows = rows.filter((row) => row.keep);
  const cited = keptRows.filter((row) => row.reason === "cited_highlight");
  const rest = keptRows.filter((row) => row.reason !== "cited_highlight");
  rest.sort((a, b) => a.rank - b.rank || a.index - b.index);
  const room = Math.max(0, PUBLIC_LINK_DISPLAY_CAP - cited.length);
  const picked = new Set<WebSearchHit>();
  for (const row of cited) picked.add(row.hit);
  for (const row of rest.slice(0, room)) picked.add(row.hit);
  dropped.over_cap += Math.max(0, rest.length - room);

  return {
    hits: hits.filter((hit) => picked.has(hit)),
    kept: picked.size,
    dropped,
  };
}

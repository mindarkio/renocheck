import type { RetrievalEvidenceItem } from "./report-schema";
import type { WebSearchHit } from "./web-search";

const TITLE_MAX = 200;
const SNIPPET_EXCERPT_MAX = 280;

const ALLOWLIST_HOST_SUFFIXES = [
  "lihkg.com",
  "discuss.com.hk",
  "facebook.com",
  "threads.net",
  "threads.com",
  "consumer.org.hk",
  "hket.com",
  "mingpao.com",
  "scmp.com",
  "youtube.com",
  "youtu.be",
  "tkww.hk",
];

function hostScore(url: string): number {
  try {
    const host = new URL(url).hostname.toLowerCase();
    for (let i = 0; i < ALLOWLIST_HOST_SUFFIXES.length; i++) {
      const suffix = ALLOWLIST_HOST_SUFFIXES[i];
      if (host === suffix || host.endsWith(`.${suffix}`)) {
        return ALLOWLIST_HOST_SUFFIXES.length - i;
      }
    }
  } catch {
    return 0;
  }
  return 0;
}

function hitBlob(h: WebSearchHit): string {
  return `${h.title} ${h.snippet} ${h.url}`;
}

function normalizeMatchText(s: string): string {
  return s
    .normalize("NFKC")
    .replace(/\s+/g, "")
    .replace(/（/g, "(")
    .replace(/）/g, ")");
}

function matchesToken(blob: string, token: string): boolean {
  if (!token) return false;
  const b = normalizeMatchText(blob);
  const t = normalizeMatchText(token);
  return b.includes(t);
}

/** Snippets/titles from bound hits (pre-LLM dispute signal). */
export const DISPUTE_SNIPPET_PATTERN =
  /超支|爛尾|糾紛|投訴|苦主|溝通|工程質素|中伏|拖工|走數|爭議/;

export function countBoundDisputeSignals(hits: WebSearchHit[]): number {
  return hits.filter((h) =>
    DISPUTE_SNIPPET_PATTERN.test(`${h.title} ${h.snippet}`),
  ).length;
}

/** DEC-0010 Appendix A — praise lexicon v0 (NFKC applied in match). */
export const PRAISE_SNIPPET_PATTERN =
  /推荐|讚|赞|好評|好评|滿意|满意|用心|準時|准时|手工好|做工仔細|信得过|信得過|靠谱|靠譜|專業|专业/;

export function countBoundPraiseSignals(hits: WebSearchHit[]): number {
  return hits.filter((h) => {
    const blob = `${h.title} ${h.snippet}`.normalize("NFKC");
    return PRAISE_SNIPPET_PATTERN.test(blob);
  }).length;
}

export function llmHitCap(): number {
  const raw = process.env.SERP_LLM_HIT_CAP?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 15;
  if (!Number.isFinite(n) || n < 1) return 15;
  return Math.min(n, 30);
}

export type L1FilterOptions = {
  /** Every bound hit must also match at least one of these (e.g. brand 源始). */
  mustIncludeAny?: string[];
  /** 8-digit HK phone; OR-match with entity tokens (DEC-0007 P2). */
  normalizedPhone?: string;
};

/** Match normalized 8-digit phone in title/snippet/url (spaces, hyphens, +852). */
export function matchesPhoneAnchor(blob: string, normalizedPhone: string): boolean {
  const phone = normalizedPhone.replace(/\D/g, "");
  if (phone.length !== 8) return false;

  if (blob.includes(phone)) return true;

  const spaced = `${phone.slice(0, 4)} ${phone.slice(4)}`;
  const hyphen = `${phone.slice(0, 4)}-${phone.slice(4)}`;
  if (blob.includes(spaced) || blob.includes(hyphen)) return true;

  const digitsOnly = blob.replace(/\D/g, "");
  if (digitsOnly.includes(phone)) return true;
  if (digitsOnly.includes(`852${phone}`)) return true;

  return false;
}

function passesEntityTokenL1(
  blob: string,
  tokens: string[],
  mustIncludeAny?: string[],
): boolean {
  if (tokens.length === 0) return false;
  if (!tokens.some((t) => matchesToken(blob, t))) return false;
  if (mustIncludeAny?.length) {
    return mustIncludeAny.some((a) => matchesToken(blob, a));
  }
  return true;
}

/** L1 hard match + soft L0 ordering; returns hits for LLM (may be empty). */
export function filterWebSearchHitsForLlm(
  hits: WebSearchHit[],
  tokens: string[],
  opts?: L1FilterOptions,
): WebSearchHit[] {
  const phone = opts?.normalizedPhone?.replace(/\D/g, "");
  const hasPhone = Boolean(phone && phone.length === 8);
  if (tokens.length === 0 && !hasPhone) return [];

  const matched = hits.filter((h) => {
    const blob = hitBlob(h);
    if (hasPhone && matchesPhoneAnchor(blob, phone!)) return true;
    return passesEntityTokenL1(blob, tokens, opts?.mustIncludeAny);
  });

  matched.sort((a, b) => hostScore(b.url) - hostScore(a.url));

  return matched.slice(0, llmHitCap());
}

function firstMatchedToken(blob: string, tokens: string[]): string {
  for (const t of tokens) {
    if (matchesToken(blob, t)) return t;
  }
  return "";
}

export type RetrievalEvidenceBuildOptions = {
  normalizedPhone?: string;
};

/** Deterministic SSOT rows for L1-bound hits (same set as sent to LLM). */
export function buildRetrievalEvidence(
  boundHits: WebSearchHit[],
  tokens: string[],
  opts?: RetrievalEvidenceBuildOptions,
): RetrievalEvidenceItem[] {
  const phone = opts?.normalizedPhone?.replace(/\D/g, "");
  const hasPhone = Boolean(phone && phone.length === 8);

  return boundHits.map((h) => {
    const blob = hitBlob(h);
    const token = firstMatchedToken(blob, tokens);
    if (token) {
      return {
        url: h.url,
        title: h.title.slice(0, TITLE_MAX),
        snippetExcerpt: h.snippet.slice(0, SNIPPET_EXCERPT_MAX),
        matchedToken: token,
        matchReason: "entity_token" as const,
      };
    }
    if (hasPhone && matchesPhoneAnchor(blob, phone!)) {
      return {
        url: h.url,
        title: h.title.slice(0, TITLE_MAX),
        snippetExcerpt: h.snippet.slice(0, SNIPPET_EXCERPT_MAX),
        matchedToken: phone!,
        matchReason: "phone_anchor" as const,
      };
    }
    return {
      url: h.url,
      title: h.title.slice(0, TITLE_MAX),
      snippetExcerpt: h.snippet.slice(0, SNIPPET_EXCERPT_MAX),
      matchedToken: token || phone || "",
      matchReason: "entity_token" as const,
    };
  });
}

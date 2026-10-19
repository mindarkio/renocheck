import { SearchPipelineError } from "./search-pipeline-error";
import { resolveAuthoritativeSearchLabel } from "./entity-report-context";
import { normalizeHongKongPhone } from "./normalize-phone";
import {
  normalizeSearchLabelForSerp,
  resolveBrandSerpSearchPhrase,
} from "./search-entity-labels";
import {
  isWebSearchConfigured,
  resolveWebSearchProvider,
  type WebSearchProvider,
} from "./search-provider";

const SERP_FETCH_TIMEOUT_MS = 25_000;

export type WebSearchHit = {
  title: string;
  url: string;
  snippet: string;
};

/** Google organic results per SerpAPI request (max 10). */
const SERP_PER_PAGE = 10;

export function serpPageCount(): number {
  const raw = process.env.SERP_PAGE_COUNT?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 2;
  if (!Number.isFinite(n) || n < 1) return 2;
  return Math.min(n, 3);
}

/** Production Q2 pages (DEC-0003); default 1 to keep total requests ≤4 with Q1×2. */
export function serpQ2PageCount(): number {
  const raw = process.env.SERP_Q2_PAGES?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 1;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, serpPageCount());
}

/** Production Q3 pages (DEC-0007); default 1 (+10 organic when phone present). */
export function serpQ3PageCount(): number {
  const raw = process.env.SERP_Q3_PAGES?.trim();
  const n = raw ? Number.parseInt(raw, 10) : 1;
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.min(n, 1);
}

/** Phone-first Serp (quoted 8-digit HK local). No product-banned terms in query. */
/** When Q1+Q2 miss forum gold, retry on discussion hosts (DEC-0003; +1 Serp page). */
export function buildBrandHostForumQuery(brandPhrase: string): string {
  const sites =
    "(site:threads.com OR site:threads.net OR site:tkww.hk OR site:facebook.com OR site:lihkg.com OR site:discuss.com.hk)";
  const risk = "(裝修 OR 糾紛 OR 投訴 OR 苦主 OR 爛尾 OR 超支)";
  return `${sites} "${brandPhrase}" ${risk}`;
}

export function mergeWebSearchHits(
  ...groups: WebSearchHit[][]
): WebSearchHit[] {
  return dedupeHits(groups.flat());
}

export function buildPhoneAnchorQuery(normalizedPhone: string): string {
  const phone = normalizedPhone.replace(/\D/g, "");
  const topics = '("裝修" OR "工程" OR "室內設計" OR "師傅")';
  const risk =
    '("爛尾" OR "超支" OR "苦主" OR "投訴" OR "拖工" OR "糾紛")';
  return `"${phone}" ${topics} ${risk}`;
}

export function resolveEntitySearchLabel(
  input: {
    companyName?: string;
    phone?: string;
    br?: string;
  },
  opts?: { mwcCompanyName?: string },
): string {
  return (
    input.companyName?.trim() ||
    opts?.mwcCompanyName?.trim() ||
    input.phone ||
    input.br ||
    ""
  );
}

/** Q1: forum sites + risk keywords (production default). */
function serpEntityLabel(
  input: {
    companyName?: string;
    phone?: string;
    br?: string;
  },
  opts?: { mwcCompanyName?: string },
): string {
  const entity = resolveAuthoritativeSearchLabel(input, opts);
  const brand = resolveBrandSerpSearchPhrase(entity);
  if (brand) return brand;
  return normalizeSearchLabelForSerp(entity);
}

export function buildWebSearchQuery(
  input: {
    companyName?: string;
    phone?: string;
    br?: string;
  },
  opts?: { mwcCompanyName?: string },
): string {
  const entity = serpEntityLabel(input, opts);
  const sites =
    "(site:facebook.com OR site:lihkg.com OR site:discuss.com.hk OR site:threads.net OR site:threads.com)";
  const topics = "(裝修 OR 工程 OR 室內設計)";
  const risk = "(爛尾 OR 超支 OR 苦主 OR 投訴 OR 糾紛)";
  return `"${entity}" ${topics} ${risk} ${sites}`;
}

/** Q2 (legacy eval): quoted full entity, broad web. */
export function buildWebSearchQueryBroad(
  input: {
    companyName?: string;
    phone?: string;
    br?: string;
  },
  opts?: { mwcCompanyName?: string },
): string {
  const entity = resolveAuthoritativeSearchLabel(input, opts);
  return `"${entity}" 裝修 (投訴 OR 苦主 OR 爛尾 OR 糾紛 OR 超支)`;
}

/** Core terms for loose Q2 (no surrounding quotes). */
export function looseEntityCoreTerms(entityLabel: string): string {
  return entityLabel
    .replace(/有限公司$/u, "")
    .replace(/有限責任公司$/u, "")
    .replace(/[（）()]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Q2 (production): short unquoted entity + risk terms (DEC-0003). */
export function buildWebSearchQueryLoose(
  input: {
    companyName?: string;
    phone?: string;
    br?: string;
  },
  opts?: { mwcCompanyName?: string },
): string {
  const entity = normalizeSearchLabelForSerp(
    resolveAuthoritativeSearchLabel(input, opts),
  );
  const brandPhrase = resolveBrandSerpSearchPhrase(entity);
  const risk = "(投訴 OR 苦主 OR 爛尾 OR 糾紛 OR 超支)";
  if (brandPhrase) {
    return `"${brandPhrase}" 裝修 ${risk}`;
  }
  const core = looseEntityCoreTerms(entity);
  const parts = core.split(/\s+/).filter((p) => p.length >= 2);
  // Multi-token cores (e.g. 源始 國際 設計及裝修): conjunctive quotes reduce off-topic Serp (M3).
  if (parts.length >= 2) {
    const quoted = parts.slice(0, 3).map((p) => `"${p}"`).join(" ");
    return `${quoted} 裝修 ${risk}`;
  }
  return `${core} 裝修 ${risk}`;
}

export type SearchQueryStrategyId = "Q1" | "Q2" | "Q1+Q2";

/** Production query pack (Q1 + Q2). */
export function buildEntitySearchQueries(
  input: {
    companyName?: string;
    phone?: string;
    br?: string;
  },
  opts?: { mwcCompanyName?: string },
): [string, string] {
  return [buildWebSearchQuery(input, opts), buildWebSearchQueryLoose(input, opts)];
}

/** Eval Q3: same loose shape as production Q2 (alias). */
export function buildWebSearchQueryLooseYuanshiStyle(
  entityLabel: string,
): string {
  const core = looseEntityCoreTerms(entityLabel);
  return `${core} 裝修 (投訴 OR 苦主 OR 爛尾 OR 糾紛)`;
}

export function buildQueriesForStrategy(
  strategy: SearchQueryStrategyId,
  input: {
    companyName?: string;
    phone?: string;
    br?: string;
  },
  opts?: { mwcCompanyName?: string },
): string[] {
  const q1 = buildWebSearchQuery(input, opts);
  const q2 = buildWebSearchQueryBroad(input, opts);
  if (strategy === "Q1") return [q1];
  if (strategy === "Q2") return [q2];
  return [q1, q2];
}

/** True when Serper or SerpAPI key is configured (see `search-provider.ts`). */
export function isSerpConfigured(): boolean {
  return isWebSearchConfigured();
}

type SerpJson = {
  error?: string;
  organic_results?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
  }>;
};

function mapSerpApiOrganic(json: SerpJson): WebSearchHit[] {
  return (json.organic_results ?? [])
    .filter((r) => r.link && r.title)
    .map((r) => ({
      title: r.title ?? "",
      url: r.link ?? "",
      snippet: (r.snippet ?? "").slice(0, 280),
    }));
}

type SerperJson = {
  organic?: Array<{
    title?: string;
    link?: string;
    snippet?: string;
  }>;
  message?: string;
};

function mapSerperOrganic(json: SerperJson): WebSearchHit[] {
  return (json.organic ?? [])
    .filter((r) => r.link && r.title)
    .map((r) => ({
      title: r.title ?? "",
      url: r.link ?? "",
      snippet: (r.snippet ?? "").slice(0, 280),
    }));
}

function serpLocale(): { gl: string; hl: string } {
  return {
    gl: process.env.SERP_GL?.trim() || "hk",
    hl: process.env.SERP_HL?.trim() || "zh-HK",
  };
}

function dedupeHits(hits: WebSearchHit[]): WebSearchHit[] {
  const seen = new Set<string>();
  const out: WebSearchHit[] = [];
  for (const h of hits) {
    if (seen.has(h.url)) continue;
    seen.add(h.url);
    out.push(h);
  }
  return out;
}

/** Dev/eval: fetches up to N pages; single-page failures do not abort other pages (P2-D). */
export async function fetchSerpOrganicHits(
  query: string,
  opts?: { pages?: number; deadlineMs?: number },
): Promise<WebSearchHit[]> {
  const provider = resolveWebSearchProvider();
  if (!provider) {
    throw new SearchPipelineError("serp_unavailable");
  }
  const pages = opts?.pages ?? serpPageCount();
  const starts = Array.from({ length: pages }, (_, i) => i * SERP_PER_PAGE);

  let pagesOk = 0;
  let pagesFailed = 0;
  const batches: WebSearchHit[][] = [];

  for (const start of starts) {
    if (opts?.deadlineMs !== undefined && Date.now() >= opts.deadlineMs) {
      pagesFailed += 1;
      console.warn(
        JSON.stringify({ event: "serp_page_skipped_deadline", start }),
      );
      continue;
    }
    try {
      const pageHits = await fetchOrganicPage(
        provider,
        query,
        start,
        opts?.deadlineMs,
      );
      pagesOk += 1;
      batches.push(pageHits);
    } catch (e) {
      pagesFailed += 1;
      console.warn(
        JSON.stringify({
          event: "serp_page_failed",
          start,
          message: String(e).slice(0, 160),
        }),
      );
    }
  }

  const hits = dedupeHits(batches.flat());

  if (pagesFailed > 0 && pagesOk > 0) {
    console.info(
      JSON.stringify({
        event: "serp_partial",
        provider,
        pages_ok: pagesOk,
        pages_failed: pagesFailed,
        organic: hits.length,
        query_chars: query.length,
      }),
    );
  }

  if (pagesOk === 0 && pages > 0) {
    throw new SearchPipelineError(
      "serp_failed",
      "all Serp pages failed for query",
    );
  }

  return hits;
}

async function fetchOrganicPage(
  provider: WebSearchProvider,
  query: string,
  start: number,
  deadlineMs?: number,
): Promise<WebSearchHit[]> {
  if (provider === "serper") {
    return fetchSerperPage(query, start, deadlineMs);
  }
  return fetchSerpApiPage(query, start, deadlineMs);
}

async function fetchSerpApiPage(
  query: string,
  start: number,
  deadlineMs?: number,
): Promise<WebSearchHit[]> {
  const apiKey = process.env.SERPAPI_KEY?.trim();
  if (!apiKey) {
    throw new SearchPipelineError("serp_unavailable");
  }
  const { gl, hl } = serpLocale();
  const googleDomain =
    process.env.SERP_GOOGLE_DOMAIN?.trim() || "google.com.hk";

  const params = new URLSearchParams({
    engine: "google",
    q: query,
    api_key: apiKey,
    hl,
    gl,
    google_domain: googleDomain,
    num: String(SERP_PER_PAGE),
    start: String(start),
  });

  const url = `https://serpapi.com/search.json?${params}`;
  const res = await fetchSerpWithTimeout(url, undefined, deadlineMs);

  if (!res.ok) {
    const body = await res.text();
    console.warn(
      JSON.stringify({
        event: "serp_error",
        provider: "serpapi",
        status: res.status,
        start,
        detail: body.slice(0, 240),
      }),
    );
    throw new SearchPipelineError(
      "serp_failed",
      `SerpAPI HTTP ${res.status}`,
    );
  }

  const json = (await res.json()) as SerpJson;
  if (json.error) {
    const detail = json.error;
    if (/hasn't returned any results/i.test(detail)) {
      console.info(
        JSON.stringify({
          event: "serp_empty_page",
          provider: "serpapi",
          start,
          detail,
        }),
      );
      return [];
    }
    console.warn(
      JSON.stringify({ event: "serp_error", provider: "serpapi", start, detail }),
    );
    throw new SearchPipelineError("serp_failed", detail);
  }

  return mapSerpApiOrganic(json);
}

async function fetchSerperPage(
  query: string,
  start: number,
  deadlineMs?: number,
): Promise<WebSearchHit[]> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) {
    throw new SearchPipelineError("serp_unavailable");
  }
  const { gl, hl } = serpLocale();
  const page = Math.floor(start / SERP_PER_PAGE) + 1;

  const res = await fetchSerpWithTimeout("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-KEY": apiKey,
    },
    body: JSON.stringify({
      q: query,
      gl,
      hl,
      num: SERP_PER_PAGE,
      page,
    }),
  }, deadlineMs);

  if (!res.ok) {
    const body = await res.text();
    console.warn(
      JSON.stringify({
        event: "serp_error",
        provider: "serper",
        status: res.status,
        start,
        detail: body.slice(0, 240),
      }),
    );
    throw new SearchPipelineError(
      "serp_failed",
      `Serper HTTP ${res.status}`,
    );
  }

  const json = (await res.json()) as SerperJson;
  if (json.message && !json.organic?.length) {
    console.info(
      JSON.stringify({
        event: "serp_empty_page",
        provider: "serper",
        start,
        detail: json.message,
      }),
    );
    return [];
  }

  return mapSerperOrganic(json);
}

async function fetchSerpWithTimeout(
  url: string,
  init?: RequestInit,
  deadlineMs?: number,
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const timeoutMs =
      deadlineMs === undefined
        ? SERP_FETCH_TIMEOUT_MS
        : Math.min(SERP_FETCH_TIMEOUT_MS, deadlineMs - Date.now());
    if (timeoutMs <= 0) {
      lastError = lastError ?? new Error("serp_deadline");
      break;
    }
    const started = performance.now();
    try {
      const res = await fetch(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
        ...init,
      });
      const ms = Math.round(performance.now() - started);
      if (ms >= 15_000) {
        console.info(JSON.stringify({ event: "serp_slow", ms, attempt }));
      }
      return res;
    } catch (e) {
      lastError = e;
      const ms = Math.round(performance.now() - started);
      console.warn(
        JSON.stringify({
          event: "serp_fetch_error",
          ms,
          attempt,
          message: String(e).slice(0, 120),
        }),
      );
      if (attempt === 0) continue;
    }
  }
  throw new SearchPipelineError(
    "serp_failed",
    lastError instanceof Error ? lastError.message : String(lastError),
  );
}

export type EntityWebSearchResult = {
  hits: WebSearchHit[];
  queriesCompleted: number;
};

/** Production: Q1 then Q2; Q2 failure returns Q1 hits only. */
export async function fetchWebSearchHitsForEntity(
  input: {
    companyName?: string;
    phone?: string;
    br?: string;
  },
  opts?: { mwcCompanyName?: string; deadlineMs?: number },
): Promise<EntityWebSearchResult> {
  const deadlineMs = opts?.deadlineMs;
  const [q1, q2] = buildEntitySearchQueries(input, opts);
  const q1Pages = serpPageCount();
  const q2Pages = serpQ2PageCount();

  const q1Start = performance.now();
  let merged: WebSearchHit[] = [];
  let queriesCompleted = 0;
  let q2Ms: number | undefined;

  try {
    const q1Hits = await fetchSerpOrganicHits(q1, { pages: q1Pages, deadlineMs });
    merged = dedupeHits(q1Hits);
    queriesCompleted = 1;
  } catch (e) {
    console.warn(
      JSON.stringify({
        event: "serp_query_failed",
        query_index: 1,
        message: String(e).slice(0, 160),
      }),
    );
  }
  const q1Ms = Math.round(performance.now() - q1Start);

  try {
    const q2Start = performance.now();
    const q2Hits = await fetchSerpOrganicHits(q2, { pages: q2Pages, deadlineMs });
    q2Ms = Math.round(performance.now() - q2Start);
    merged = dedupeHits([...merged, ...q2Hits]);
    queriesCompleted += 1;
  } catch (e) {
    console.warn(
      JSON.stringify({
        event: "serp_query_failed",
        query_index: 2,
        message: String(e).slice(0, 160),
      }),
    );
  }

  const normalizedPhone = normalizeHongKongPhone(input.phone);
  let q3Ms: number | undefined;
  if (normalizedPhone) {
    const q3Pages = serpQ3PageCount();
    try {
      const q3Start = performance.now();
      const q3 = buildPhoneAnchorQuery(normalizedPhone);
      const q3Hits = await fetchSerpOrganicHits(q3, { pages: q3Pages, deadlineMs });
      q3Ms = Math.round(performance.now() - q3Start);
      merged = dedupeHits([...merged, ...q3Hits]);
      queriesCompleted += 1;
    } catch (e) {
      console.warn(
        JSON.stringify({
          event: "serp_query_failed",
          query_index: 3,
          message: String(e).slice(0, 160),
        }),
      );
    }
  }

  console.info(
    JSON.stringify({
      event: "serp_ok",
      provider: resolveWebSearchProvider(),
      organic_merged: merged.length,
      queries_completed: queriesCompleted,
      q1_pages: q1Pages,
      q2_pages: q2Pages,
      q1_ms: q1Ms,
      ...(q2Ms != null ? { q2_ms: q2Ms } : {}),
      ...(normalizedPhone ? { q3_pages: serpQ3PageCount() } : {}),
      ...(q3Ms != null ? { q3_ms: q3Ms } : {}),
    }),
  );

  return { hits: merged, queriesCompleted };
}

export async function fetchWebSearchHits(
  query: string,
): Promise<WebSearchHit[]> {
  const pages = serpPageCount();
  const hits = await fetchSerpOrganicHits(query, { pages });
  const maxHits = pages * SERP_PER_PAGE;

  console.info(
    JSON.stringify({
      event: "serp_ok",
      organic: hits.length,
      pages,
      query_chars: query.length,
    }),
  );

  return hits.slice(0, maxHits);
}

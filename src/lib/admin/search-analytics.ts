import { assertNotProdDbOutsideProd } from "@/lib/db-guard";
import { foldFullWidth, stripControlAndBidi } from "@/lib/feedback/redact";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const SEARCH_CACHE_ANALYTICS_SELECT =
  "fingerprint, term:query_input->>companyName, match_type:query_input->>matchType, outcome:report->entity->>nameAlignment, matched_name:report->official->details->>companyName";

const EVENT_PAGE_SIZE = 1000;
const EVENT_ROW_CAP = 50_000;
const CACHE_CHUNK_SIZE = 200;
const TERMS_ROW_CAP = 100;

export type AnalyticsDays = 7 | 30 | 90;

export function parseAnalyticsDays(raw: string | undefined): AnalyticsDays {
  if (raw === "7" || raw === "30" || raw === "90") return Number(raw) as AnalyticsDays;
  return 30;
}

export type SearchEventRow = {
  fingerprint: string;
  cache_hit: boolean;
  created_at: string;
};

export type SearchCacheAnalyticsRow = {
  fingerprint: string;
  term: string | null;
  match_type: string | null;
  outcome: string | null;
  matched_name: string | null;
};

export type TermRow = {
  term: string;
  length: number;
  searches: number;
  cacheHits: number;
  outcome: string | null;
  matchedName: string | null;
  lastSeen: string;
};

export type DailyRow = {
  day: string;
  searches: number;
  cacheHitPct: number;
};

export type SearchAnalyticsView =
  | "all"
  | "none"
  | "ambiguous"
  | "mwc_authoritative"
  | "short";

export type SearchAnalyticsAggregate = {
  kpi: {
    totalSearches: number;
    cacheHitPct: number;
    cacheHitCount: number;
    noMatchPct: number;
    noMatchCount: number;
    ambiguousPct: number;
    ambiguousCount: number;
    byInputType: {
      company_name: number;
      phone: number;
      br: number;
      unknown: number;
    };
    missingCacheRow: number;
  };
  terms: TermRow[];
  views: Record<SearchAnalyticsView, TermRow[]>;
  daily: DailyRow[];
  truncated: boolean;
};

const HK_TZ = "Asia/Hong_Kong";

export function hkDayKey(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: HK_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function formatHkDateTime(iso: string): string {
  const d = new Date(iso);
  return new Intl.DateTimeFormat("zh-HK", {
    timeZone: HK_TZ,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

const TERM_EMAIL_RE = /[A-Z0-9._%+-]+\s?@\s?[A-Z0-9-]+(?:\s?\.\s?[A-Z0-9-]+)*\s?\.\s?[A-Z]{2,}/gi;
const TERM_HKID_RE =
  /(?<![A-Za-z0-9])[A-Za-z]{1,2}\s?\d{6}(?:\s?\(\s?[0-9A]\s?\)|[0-9A])?(?![0-9A-Za-z])/g;
/** 7+ digits with up to 2 separators between them: phone numbers, BR numbers, account numbers. */
const TERM_DIGIT_RUN_RE = /\+?\d(?:[\s.\-_/·()]{0,2}\d){6,}/g;

/**
 * Company-name terms are free text: people paste phone / BR numbers or e-mails next to a name
 * (the search box only routes digit-only input to phone/BR). Mask those before anything reaches JSX.
 */
export function maskAdminTerm(raw: string): string {
  return foldFullWidth(stripControlAndBidi(raw))
    .replace(TERM_EMAIL_RE, "[電郵]")
    .replace(TERM_HKID_RE, "[身份證]")
    .replace(TERM_DIGIT_RUN_RE, "[號碼]")
    .trim();
}

function codePointLength(term: string): number {
  return [...term].length;
}

function pct(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

/** Start of the oldest HK calendar day shown in `daily`, so KPI totals and the daily chart cover the same events. HK has no DST. */
export function analyticsRangeStart(now: Date, days: AnalyticsDays): Date {
  const oldestDay = hkDayKey(new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000));
  return new Date(`${oldestDay}T00:00:00+08:00`);
}

function listDaysInRange(now: Date, days: AnalyticsDays): string[] {
  const keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
    keys.push(hkDayKey(d));
  }
  return [...new Set(keys)].sort();
}

export function aggregateSearchAnalytics(
  events: SearchEventRow[],
  cacheRows: SearchCacheAnalyticsRow[],
  now: Date,
  days: AnalyticsDays,
): SearchAnalyticsAggregate {
  const cacheByFp = new Map<string, SearchCacheAnalyticsRow>();
  for (const row of cacheRows) {
    cacheByFp.set(row.fingerprint, row);
  }

  const byInputType = {
    company_name: 0,
    phone: 0,
    br: 0,
    unknown: 0,
  };
  let missingCacheRow = 0;
  let cacheHitCount = 0;
  let companyWithCache = 0;
  let noMatchCount = 0;
  let ambiguousCount = 0;

  const dailyMap = new Map<string, { searches: number; cacheHits: number }>();
  for (const day of listDaysInRange(now, days)) {
    dailyMap.set(day, { searches: 0, cacheHits: 0 });
  }

  type FpAgg = {
    searches: number;
    cacheHits: number;
    lastSeen: string;
    cache: SearchCacheAnalyticsRow | undefined;
  };
  const byFp = new Map<string, FpAgg>();

  for (const ev of events) {
    cacheHitCount += ev.cache_hit ? 1 : 0;
    const cache = cacheByFp.get(ev.fingerprint);
    if (!cache) {
      missingCacheRow += 1;
      byInputType.unknown += 1;
    } else {
      const mt = cache.match_type ?? "unknown";
      if (mt === "company_name") byInputType.company_name += 1;
      else if (mt === "phone") byInputType.phone += 1;
      else if (mt === "br") byInputType.br += 1;
      else byInputType.unknown += 1;

      if (mt === "company_name") {
        companyWithCache += 1;
        if (cache.outcome === "user_only") noMatchCount += 1;
        if (cache.outcome === "ambiguous") ambiguousCount += 1;
      }
    }

    const day = hkDayKey(ev.created_at);
    const bucket = dailyMap.get(day);
    if (bucket) {
      bucket.searches += 1;
      if (ev.cache_hit) bucket.cacheHits += 1;
    }

    let agg = byFp.get(ev.fingerprint);
    if (!agg) {
      agg = { searches: 0, cacheHits: 0, lastSeen: ev.created_at, cache };
      byFp.set(ev.fingerprint, agg);
    }
    agg.searches += 1;
    if (ev.cache_hit) agg.cacheHits += 1;
    if (ev.created_at > agg.lastSeen) agg.lastSeen = ev.created_at;
    if (!agg.cache && cache) agg.cache = cache;
  }

  const termsAll: TermRow[] = [];
  for (const [fp, agg] of byFp.entries()) {
    const row = cacheByFp.get(fp) ?? agg.cache;
    if (!row) continue;
    if (row.match_type === "phone" || row.match_type === "br") continue;
    if (row.match_type !== "company_name") continue;
    const rawTerm = row.term?.trim() ?? "";
    if (!rawTerm) continue;
    termsAll.push({
      term: maskAdminTerm(rawTerm),
      length: codePointLength(rawTerm),
      searches: agg.searches,
      cacheHits: agg.cacheHits,
      outcome: row.outcome,
      matchedName: row.matched_name ? maskAdminTerm(row.matched_name) : null,
      lastSeen: agg.lastSeen,
    });
  }

  termsAll.sort((a, b) => {
    if (b.searches !== a.searches) return b.searches - a.searches;
    return b.lastSeen.localeCompare(a.lastSeen);
  });

  const terms = termsAll.slice(0, TERMS_ROW_CAP);

  const filterView = (view: SearchAnalyticsView): TermRow[] => {
    let list = termsAll;
    if (view === "none") list = list.filter((t) => t.outcome === "user_only");
    else if (view === "ambiguous")
      list = list.filter((t) => t.outcome === "ambiguous");
    else if (view === "mwc_authoritative")
      list = list.filter((t) => t.outcome === "mwc_authoritative");
    else if (view === "short") list = list.filter((t) => t.length <= 4);
    return list.slice(0, TERMS_ROW_CAP);
  };

  const daily: DailyRow[] = [...dailyMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([day, stats]) => ({
      day,
      searches: stats.searches,
      cacheHitPct: pct(stats.cacheHits, stats.searches),
    }));

  return {
    kpi: {
      totalSearches: events.length,
      cacheHitPct: pct(cacheHitCount, events.length),
      cacheHitCount,
      noMatchPct: pct(noMatchCount, companyWithCache),
      noMatchCount,
      ambiguousPct: pct(ambiguousCount, companyWithCache),
      ambiguousCount,
      byInputType,
      missingCacheRow,
    },
    terms,
    views: {
      all: filterView("all"),
      none: filterView("none"),
      ambiguous: filterView("ambiguous"),
      mwc_authoritative: filterView("mwc_authoritative"),
      short: filterView("short"),
    },
    daily,
    truncated: false,
  };
}

export type FetchAnalyticsResult =
  | { ok: true; data: SearchAnalyticsAggregate }
  | { ok: false; code: string };

export async function fetchSearchAnalytics(
  days: AnalyticsDays,
): Promise<FetchAnalyticsResult> {
  try {
    assertNotProdDbOutsideProd();
  } catch {
    console.warn(JSON.stringify({ event: "admin_analytics_error", code: "refusing_prod_db" }));
    return { ok: false, code: "refusing_prod_db" };
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    console.warn(JSON.stringify({ event: "admin_analytics_error", code: "supabase_unconfigured" }));
    return { ok: false, code: "supabase_unconfigured" };
  }

  const now = new Date();
  const since = analyticsRangeStart(now, days);

  const events: SearchEventRow[] = [];
  let truncated = false;
  for (let offset = 0; offset < EVENT_ROW_CAP; offset += EVENT_PAGE_SIZE) {
    const { data, error } = await supabase
      .from("search_events")
      .select("fingerprint, cache_hit, created_at")
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: false })
      .range(offset, offset + EVENT_PAGE_SIZE - 1);
    if (error) {
      console.warn(JSON.stringify({ event: "admin_analytics_error", code: error.code }));
      return { ok: false, code: error.code ?? "query_failed" };
    }
    const batch = (data ?? []) as SearchEventRow[];
    events.push(...batch);
    if (batch.length < EVENT_PAGE_SIZE) break;
    if (events.length >= EVENT_ROW_CAP) {
      truncated = true;
      events.splice(EVENT_ROW_CAP);
      break;
    }
  }

  const fingerprints = [...new Set(events.map((e) => e.fingerprint))];
  const cacheRows: SearchCacheAnalyticsRow[] = [];
  for (let i = 0; i < fingerprints.length; i += CACHE_CHUNK_SIZE) {
    const chunk = fingerprints.slice(i, i + CACHE_CHUNK_SIZE);
    const { data, error } = await supabase
      .from("search_cache")
      .select(SEARCH_CACHE_ANALYTICS_SELECT)
      .in("fingerprint", chunk);
    if (error) {
      console.warn(JSON.stringify({ event: "admin_analytics_error", code: error.code }));
      return { ok: false, code: error.code ?? "query_failed" };
    }
    cacheRows.push(...((data ?? []) as SearchCacheAnalyticsRow[]));
  }

  const aggregate = aggregateSearchAnalytics(events, cacheRows, now, days);
  aggregate.truncated = truncated;
  return { ok: true, data: aggregate };
}

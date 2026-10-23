import "server-only";

import { assertNotProdDbOutsideProd } from "@/lib/db-guard";
import { isSyntheticProbeTerm } from "@/lib/synthetic-probe";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import {
  analyticsRangeStart,
  hkDayKey,
  type AnalyticsDays,
} from "@/lib/admin/search-analytics";
import {
  isMissingAnonIdColumn,
  isMissingUsageEventsTable,
  USAGE_EVENT_TYPES,
  type UsageEventType,
} from "@/lib/usage-event";

const PAGE_SIZE = 1000;
const ROW_CAP = 50_000;
const CACHE_CHUNK = 200;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Visits closer together than this are one sitting, not a return. */
export const RETURN_MIN_GAP_MS = 30 * 60 * 1000;

export type ReturnSearchRow = {
  anonId: string | null;
  fingerprint: string;
  createdAt: string;
};

export type ReturnUsageRow = {
  anonId: string | null;
  eventType: string;
  fingerprint: string | null;
  createdAt: string;
};

export type ReturnTermRow = {
  fingerprint: string;
  term: string | null;
};

export type ReturnWeekRow = {
  weekStart: string;
  newDevices: number;
  returningDevices: number;
};

export type ReturnAnalytics = {
  weeks: ReturnWeekRow[];
  /** Mutually exclusive gaps between /quote page views and searches. */
  intervals: {
    within1Day: number;
    within7Days: number;
    within30Days: number;
    over30Days: number;
  };
  /** Devices, not clicks. A device can be in more than one bucket. */
  returnerActions: {
    sameCompany: number;
    differentCompany: number;
    usedQuote: number;
  };
  funnel: {
    quotePage: number;
    quoteAllTicked: number;
    quoteCopyReply: number;
    reportOfficialLink: number;
    reportShare: number;
  };
  truncated: boolean;
  searchAnon: "ready" | "pending";
  usageEvents: "ready" | "pending";
  readError: boolean;
};

export function emptyReturnAnalytics(
  partial: Partial<ReturnAnalytics> = {},
): ReturnAnalytics {
  return {
    weeks: [],
    intervals: {
      within1Day: 0,
      within7Days: 0,
      within30Days: 0,
      over30Days: 0,
    },
    returnerActions: {
      sameCompany: 0,
      differentCompany: 0,
      usedQuote: 0,
    },
    funnel: {
      quotePage: 0,
      quoteAllTicked: 0,
      quoteCopyReply: 0,
      reportOfficialLink: 0,
      reportShare: 0,
    },
    truncated: false,
    searchAnon: "ready",
    usageEvents: "ready",
    readError: false,
    ...partial,
  };
}

/** Monday (Hong Kong) of the calendar week containing `value`. */
export function hkWeekStartKey(value: string | Date): string {
  const day = hkDayKey(value);
  const [year, month, date] = day.split("-").map(Number);
  const utc = new Date(Date.UTC(year, month - 1, date));
  const weekday = utc.getUTCDay();
  const delta = weekday === 0 ? 6 : weekday - 1;
  utc.setUTCDate(utc.getUTCDate() - delta);
  const mm = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utc.getUTCDate()).padStart(2, "0");
  return `${utc.getUTCFullYear()}-${mm}-${dd}`;
}

function weekKeysForRange(now: Date, days: AnalyticsDays): string[] {
  const start = analyticsRangeStart(now, days).getTime();
  const keys: string[] = [];
  for (let t = start; t <= now.getTime(); t += DAY_MS) {
    keys.push(hkWeekStartKey(new Date(t)));
  }
  keys.push(hkWeekStartKey(now));
  return [...new Set(keys)].sort();
}

function eventMs(value: string): number | null {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function isUsageEventType(value: string): value is UsageEventType {
  return (USAGE_EVENT_TYPES as readonly string[]).includes(value);
}

const FUNNEL_KEY = {
  quote_page: "quotePage",
  quote_all_ticked: "quoteAllTicked",
  quote_copy_reply: "quoteCopyReply",
  report_official_link: "reportOfficialLink",
  report_share: "reportShare",
} as const;

type Visit = {
  at: number;
  kind: "search" | "quote_page";
  fingerprint: string | null;
};

/**
 * ZZQ probe fingerprints are dropped, same as search KPIs.
 * Weekly new/returning uses every remaining event.
 * Return gaps use searches and /quote page views only, so a click in the
 * same sitting is not a return. Visits less than RETURN_MIN_GAP_MS apart are
 * also one sitting: no gap and no return action is counted for them.
 * Interval buckets do not overlap: 30 min to 1 day, then ≤7 days, then ≤30 days.
 */
export function aggregateReturnAnalytics(
  searches: ReturnSearchRow[],
  usage: ReturnUsageRow[],
  terms: ReturnTermRow[],
  now: Date,
  days: AnalyticsDays,
): ReturnAnalytics {
  const probes = new Set<string>();
  for (const row of terms) {
    if (isSyntheticProbeTerm(row.term ?? "")) probes.add(row.fingerprint);
  }

  const startMs = analyticsRangeStart(now, days).getTime();
  const endMs = now.getTime();
  const inRange = (at: number) => at >= startMs && at <= endMs;

  const result = emptyReturnAnalytics({
    weeks: weekKeysForRange(now, days).map((weekStart) => ({
      weekStart,
      newDevices: 0,
      returningDevices: 0,
    })),
  });

  const presence: { anonId: string; at: number }[] = [];
  const visitsByAnon = new Map<string, Visit[]>();

  const addVisit = (anonId: string, visit: Visit) => {
    const list = visitsByAnon.get(anonId);
    if (list) list.push(visit);
    else visitsByAnon.set(anonId, [visit]);
  };

  for (const row of searches) {
    if (!row.anonId || probes.has(row.fingerprint)) continue;
    const at = eventMs(row.createdAt);
    if (at == null) continue;
    presence.push({ anonId: row.anonId, at });
    addVisit(row.anonId, {
      at,
      kind: "search",
      fingerprint: row.fingerprint,
    });
  }

  for (const row of usage) {
    if (!isUsageEventType(row.eventType)) continue;
    if (row.fingerprint && probes.has(row.fingerprint)) continue;
    const at = eventMs(row.createdAt);
    if (at == null) continue;
    // A 90-day purge nulls anon_id and keeps the row, so the funnel count stays.
    if (inRange(at)) result.funnel[FUNNEL_KEY[row.eventType]] += 1;
    if (!row.anonId) continue;
    presence.push({ anonId: row.anonId, at });
    if (row.eventType === "quote_page") {
      addVisit(row.anonId, { at, kind: "quote_page", fingerprint: null });
    }
  }

  const firstAt = new Map<string, number>();
  for (const event of presence) {
    const prev = firstAt.get(event.anonId);
    if (prev == null || event.at < prev) firstAt.set(event.anonId, event.at);
  }

  const weekIndex = new Map(result.weeks.map((week, index) => [week.weekStart, index]));
  const fresh = new Map<string, Set<string>>();
  const returning = new Map<string, Set<string>>();

  for (const event of presence) {
    if (!inRange(event.at)) continue;
    const week = hkWeekStartKey(new Date(event.at));
    if (!weekIndex.has(week)) continue;
    const first = firstAt.get(event.anonId);
    if (first == null) continue;
    const bucket = hkWeekStartKey(new Date(first)) === week ? fresh : returning;
    const set = bucket.get(week) ?? new Set<string>();
    set.add(event.anonId);
    bucket.set(week, set);
  }

  result.weeks = result.weeks.map((week) => ({
    weekStart: week.weekStart,
    newDevices: fresh.get(week.weekStart)?.size ?? 0,
    returningDevices: returning.get(week.weekStart)?.size ?? 0,
  }));

  const sameCompany = new Set<string>();
  const differentCompany = new Set<string>();
  const usedQuote = new Set<string>();

  for (const [anonId, visits] of visitsByAnon) {
    visits.sort((a, b) => a.at - b.at);
    const priorSearches = new Set<string>();
    let prevAt: number | null = null;
    for (const visit of visits) {
      if (prevAt != null && inRange(visit.at) && visit.at - prevAt >= RETURN_MIN_GAP_MS) {
        const gap = visit.at - prevAt;
        if (gap <= DAY_MS) result.intervals.within1Day += 1;
        else if (gap <= 7 * DAY_MS) result.intervals.within7Days += 1;
        else if (gap <= 30 * DAY_MS) result.intervals.within30Days += 1;
        else result.intervals.over30Days += 1;

        if (visit.kind === "quote_page") usedQuote.add(anonId);
        else if (visit.fingerprint && priorSearches.has(visit.fingerprint)) {
          sameCompany.add(anonId);
        } else if (visit.fingerprint && priorSearches.size > 0) {
          differentCompany.add(anonId);
        }
      }
      if (visit.kind === "search" && visit.fingerprint) {
        priorSearches.add(visit.fingerprint);
      }
      prevAt = visit.at;
    }
  }

  result.returnerActions = {
    sameCompany: sameCompany.size,
    differentCompany: differentCompany.size,
    usedQuote: usedQuote.size,
  };
  return result;
}

type DbError = { code?: string; message?: string; details?: string } | null;

async function pageTable<T>(
  load: (offset: number) => Promise<{ data: T[] | null; error: DbError }>,
): Promise<{ rows: T[]; truncated: boolean; error: DbError }> {
  const rows: T[] = [];
  for (let offset = 0; offset < ROW_CAP; offset += PAGE_SIZE) {
    const { data, error } = await load(offset);
    if (error) return { rows: [], truncated: false, error };
    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < PAGE_SIZE) return { rows, truncated: false, error: null };
    if (rows.length >= ROW_CAP) {
      rows.splice(ROW_CAP);
      return { rows, truncated: true, error: null };
    }
  }
  return { rows, truncated: true, error: null };
}

export async function fetchReturnAnalytics(
  days: AnalyticsDays,
): Promise<ReturnAnalytics> {
  try {
    assertNotProdDbOutsideProd();
  } catch {
    return emptyReturnAnalytics({ readError: true });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) return emptyReturnAnalytics({ readError: true });

  try {
  const now = new Date();
  let readError = false;
  let truncated = false;
  let searchAnon: ReturnAnalytics["searchAnon"] = "ready";
  let usageEvents: ReturnAnalytics["usageEvents"] = "ready";

  const searchPage = await pageTable<{
    anon_id: string | null;
    fingerprint: string;
    created_at: string;
  }>(async (offset) => {
    const { data, error } = await supabase
      .from("search_events")
      .select("anon_id, fingerprint, created_at")
      .not("anon_id", "is", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    return {
      data: data as { anon_id: string | null; fingerprint: string; created_at: string }[] | null,
      error,
    };
  });

  const searches: ReturnSearchRow[] = [];
  if (searchPage.error) {
    if (isMissingAnonIdColumn(searchPage.error)) searchAnon = "pending";
    else {
      readError = true;
      console.warn(
        JSON.stringify({
          event: "admin_return_analytics_error",
          code: searchPage.error.code ?? "query_failed",
        }),
      );
    }
  } else {
    truncated = searchPage.truncated;
    for (const row of searchPage.rows) {
      searches.push({
        anonId: row.anon_id,
        fingerprint: row.fingerprint,
        createdAt: row.created_at,
      });
    }
  }

  const usagePage = await pageTable<{
    anon_id: string | null;
    event_type: string;
    fingerprint: string | null;
    created_at: string;
  }>(async (offset) => {
    const { data, error } = await supabase
      .from("usage_events")
      .select("anon_id, event_type, fingerprint, created_at")
      .order("created_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    return {
      data: data as {
        anon_id: string | null;
        event_type: string;
        fingerprint: string | null;
        created_at: string;
      }[] | null,
      error,
    };
  });

  const usage: ReturnUsageRow[] = [];
  if (usagePage.error) {
    if (isMissingUsageEventsTable(usagePage.error)) usageEvents = "pending";
    else {
      readError = true;
      console.warn(
        JSON.stringify({
          event: "admin_return_analytics_error",
          code: usagePage.error.code ?? "query_failed",
        }),
      );
    }
  } else {
    truncated = truncated || usagePage.truncated;
    for (const row of usagePage.rows) {
      usage.push({
        anonId: row.anon_id,
        eventType: row.event_type,
        fingerprint: row.fingerprint,
        createdAt: row.created_at,
      });
    }
  }

  const fingerprints = [
    ...new Set(
      [...searches.map((row) => row.fingerprint), ...usage.map((row) => row.fingerprint)]
        .filter((value): value is string => Boolean(value)),
    ),
  ];
  const terms: ReturnTermRow[] = [];
  for (let i = 0; i < fingerprints.length; i += CACHE_CHUNK) {
    const chunk = fingerprints.slice(i, i + CACHE_CHUNK);
    const { data, error } = await supabase
      .from("search_cache")
      .select("fingerprint, term:query_input->>companyName")
      .in("fingerprint", chunk);
    if (error) {
      readError = true;
      console.warn(
        JSON.stringify({
          event: "admin_return_analytics_error",
          code: error.code ?? "query_failed",
        }),
      );
      break;
    }
    terms.push(...((data ?? []) as ReturnTermRow[]));
  }

  const aggregate = aggregateReturnAnalytics(
    readError ? [] : searches,
    readError ? [] : usage,
    readError ? [] : terms,
    now,
    days,
  );
  aggregate.truncated = truncated;
  aggregate.searchAnon = searchAnon;
  aggregate.usageEvents = usageEvents;
  aggregate.readError = readError;
  return aggregate;
  } catch {
    console.warn(
      JSON.stringify({ event: "admin_return_analytics_error", code: "query_threw" }),
    );
    return emptyReturnAnalytics({ readError: true });
  }
}

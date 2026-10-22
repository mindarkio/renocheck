import { describe, expect, it } from "vitest";
import { randomFakePhoneDigits } from "@/lib/admin/test-helpers";
import { outcomeLabelZh } from "@/lib/admin/outcome-labels";
import {
  aggregateSearchAnalytics,
  hkDayKey,
  parseAnalyticsDays,
  SEARCH_CACHE_ANALYTICS_SELECT,
  type SearchCacheAnalyticsRow,
  type SearchEventRow,
} from "@/lib/admin/search-analytics";

const SENTINEL = "SENTINEL_TERM_MUST_NOT_RENDER";

describe("search analytics aggregation", () => {
  it("maps outcome labels", () => {
    expect(outcomeLabelZh("match")).toBe("完全吻合");
    expect(outcomeLabelZh("user_only")).toBe("搵唔到");
    expect(outcomeLabelZh(null)).toBe("未知");
  });

  it("parses days and falls back to 30", () => {
    expect(parseAnalyticsDays("7")).toBe(7);
    expect(parseAnalyticsDays("90")).toBe(90);
    expect(parseAnalyticsDays("nope")).toBe(30);
  });

  it("aggregates KPIs, grouping, sorting, and view filters", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const events: SearchEventRow[] = [
      {
        fingerprint: "fp-a",
        cache_hit: true,
        created_at: "2026-06-14T10:00:00.000Z",
      },
      {
        fingerprint: "fp-a",
        cache_hit: false,
        created_at: "2026-06-15T08:00:00.000Z",
      },
      {
        fingerprint: "fp-b",
        cache_hit: false,
        created_at: "2026-06-15T09:00:00.000Z",
      },
      {
        fingerprint: "fp-phone",
        cache_hit: true,
        created_at: "2026-06-15T09:30:00.000Z",
      },
    ];
    const PHONE_DIGITS = randomFakePhoneDigits();
    const cache: SearchCacheAnalyticsRow[] = [
      {
        fingerprint: "fp-a",
        term: "測試裝修有限公司",
        match_type: "company_name",
        outcome: "match",
        matched_name: "測試裝修有限公司",
      },
      {
        fingerprint: "fp-b",
        term: "甲乙工程",
        match_type: "company_name",
        outcome: "user_only",
        matched_name: null,
      },
      {
        fingerprint: "fp-phone",
        term: SENTINEL,
        match_type: "phone",
        outcome: null,
        matched_name: PHONE_DIGITS,
      },
    ];
    const result = aggregateSearchAnalytics(events, cache, now, 7);
    expect(result.kpi.totalSearches).toBe(4);
    expect(result.kpi.cacheHitCount).toBe(2);
    expect(result.kpi.byInputType.phone).toBe(1);
    expect(result.kpi.byInputType.company_name).toBe(3);
    expect(result.terms[0].term).toBe("甲乙工程");
    expect(result.terms[0].searches).toBe(1);
    expect(result.terms[1].term).toBe("測試裝修有限公司");
    expect(result.terms[1].searches).toBe(2);
    expect(result.views.none).toHaveLength(1);
    expect(result.views.none[0].term).toBe("甲乙工程");
    expect(result.terms.some((t) => t.term === SENTINEL)).toBe(false);
    expect(result.views.all.some((t) => t.term === SENTINEL)).toBe(false);
  });

  it("counts short terms by code points including emoji and full-width", () => {
    const now = new Date("2026-01-10T00:00:00.000Z");
    const events: SearchEventRow[] = [
      {
        fingerprint: "fp-short",
        cache_hit: false,
        created_at: "2026-01-09T16:00:00.000Z",
      },
    ];
    const cache: SearchCacheAnalyticsRow[] = [
      {
        fingerprint: "fp-short",
        term: "ＡＢ🙂",
        match_type: "company_name",
        outcome: "ambiguous",
        matched_name: null,
      },
    ];
    const result = aggregateSearchAnalytics(events, cache, now, 7);
    expect(result.terms[0].length).toBe(3);
    expect(result.views.short).toHaveLength(1);
  });

  it("zero-fills HK daily buckets across UTC midnight", () => {
    const now = new Date("2026-03-02T15:00:00.000Z");
    const events: SearchEventRow[] = [
      {
        fingerprint: "fp1",
        cache_hit: true,
        created_at: "2026-03-01T23:30:00.000Z",
      },
    ];
    const cache: SearchCacheAnalyticsRow[] = [
      {
        fingerprint: "fp1",
        term: "測試公司",
        match_type: "company_name",
        outcome: "match",
        matched_name: "測試公司",
      },
    ];
    const result = aggregateSearchAnalytics(events, cache, now, 7);
    expect(result.daily.length).toBeGreaterThanOrEqual(2);
    const total = result.daily.reduce((s, d) => s + d.searches, 0);
    expect(total).toBe(1);
    expect(hkDayKey("2026-03-02T01:00:00.000Z")).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("tracks missing cache rows", () => {
    const now = new Date();
    const events: SearchEventRow[] = [
      { fingerprint: "orphan", cache_hit: false, created_at: now.toISOString() },
    ];
    const result = aggregateSearchAnalytics(events, [], now, 7);
    expect(result.kpi.missingCacheRow).toBe(1);
    expect(result.kpi.byInputType.unknown).toBe(1);
  });

  it("orders terms newest first and breaks equal lastSeen by higher count", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const seen = "2026-06-15T09:00:00.000Z";
    const events: SearchEventRow[] = [
      { fingerprint: "fp-low", cache_hit: false, created_at: seen },
      { fingerprint: "fp-high", cache_hit: false, created_at: seen },
      { fingerprint: "fp-high", cache_hit: true, created_at: seen },
      {
        fingerprint: "fp-older",
        cache_hit: false,
        created_at: "2026-06-14T09:00:00.000Z",
      },
    ];
    const cache: SearchCacheAnalyticsRow[] = [
      {
        fingerprint: "fp-low",
        term: "低次數",
        match_type: "company_name",
        outcome: "match",
        matched_name: null,
      },
      {
        fingerprint: "fp-high",
        term: "高次數",
        match_type: "company_name",
        outcome: "match",
        matched_name: null,
      },
      {
        fingerprint: "fp-older",
        term: "較早",
        match_type: "company_name",
        outcome: "match",
        matched_name: null,
      },
    ];
    const result = aggregateSearchAnalytics(events, cache, now, 7);
    expect(result.terms.map((t) => t.term)).toEqual(["高次數", "低次數", "較早"]);
    expect(result.views.all.map((t) => t.term)).toEqual(["高次數", "低次數", "較早"]);
  });

  it("sorts lastSeen by instant when precision or offset differs", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const events: SearchEventRow[] = [
      {
        fingerprint: "fp-new",
        cache_hit: false,
        created_at: "2026-06-15T10:30:00.5Z",
      },
      {
        fingerprint: "fp-older-offset",
        cache_hit: false,
        created_at: "2026-06-15T18:00:00.100000+08:00",
      },
      {
        fingerprint: "fp-tie-low",
        cache_hit: false,
        created_at: "2026-06-15T17:00:00+08:00",
      },
      {
        fingerprint: "fp-tie-high",
        cache_hit: false,
        created_at: "2026-06-15T09:00:00.000Z",
      },
      {
        fingerprint: "fp-tie-high",
        cache_hit: false,
        created_at: "2026-06-15T09:00:00.000Z",
      },
    ];
    const cache: SearchCacheAnalyticsRow[] = [
      {
        fingerprint: "fp-new",
        term: "最新",
        match_type: "company_name",
        outcome: "match",
        matched_name: null,
      },
      {
        fingerprint: "fp-older-offset",
        term: "字串較大但較舊",
        match_type: "company_name",
        outcome: "match",
        matched_name: null,
      },
      {
        fingerprint: "fp-tie-low",
        term: "同時低次數",
        match_type: "company_name",
        outcome: "match",
        matched_name: null,
      },
      {
        fingerprint: "fp-tie-high",
        term: "同時高次數",
        match_type: "company_name",
        outcome: "match",
        matched_name: null,
      },
    ];
    const result = aggregateSearchAnalytics(events, cache, now, 7);
    expect(result.terms.map((t) => t.term)).toEqual([
      "最新",
      "字串較大但較舊",
      "同時高次數",
      "同時低次數",
    ]);
  });

  it("keeps the 100 newest terms when 101 fingerprints exist", () => {
    const now = new Date("2026-06-15T12:00:00.000Z");
    const events: SearchEventRow[] = [];
    const cache: SearchCacheAnalyticsRow[] = [];
    for (let i = 0; i < 101; i++) {
      const fp = `fp-${i}`;
      events.push({
        fingerprint: fp,
        cache_hit: false,
        created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
      });
      cache.push({
        fingerprint: fp,
        term: `公司${i}`,
        match_type: "company_name",
        outcome: "user_only",
        matched_name: null,
      });
    }
    const result = aggregateSearchAnalytics(events, cache, now, 30);
    expect(result.terms).toHaveLength(100);
    expect(result.terms[0].term).toBe("公司100");
    expect(result.terms[99].term).toBe("公司1");
    expect(result.terms.some((t) => t.term === "公司0")).toBe(false);
    expect(result.views.all).toHaveLength(100);
    expect(result.views.all[0].term).toBe("公司100");
    expect(result.views.none).toHaveLength(100);
    expect(result.views.none[0].term).toBe("公司100");
    expect(result.views.none.some((t) => t.term === "公司0")).toBe(false);
  });

  it("limits term lists to 100 rows", () => {
    const now = new Date();
    const events: SearchEventRow[] = [];
    const cache: SearchCacheAnalyticsRow[] = [];
    for (let i = 0; i < 120; i++) {
      const fp = `fp-${i}`;
      events.push({
        fingerprint: fp,
        cache_hit: false,
        created_at: now.toISOString(),
      });
      cache.push({
        fingerprint: fp,
        term: `公司${i}`,
        match_type: "company_name",
        outcome: "match",
        matched_name: null,
      });
    }
    const result = aggregateSearchAnalytics(events, cache, now, 30);
    expect(result.terms).toHaveLength(100);
    expect(result.views.all).toHaveLength(100);
  });

  it("select string excludes sensitive query fields", () => {
    expect(SEARCH_CACHE_ANALYTICS_SELECT).not.toMatch(/phone|br|queryEcho|registrationNo/);
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const supabase = vi.hoisted(() => {
  const gte = vi.fn();
  const eq = vi.fn(() => ({ gte }));
  const select = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ select }));
  const getSupabaseAdmin = vi.fn(() => ({ from }));
  return { gte, eq, select, from, getSupabaseAdmin };
});

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => supabase.getSupabaseAdmin(),
  isSupabaseAdminConfigured: () => true,
}));

import { geminiCountingFetch, resetGeminiUsageForTests } from "@/lib/gemini-usage";
import { pacificDayStart } from "@/lib/gemini-usage";
import { resetServiceStatusForTests } from "@/lib/service-status";
import {
  buildGeminiUsageCard,
  fetchGeminiUsageCard,
  readGeminiLimitEnv,
} from "./gemini-usage-view";
import type { GeminiUsageSnapshot } from "@/lib/gemini-usage";

const NOW = new Date("2026-10-31T18:00:00.000Z");

function snapshot(overrides: Partial<GeminiUsageSnapshot> = {}): GeminiUsageSnapshot {
  return {
    instanceCalls: 1,
    counts24h: {
      ok: 1,
      rate_minute: 0,
      quota_day: 0,
      rate_other: 0,
      server_5xx: 0,
      client_4xx: 0,
      network: 0,
    },
    last429At: null,
    lastQuotaValue: null,
    records: [],
    ...overrides,
  };
}

describe("gemini usage view", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetGeminiUsageForTests();
    resetServiceStatusForTests();
    vi.spyOn(console, "warn").mockImplementation(() => {});
    supabase.gte.mockResolvedValue({ count: 7, error: null });
    supabase.getSupabaseAdmin.mockImplementation(() => ({ from: supabase.from }));
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    vi.restoreAllMocks();
    resetGeminiUsageForTests();
    resetServiceStatusForTests();
  });

  it("uses the max of uncached searches and instance calls, and warns on quota", () => {
    const quiet = buildGeminiUsageCard({
      now: NOW,
      snapshot: snapshot({ instanceCalls: 3 }),
      searchEventsUncachedToday: 7,
      providerLabel: "google/gemini-3.5-flash",
      providerKind: "google",
      rpdLimit: null,
      rpmLimit: null,
    });
    expect(quiet.usedToday).toBe(7);
    expect(quiet.warning).toBe(false);
    expect(quiet.rpdLimit).toBeNull();

    const day = buildGeminiUsageCard({
      now: NOW,
      snapshot: snapshot({
        instanceCalls: 4,
        lastQuotaValue: 20,
        counts24h: {
          ok: 0,
          rate_minute: 0,
          quota_day: 1,
          rate_other: 0,
          server_5xx: 0,
          client_4xx: 0,
          network: 0,
        },
      }),
      searchEventsUncachedToday: 1,
      providerLabel: "google/gemini-3.5-flash",
      providerKind: "google",
      rpdLimit: null,
      rpmLimit: null,
    });
    expect(day.usedToday).toBe(4);
    expect(day.warning).toBe(true);
    expect(day.rpdLimit).toBeNull();
    expect(day.lastQuotaValue).toBe(20);
  });

  it("warns at three per-minute hits in 24h and not at two", () => {
    const base = snapshot();
    const two = buildGeminiUsageCard({
      now: NOW,
      snapshot: snapshot({
        counts24h: { ...base.counts24h, rate_minute: 2 },
      }),
      searchEventsUncachedToday: 0,
      providerLabel: null,
      providerKind: null,
      rpdLimit: null,
      rpmLimit: null,
    });
    expect(two.warning).toBe(false);
    const three = buildGeminiUsageCard({
      now: NOW,
      snapshot: snapshot({
        counts24h: { ...base.counts24h, rate_minute: 3 },
      }),
      searchEventsUncachedToday: 0,
      providerLabel: null,
      providerKind: "gateway",
      rpdLimit: 4,
      rpmLimit: 2,
    });
    expect(three.warning).toBe(true);
    expect(three.providerKind).toBe("gateway");
    expect(three.rpdLimit).toBe(4);
  });

  it("reads only positive integer limits from env", () => {
    vi.stubEnv("GEMINI_RPD_LIMIT", "4");
    vi.stubEnv("GEMINI_RPM_LIMIT", "2");
    expect(readGeminiLimitEnv("GEMINI_RPD_LIMIT")).toBe(4);
    expect(readGeminiLimitEnv("GEMINI_RPM_LIMIT")).toBe(2);
    vi.stubEnv("GEMINI_RPD_LIMIT", "0");
    vi.stubEnv("GEMINI_RPM_LIMIT", "2.5");
    expect(readGeminiLimitEnv("GEMINI_RPD_LIMIT")).toBeNull();
    expect(readGeminiLimitEnv("GEMINI_RPM_LIMIT")).toBeNull();
    vi.stubEnv("GEMINI_RPD_LIMIT", "");
    expect(readGeminiLimitEnv("GEMINI_RPD_LIMIT")).toBeNull();
  });

  it("queries uncached search_events since Pacific midnight", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.invalid");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("OVERFLOW_CHECK_GEMINI", "");
    const card = await fetchGeminiUsageCard(NOW);
    expect(supabase.select).toHaveBeenCalledWith("id", { count: "exact", head: true });
    expect(supabase.eq).toHaveBeenCalledWith("cache_hit", false);
    expect(supabase.gte).toHaveBeenCalledWith(
      "created_at",
      pacificDayStart(NOW).toISOString(),
    );
    expect(card.ok).toBe(true);
    if (card.ok) expect(card.data.usedToday).toBe(7);
  });

  it("does not turn a failed count into 0", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.invalid");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("OVERFLOW_CHECK_GEMINI", "");
    supabase.gte.mockResolvedValue({ count: null, error: { code: "xx" } });
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 200 })),
    );
    await geminiCountingFetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent",
    );
    const card = await fetchGeminiUsageCard(NOW);
    expect(card.ok).toBe(true);
    if (card.ok) expect(card.data.usedToday).toBe(1);
  });

  it("ignores the overflow fixture in production and still reads the database", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("OVERFLOW_CHECK_GEMINI", "1");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.invalid");
    vi.stubEnv("SUPABASE_URL", "");
    const card = await fetchGeminiUsageCard(NOW);
    expect(supabase.from).toHaveBeenCalledWith("search_events");
    expect(card.ok).toBe(true);
    if (card.ok) {
      expect(card.data.usedToday).toBe(7);
      expect(card.data.warning).toBe(false);
      expect(card.data.quotaDay).toBe(0);
    }
  });

  it("uses the in-memory fixture outside production and skips the database", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("OVERFLOW_CHECK_GEMINI", "1");
    const card = await fetchGeminiUsageCard(NOW);
    expect(supabase.from).not.toHaveBeenCalled();
    expect(card.ok).toBe(true);
    if (card.ok) {
      expect(card.data.warning).toBe(true);
      expect(card.data.quotaDay).toBe(1);
      expect(card.data.usedToday).toBe(1);
      expect(card.data.rpdLimit).toBeNull();
    }
  });
});

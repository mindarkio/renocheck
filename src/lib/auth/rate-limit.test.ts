import { createHash, createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const maybeSingle = vi.hoisted(() => vi.fn());
const deleteEq = vi.hoisted(() =>
  vi.fn(async (column: string, value: string) => {
    if (column !== "bucket" || !/^[0-9a-f]{64}$/.test(value)) {
      return { error: { message: "bad" } };
    }
    return { error: null };
  }),
);
const getSupabaseAdmin = vi.hoisted(() =>
  vi.fn((): { rpc: typeof rpc; from: (table: string) => unknown } | null => ({
    rpc,
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle }),
        order: () => ({
          limit: () => ({ maybeSingle }),
        }),
      }),
      delete: () => ({
        eq: (column: string, value: string) => deleteEq(column, value),
      }),
    }),
  })),
);

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin,
}));

import {
  AUTH_RATE_LIMIT_MAX_ROWS,
  AUTH_RATE_LIMIT_SECRET_MIN_LENGTH,
  authRateLimitBucket,
  takeAuthRateLimit,
} from "@/lib/auth/rate-limit";

const migration = readFileSync(
  "supabase/migrations/20261023220000_quote_analysis.sql",
  "utf8",
);
const rollback = readFileSync(
  "supabase/rollbacks/20261023220000_quote_analysis.down.sql",
  "utf8",
);

const SECRET = "synthetic-auth-rate-limit-secret-value";

describe("takeAuthRateLimit", () => {
  beforeEach(() => {
    vi.stubEnv("AUTH_RATE_LIMIT_SECRET", SECRET);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://local.example.invalid");
  });

  afterEach(() => {
    rpc.mockReset();
    maybeSingle.mockReset();
    deleteEq.mockReset();
    deleteEq.mockResolvedValue({ error: null });
    getSupabaseAdmin.mockReset();
    getSupabaseAdmin.mockImplementation(() => ({
      rpc,
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle }),
          order: () => ({
            limit: () => ({ maybeSingle }),
          }),
        }),
        delete: () => ({
          eq: (column: string, value: string) => deleteEq(column, value),
        }),
      }),
    }));
    vi.unstubAllEnvs();
  });

  it("stores an HMAC and the hard row cap, never the address", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const email = "person@example.com";
    const key = `otp-email:${email}`;
    expect(await takeAuthRateLimit({ key, limit: 3, windowMs: 900_000 })).toBe("ok");
    const args = rpc.mock.calls[0]?.[1] as {
      p_bucket: string;
      p_limit: number;
      p_window_seconds: number;
      p_max_rows: number;
    };
    expect(rpc.mock.calls[0]?.[0]).toBe("take_auth_rate_limit");
    expect(args.p_bucket).toBe(authRateLimitBucket(key, SECRET));
    expect(args.p_bucket).toBe(createHmac("sha256", SECRET).update(key).digest("hex"));
    expect(args.p_bucket).not.toBe(createHash("sha256").update(key).digest("hex"));
    expect(args.p_bucket).not.toContain(email);
    expect(args.p_bucket).toMatch(/^[0-9a-f]{64}$/);
    expect(args.p_limit).toBe(3);
    expect(args.p_window_seconds).toBe(900);
    expect(args.p_max_rows).toBe(AUTH_RATE_LIMIT_MAX_ROWS);
    expect(args.p_max_rows).toBe(5_000);
    expect(maybeSingle).not.toHaveBeenCalled();

    vi.stubEnv("AUTH_RATE_LIMIT_SECRET", `${SECRET}-other`);
    expect(await takeAuthRateLimit({ key, limit: 3, windowMs: 900_000 })).toBe("ok");
    const rotated = rpc.mock.calls[1]?.[1] as { p_bucket: string };
    expect(rotated.p_bucket).not.toBe(args.p_bucket);
    expect(rotated.p_bucket).not.toContain(email);
  });

  it("fails closed when the secret is missing or too short", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    vi.stubEnv("AUTH_RATE_LIMIT_SECRET", "");
    expect(await takeAuthRateLimit({ key: "otp-ip:203.0.113.9", limit: 5, windowMs: 1_000 })).toBe(
      "unavailable",
    );
    vi.stubEnv("AUTH_RATE_LIMIT_SECRET", "a".repeat(AUTH_RATE_LIMIT_SECRET_MIN_LENGTH - 1));
    expect(await takeAuthRateLimit({ key: "otp-ip:203.0.113.9", limit: 5, windowMs: 1_000 })).toBe(
      "unavailable",
    );
    expect(rpc).not.toHaveBeenCalled();
  });

  it("fails closed when the database refuses or is the production project", async () => {
    maybeSingle.mockResolvedValueOnce({ data: { hit_count: 5 }, error: null });
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await takeAuthRateLimit({ key: "otp-ip:203.0.113.9", limit: 5, windowMs: 1_000 })).toBe(
      "limited",
    );
    expect(deleteEq).not.toHaveBeenCalled();
    rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    expect(await takeAuthRateLimit({ key: "otp-ip:203.0.113.9", limit: 5, windowMs: 1_000 })).toBe(
      "unavailable",
    );
    getSupabaseAdmin.mockReturnValueOnce(null);
    expect(await takeAuthRateLimit({ key: "otp-ip:203.0.113.9", limit: 5, windowMs: 1_000 })).toBe(
      "unavailable",
    );
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://lvrasvtilgzwtfsfjbzd.supabase.co");
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(await takeAuthRateLimit({ key: "otp-ip:203.0.113.9", limit: 5, windowMs: 1_000 })).toBe(
      "unavailable",
    );
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("still limits an identity that has used its allowance when the table is full", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    maybeSingle.mockResolvedValueOnce({ data: { hit_count: 5 }, error: null });
    expect(await takeAuthRateLimit({ key: "otp-email:person@example.com", limit: 5, windowMs: 1_000 })).toBe(
      "limited",
    );
    expect(deleteEq).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it("admits a new identity when the table is full by freeing one soon-to-expire row", async () => {
    const victim = "ab".repeat(32);
    rpc.mockResolvedValueOnce({ data: false, error: null });
    rpc.mockResolvedValueOnce({ data: true, error: null });
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    maybeSingle.mockResolvedValueOnce({ data: { bucket: victim }, error: null });
    expect(await takeAuthRateLimit({ key: "otp-ip:203.0.113.10", limit: 5, windowMs: 1_000 })).toBe(
      "ok",
    );
    expect(deleteEq).toHaveBeenCalledWith("bucket", victim);
    expect(rpc).toHaveBeenCalledTimes(2);
    const first = rpc.mock.calls[0]?.[1] as { p_bucket: string };
    const second = rpc.mock.calls[1]?.[1] as { p_bucket: string };
    expect(second.p_bucket).toBe(first.p_bucket);
    expect(first.p_bucket).not.toContain("203.0.113.10");
  });

  it("does not lock everyone out when a full table cannot free a slot", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "read failed" } });
    expect(await takeAuthRateLimit({ key: "otp-ip:203.0.113.11", limit: 5, windowMs: 1_000 })).toBe(
      "ok",
    );
    expect(deleteEq).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);

    rpc.mockClear();
    maybeSingle.mockReset();
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    maybeSingle.mockResolvedValueOnce({ data: { bucket: "cd".repeat(32) }, error: null });
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    deleteEq.mockResolvedValueOnce({ error: null });
    expect(await takeAuthRateLimit({ key: "otp-ip:203.0.113.12", limit: 5, windowMs: 1_000 })).toBe(
      "ok",
    );
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("stays limited when the freed slot is already this identity's spent allowance", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    maybeSingle.mockResolvedValueOnce({ data: { bucket: "ab".repeat(32) }, error: null });
    maybeSingle.mockResolvedValueOnce({ data: { hit_count: 5 }, error: null });
    expect(await takeAuthRateLimit({ key: "otp-ip:203.0.113.15", limit: 5, windowMs: 1_000 })).toBe(
      "limited",
    );
    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it("fails closed when the retry after freeing a slot errors", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    maybeSingle.mockResolvedValueOnce({ data: { bucket: "ef".repeat(32) }, error: null });
    expect(await takeAuthRateLimit({ key: "otp-ip:203.0.113.16", limit: 5, windowMs: 1_000 })).toBe(
      "unavailable",
    );
  });

  it("does not delete this identity's own row when it is still under the allowance", async () => {
    const own = authRateLimitBucket("otp-ip:203.0.113.13", SECRET);
    rpc.mockResolvedValue({ data: false, error: null });
    maybeSingle.mockResolvedValueOnce({ data: { hit_count: 1 }, error: null });
    expect(await takeAuthRateLimit({ key: "otp-ip:203.0.113.13", limit: 5, windowMs: 1_000 })).toBe(
      "ok",
    );
    expect(deleteEq).not.toHaveBeenCalled();
    expect(own).toMatch(/^[0-9a-f]{64}$/);
  });

  it("fails closed when the allowance lookup errors", async () => {
    rpc.mockResolvedValueOnce({ data: false, error: null });
    maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    expect(await takeAuthRateLimit({ key: "otp-ip:203.0.113.14", limit: 5, windowMs: 1_000 })).toBe(
      "unavailable",
    );
    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("rejects bad input and non-boolean replies without trusting them", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    for (const bad of [
      { key: "", limit: 5, windowMs: 1_000 },
      { key: "k", limit: 0, windowMs: 1_000 },
      { key: "k", limit: 5, windowMs: 0 },
    ]) {
      expect(await takeAuthRateLimit(bad)).toBe("unavailable");
    }
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValueOnce({ data: "true", error: null });
    expect(await takeAuthRateLimit({ key: "k", limit: 5, windowMs: 1_000 })).toBe("unavailable");
  });
});

describe("auth rate limit migration", () => {
  it("is service-role only, with RLS and a hard cap of 5000", () => {
    const start = migration.indexOf("create table public.auth_otp_rate_limits");
    const fn = migration.indexOf("create or replace function public.take_auth_rate_limit");
    expect(start).toBeGreaterThan(0);
    expect(fn).toBeGreaterThan(start);
    const section = migration.slice(start);
    expect(section).toContain("enable row level security");
    expect(section).toContain(
      "revoke all on table public.auth_otp_rate_limits from public, anon, authenticated",
    );
    expect(section).not.toMatch(/grant\s+\w[\w\s,]*\s+on table public\.auth_otp_rate_limits to anon/i);
    expect(section).not.toMatch(/create policy[\s\S]*auth_otp_rate_limits/i);
    expect(section).toContain("security invoker");
    expect(section).toContain("set search_path = ''");
    expect(section).toContain("pg_catalog.least(p_max_rows, 5000)");
    expect(section).toContain(
      "revoke all on function public.take_auth_rate_limit(text, integer, integer, integer)\n  from public, anon, authenticated",
    );
    expect(section).toContain(
      "grant execute on function public.take_auth_rate_limit(text, integer, integer, integer)\n  to service_role",
    );
    expect(section).not.toMatch(/\bemail\s+text\b/i);
    expect(rollback).toContain(
      "drop function if exists public.take_auth_rate_limit(text, integer, integer, integer)",
    );
    expect(rollback).toContain("drop table if exists public.auth_otp_rate_limits");
  });
});

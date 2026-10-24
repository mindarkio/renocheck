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
  rateLimitIp,
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

describe("rateLimitIp", () => {
  it("keeps IPv4 and IPv4-mapped IPv6 per address", () => {
    expect(rateLimitIp("203.0.113.9")).toBe("203.0.113.9");
    expect(rateLimitIp(" ::FFFF:203.0.113.9 ")).toBe("203.0.113.9");
    expect(rateLimitIp("unknown")).toBe("unknown");
  });

  it("groups IPv6 by /64 whatever the spelling", () => {
    const net = "2001:0db8:0001:0002::/64";
    expect(rateLimitIp("2001:db8:1:2::1")).toBe(net);
    expect(rateLimitIp("2001:DB8:1:2:aaaa:bbbb:cccc:dddd")).toBe(net);
    expect(rateLimitIp("[2001:db8:1:2::ffff]")).toBe(net);
    expect(rateLimitIp("2001:db8:1:2::1%eth0")).toBe(net);
    expect(rateLimitIp("2001:db8:1:3::1")).toBe("2001:0db8:0001:0003::/64");
    expect(rateLimitIp("2001:db8::1")).toBe("2001:0db8:0000:0000::/64");
    expect(rateLimitIp("::1")).toBe("0000:0000:0000:0000::/64");
  });

  it("leaves malformed addresses unchanged rather than merging them", () => {
    for (const raw of [
      "1::2::3",
      "2001:db8:1:2:3:4:5:6:7",
      "2001:db8:1:2:3:4:5",
      "2001:db8::zz",
      "1:2:3:4:5:6:7:8::",
    ]) {
      expect(rateLimitIp(raw)).toBe(raw);
    }
  });
});

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

  it("fails closed when the table is full and never evicts or re-reads rows", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    for (const key of ["otp-ip:203.0.113.10", "otp-email:new@example.com"]) {
      expect(await takeAuthRateLimit({ key, limit: 5, windowMs: 1_000 })).toBe("limited");
    }
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(maybeSingle).not.toHaveBeenCalled();
    expect(deleteEq).not.toHaveBeenCalled();
  });

  it("accepts a secret of exactly the minimum length", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    vi.stubEnv("AUTH_RATE_LIMIT_SECRET", ` ${"a".repeat(AUTH_RATE_LIMIT_SECRET_MIN_LENGTH)} `);
    expect(await takeAuthRateLimit({ key: "otp-ip:203.0.113.9", limit: 5, windowMs: 1_000 })).toBe(
      "ok",
    );
    const args = rpc.mock.calls[0]?.[1] as { p_bucket: string };
    expect(args.p_bucket).toBe(
      authRateLimitBucket("otp-ip:203.0.113.9", "a".repeat(AUTH_RATE_LIMIT_SECRET_MIN_LENGTH)),
    );
    vi.stubEnv("AUTH_RATE_LIMIT_SECRET", ` ${"a".repeat(AUTH_RATE_LIMIT_SECRET_MIN_LENGTH - 1)} `);
    expect(await takeAuthRateLimit({ key: "otp-ip:203.0.113.9", limit: 5, windowMs: 1_000 })).toBe(
      "unavailable",
    );
    expect(rpc).toHaveBeenCalledTimes(1);
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

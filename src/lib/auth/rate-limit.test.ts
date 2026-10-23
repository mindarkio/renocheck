import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());
const getSupabaseAdmin = vi.hoisted(() =>
  vi.fn((): { rpc: typeof rpc } | null => ({ rpc })),
);

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin,
}));

import { AUTH_RATE_LIMIT_MAX_ROWS, takeAuthRateLimit } from "@/lib/auth/rate-limit";

const migration = readFileSync(
  "supabase/migrations/20261023220000_quote_analysis.sql",
  "utf8",
);
const rollback = readFileSync(
  "supabase/rollbacks/20261023220000_quote_analysis.down.sql",
  "utf8",
);

describe("takeAuthRateLimit", () => {
  afterEach(() => {
    rpc.mockReset();
    getSupabaseAdmin.mockReset();
    getSupabaseAdmin.mockImplementation(() => ({ rpc }));
    vi.unstubAllEnvs();
  });

  it("stores a hash and the hard row cap, never the address", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://local.example.invalid");
    rpc.mockResolvedValue({ data: true, error: null });
    const email = "person@example.com";
    expect(await takeAuthRateLimit({ key: `otp-email:${email}`, limit: 3, windowMs: 900_000 })).toBe(
      "ok",
    );
    const args = rpc.mock.calls[0]?.[1] as {
      p_bucket: string;
      p_limit: number;
      p_window_seconds: number;
      p_max_rows: number;
    };
    expect(rpc.mock.calls[0]?.[0]).toBe("take_auth_rate_limit");
    expect(args.p_bucket).toBe(createHash("sha256").update(`otp-email:${email}`).digest("hex"));
    expect(args.p_bucket).not.toContain(email);
    expect(args.p_limit).toBe(3);
    expect(args.p_window_seconds).toBe(900);
    expect(args.p_max_rows).toBe(AUTH_RATE_LIMIT_MAX_ROWS);
    expect(args.p_max_rows).toBe(5_000);
  });

  it("fails closed when the database refuses or is the production project", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://local.example.invalid");
    rpc.mockResolvedValueOnce({ data: false, error: null });
    expect(await takeAuthRateLimit({ key: "otp-ip:203.0.113.9", limit: 5, windowMs: 1_000 })).toBe(
      "limited",
    );
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

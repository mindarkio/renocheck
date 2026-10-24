import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { admin } = vi.hoisted(() => {
  const rpc = vi.fn();
  const getSupabaseAdmin = vi.fn(() => ({ rpc }));
  return { admin: { rpc, getSupabaseAdmin } };
});

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => admin.getSupabaseAdmin(),
  isSupabaseAdminConfigured: () => true,
}));

import { GET } from "./route";

const USER = "12345678-1234-4234-8234-123456789abc";

function authed(secret = "cron-test-secret") {
  return new Request("http://localhost/api/cron/purge-quote-analysis", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/purge-quote-analysis", () => {
  beforeEach(() => {
    vi.stubEnv("CRON_SECRET", "cron-test-secret");
    vi.stubEnv("VERCEL_ENV", "test");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_URL", "");
    admin.rpc.mockReset();
    admin.rpc.mockResolvedValue({
      data: [{ analyses_deleted: 3, claims_deleted: "2", spend_rows_deleted: 1 }],
      error: null,
    });
    admin.getSupabaseAdmin.mockClear();
    vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("calls the purge function and logs counts only", async () => {
    const res = await GET(authed());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      analysesDeleted: 3,
      claimsDeleted: 2,
      spendRowsDeleted: 1,
      pending: false,
    });
    expect(admin.rpc).toHaveBeenCalledWith("purge_quote_analysis_retention");
    const logged = JSON.stringify(vi.mocked(console.info).mock.calls);
    expect(logged).toContain('\\"analysesDeleted\\":3');
    expect(logged).toContain('\\"spendRowsDeleted\\":1');
    expect(logged).not.toContain(USER);
  });

  it("returns 200 with pending when the function is not migrated yet", async () => {
    admin.rpc.mockResolvedValue({
      data: null,
      error: {
        code: "PGRST202",
        message:
          "Could not find the function public.purge_quote_analysis_retention without parameters in the schema cache",
      },
    });
    const res = await GET(authed());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      analysesDeleted: 0,
      claimsDeleted: 0,
      spendRowsDeleted: 0,
      pending: true,
    });
  });

  it("treats permission or inner-function errors as failures, not pending", async () => {
    for (const error of [
      { code: "42501", message: "permission denied for function purge_quote_analysis_retention" },
      { code: "42883", message: "function pg_catalog.timezone(text, integer) does not exist" },
      { message: "purge_quote_analysis_retention failed" },
      { code: "XX000", message: "function public.purge_quote_analysis_retention() does not exist" },
    ]) {
      admin.rpc.mockResolvedValueOnce({ data: null, error });
      expect((await GET(authed())).status).toBe(503);
    }
    admin.rpc.mockResolvedValueOnce({
      data: null,
      error: { code: "42883", message: "function public.purge_quote_analysis_retention() does not exist" },
    });
    expect(await (await GET(authed())).json()).toMatchObject({ ok: true, pending: true });
  });

  it("keeps the pending check narrow against near-miss function errors", async () => {
    admin.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: "42883",
        message: "FUNCTION PUBLIC.PURGE_QUOTE_ANALYSIS_RETENTION() DOES NOT EXIST",
      },
    });
    expect(await (await GET(authed())).json()).toMatchObject({ ok: true, pending: true });

    for (const message of [
      "function purge_quote_analysis_retention() does not exist",
      "function public.purge_quote_analysis_retention does not exist",
      "function publicXpurge_quote_analysis_retention() does not exist",
      "function public.purge_quote_analysis_retention() is missing",
    ]) {
      admin.rpc.mockResolvedValueOnce({ data: null, error: { code: "42883", message } });
      expect((await GET(authed())).status).toBe(503);
    }
  });

  it("returns 503 when the purge fails for another reason", async () => {
    admin.rpc.mockResolvedValue({
      data: null,
      error: { code: "23502", message: "null value in column violates not-null constraint" },
    });
    const res = await GET(authed());
    expect(res.status).toBe(503);
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).toContain("purge_failed");
  });

  it("returns 503 without a secret and 401 for a bad secret, before any DB call", async () => {
    vi.stubEnv("CRON_SECRET", "");
    expect((await GET(authed("nope"))).status).toBe(503);
    vi.stubEnv("CRON_SECRET", "cron-test-secret");
    expect((await GET(authed("wrong-secret-value"))).status).toBe(401);
    expect((await GET(authed("cron-test-secreX"))).status).toBe(401);
    expect(
      (await GET(new Request("http://localhost/api/cron/purge-quote-analysis"))).status,
    ).toBe(401);
    expect(admin.getSupabaseAdmin).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("refuses the prod database outside production", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://lvrasvtilgzwtfsfjbzd.supabase.co");
    vi.stubEnv("VERCEL_ENV", "preview");
    const res = await GET(authed());
    expect(res.status).toBe(503);
    expect(admin.rpc).not.toHaveBeenCalled();
  });
});

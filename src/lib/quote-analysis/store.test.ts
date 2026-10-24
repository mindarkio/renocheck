import { afterEach, describe, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({ rpc }),
}));

import { supabaseQuoteStore } from "@/lib/quote-analysis/store";

describe("supabaseQuoteStore.begin", () => {
  afterEach(() => {
    rpc.mockReset();
    vi.unstubAllEnvs();
  });

  it("passes the total cap, the free cap and the call cap to the locked SQL check", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://local.example.invalid");
    rpc.mockResolvedValue({ data: { ok: true, claim_id: "c1" }, error: null });
    const result = await supabaseQuoteStore.begin({
      userId: "u1",
      reserveMicroUsd: 4_530,
      dailyLimit: 3,
      capMicroUsd: 1_000_000,
      freeCapMicroUsd: 800_000,
      callCap: 300,
    });
    expect(result).toEqual({ ok: true, claimId: "c1" });
    expect(rpc).toHaveBeenCalledWith("begin_quote_analysis", {
      p_user_id: "u1",
      p_reserve: 4_530,
      p_daily_limit: 3,
      p_cap_micro: 1_000_000,
      p_free_cap_micro: 800_000,
      p_call_cap: 300,
    });
  });

  it("fails closed on errors and unknown rows", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://local.example.invalid");
    const input = {
      userId: "u1",
      reserveMicroUsd: 1,
      dailyLimit: 3,
      capMicroUsd: 1,
      freeCapMicroUsd: 1,
      callCap: 1,
    };
    rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } });
    expect(await supabaseQuoteStore.begin(input)).toEqual({ ok: false, reason: "unavailable" });
    rpc.mockResolvedValueOnce({ data: { ok: false, reason: "budget" }, error: null });
    expect(await supabaseQuoteStore.begin(input)).toEqual({ ok: false, reason: "budget" });
    rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    expect(await supabaseQuoteStore.begin(input)).toEqual({ ok: false, reason: "unavailable" });
  });
});

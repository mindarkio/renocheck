import { beforeEach, describe, expect, it, vi } from "vitest";

const reads = vi.hoisted(() => ({ n: 0 }));
vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            reads.n += 1;
            return { data: { spent_micro_usd: 0, reserved_micro_usd: 0, calls: 0 }, error: null };
          },
        }),
      }),
    }),
  }),
}));

import { isQuoteUploadOpen, resetQuoteAvailabilityCacheForTests } from "./availability";

const env = {
  QUOTE_ANALYSIS_ENABLED: "1",
  AZURE_OPENAI_ENDPOINT: "https://quote.example.invalid",
  AZURE_OPENAI_API_KEY: "test-not-a-key",
  AZURE_OPENAI_DEPLOYMENT: "quote-dep",
};

describe("isQuoteUploadOpen budget cache", () => {
  beforeEach(() => {
    reads.n = 0;
    resetQuoteAvailabilityCacheForTests();
  });

  it("reads the spend row at most once per 45 seconds", async () => {
    const t0 = 1_700_000_000_000;
    expect(await isQuoteUploadOpen(env, t0)).toBe(true);
    expect(await isQuoteUploadOpen(env, t0 + 44_999)).toBe(true);
    expect(reads.n).toBe(1);
    await isQuoteUploadOpen(env, t0 + 45_000);
    expect(reads.n).toBe(2);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  admin: true,
  row: null as null | { spent_micro_usd: number; reserved_micro_usd: number; calls: number },
}));

vi.mock("next/server", async () => {
  const actual = await vi.importActual<typeof import("next/server")>("next/server");
  return { ...actual, connection: vi.fn(async () => {}) };
});

vi.mock("@/lib/supabase/admin", () => ({
  getSupabaseAdmin: () =>
    state.admin
      ? {
          from: () => ({
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: state.row, error: null }),
              }),
            }),
          }),
        }
      : null,
}));

import { GET } from "./route";

function enableAzure() {
  vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "1");
  vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://quote.example.invalid");
  vi.stubEnv("AZURE_OPENAI_API_KEY", "test-not-a-key");
  vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "quote-dep");
}

describe("GET /api/quote/availability", () => {
  afterEach(() => {
    state.admin = true;
    state.row = null;
    vi.unstubAllEnvs();
  });

  it("is closed when the flag is off", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "0");
    const res = await GET();
    expect(await res.json()).toEqual({ enabled: false });
  });

  it("is open when configured and the daily budget still has room", async () => {
    enableAzure();
    state.row = { spent_micro_usd: 0, reserved_micro_usd: 0, calls: 0 };
    const res = await GET();
    expect(await res.json()).toEqual({ enabled: true });
  });

  it("is closed when the shared daily budget is full", async () => {
    enableAzure();
    state.row = { spent_micro_usd: 800_000, reserved_micro_usd: 0, calls: 0 };
    const res = await GET();
    expect(await res.json()).toEqual({ enabled: false });
  });
});

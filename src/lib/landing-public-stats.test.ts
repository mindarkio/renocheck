import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: never[]) => unknown>(fn: T) => fn,
}));

import {
  formatMwcRegistryUpdatedAt,
  getLandingPublicStats,
} from "./landing-public-stats";

describe("formatMwcRegistryUpdatedAt", () => {
  it("formats ISO date in zh-HK", () => {
    const label = formatMwcRegistryUpdatedAt("2026-01-15T00:00:00.000Z");
    expect(label).toMatch(/2026/);
    expect(label.length).toBeGreaterThan(4);
  });
});

describe("getLandingPublicStats overflow-check fixture", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns synthetic stats only outside production", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_URL", "");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "");
    vi.stubEnv("OVERFLOW_CHECK_STATS", "1");
    vi.stubEnv("NODE_ENV", "development");
    expect((await getLandingPublicStats())?.mwcContractorCount).toBeGreaterThan(0);
    vi.stubEnv("NODE_ENV", "production");
    expect(await getLandingPublicStats()).toBeNull();
  });
});

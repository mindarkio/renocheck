import { afterEach, describe, expect, it, vi } from "vitest";
import { getSiteUrl, PRODUCTION_SITE_URL } from "./site-url";

afterEach(() => vi.unstubAllEnvs());

describe("getSiteUrl", () => {
  it("uses NEXT_PUBLIC_SITE_URL without trailing slash", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://renocheck.homes/");
    expect(getSiteUrl()).toBe("https://renocheck.homes");
  });
  it("ignores VERCEL_URL and defaults to apex in production", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL_URL", "renocheck-abc-mindarkio.vercel.app");
    expect(getSiteUrl()).toBe(PRODUCTION_SITE_URL);
  });
});

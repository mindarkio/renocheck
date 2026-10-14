import { afterEach, describe, expect, it } from "vitest";
import { resolveWebSearchProvider } from "./search-provider";

const env = process.env;

describe("resolveWebSearchProvider", () => {
  afterEach(() => {
    process.env = { ...env };
  });

  it("prefers Serper when both keys are set", () => {
    process.env.SERPER_API_KEY = "serper-test";
    process.env.SERPAPI_KEY = "serpapi-test";
    delete process.env.SERP_PROVIDER;
    expect(resolveWebSearchProvider()).toBe("serper");
  });

  it("honours SERP_PROVIDER=serpapi", () => {
    process.env.SERPER_API_KEY = "serper-test";
    process.env.SERPAPI_KEY = "serpapi-test";
    process.env.SERP_PROVIDER = "serpapi";
    expect(resolveWebSearchProvider()).toBe("serpapi");
  });

  it("returns null when no keys", () => {
    delete process.env.SERPER_API_KEY;
    delete process.env.SERPAPI_KEY;
    expect(resolveWebSearchProvider()).toBeNull();
  });
});

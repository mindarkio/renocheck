import { afterEach, describe, expect, it, vi } from "vitest";

const createGoogleGenerativeAI = vi.hoisted(() =>
  vi.fn(() => vi.fn(() => ({ id: "model" }))),
);

vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI,
}));

vi.mock("@ai-sdk/gateway", () => ({
  gateway: vi.fn(() => ({ id: "gateway" })),
}));

import { geminiCountingFetch } from "./gemini-usage";
import { llmProviderKind, resolveRiskReportModel } from "./llm-model";

describe("resolveRiskReportModel fetch", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("passes the counting fetch to the Google provider", () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "test-key-not-real");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_KEY", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "");
    resolveRiskReportModel();
    const calls = createGoogleGenerativeAI.mock.calls as unknown as Array<
      [{ fetch?: unknown }]
    >;
    expect(calls[0]?.[0]?.fetch).toBe(geminiCountingFetch);
    expect(llmProviderKind()).toBe("google");
  });

  it("leaves the gateway branch without the Gemini fetch", () => {
    vi.stubEnv("GOOGLE_GENERATIVE_AI_API_KEY", "");
    vi.stubEnv("GOOGLE_GENERATIVE_AI_KEY", "");
    vi.stubEnv("AI_GATEWAY_API_KEY", "gateway-test-not-a-gemini-key");
    resolveRiskReportModel();
    expect(createGoogleGenerativeAI).not.toHaveBeenCalled();
    expect(llmProviderKind()).toBe("gateway");
  });
});

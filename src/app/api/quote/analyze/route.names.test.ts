import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetMemoryRateLimitForTests } from "@/lib/memory-rate-limit";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  completeQuotePdf: vi.fn(),
  begin: vi.fn(),
  finish: vi.fn(),
  saveNames: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getAuthUser: () => mocks.getAuthUser() }));
vi.mock("@/lib/quote-analysis/provider", () => ({
  completeQuotePdf: (bytes: Uint8Array) => mocks.completeQuotePdf(bytes),
  extractQuoteCompanyName: vi.fn(),
}));
vi.mock("@/lib/quote-analysis/store", () => ({
  supabaseQuoteStore: {
    begin: (input: unknown) => mocks.begin(input),
    finish: (input: unknown) => mocks.finish(input),
  },
}));
vi.mock("@/lib/quote-analysis/company-names", () => ({
  saveQuoteCompanyNames: (input: unknown) => mocks.saveNames(input),
}));

import { POST } from "./route";

const USER = "11111111-1111-4111-8111-111111111111";
const ANALYSIS = "22222222-2222-4222-8222-222222222222";
const SERVER_NAME = "合成甲工程有限公司";

function request(fields: Record<string, string>) {
  const form = new FormData();
  form.set("acknowledged", "1");
  form.set("file", new File([new TextEncoder().encode("%PDF-1.4\n/Type /Page\n")], "b.pdf", { type: "application/pdf" }));
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new Request("http://localhost/api/quote/analyze", {
    method: "POST",
    headers: { origin: "http://localhost", "x-forwarded-for": "203.0.113.77" },
    body: form,
  });
}

describe("POST /api/quote/analyze company names", () => {
  beforeEach(() => {
    resetMemoryRateLimitForTests();
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "1");
    vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://quote.example.invalid");
    vi.stubEnv("AZURE_OPENAI_API_KEY", "test-not-a-key");
    vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "quote-dep");
    mocks.getAuthUser.mockResolvedValue({ id: USER, email: "person@example.com" });
    mocks.begin.mockResolvedValue({ ok: true, claimId: ANALYSIS });
    mocks.finish.mockResolvedValue({ analysisId: ANALYSIS });
    mocks.saveNames.mockReset();
    mocks.saveNames.mockResolvedValue("saved");
    mocks.completeQuotePdf.mockResolvedValue({
      object: { isQuotation: true, companyName: SERVER_NAME, items: [{ id: "waterproofing", status: "vague" }] },
      inputTokens: 100,
      outputTokens: 40,
    });
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("stores the server's reading of this PDF as extracted, never the client value", async () => {
    const res = await POST(request({ extractedCompanyName: "合成乙工程有限公司", confirmedCompanyName: "  合成乙工程有限公司  " }));
    expect(res.status).toBe(200);
    expect(mocks.saveNames).toHaveBeenCalledTimes(1);
    expect(mocks.saveNames).toHaveBeenCalledWith({
      analysisId: ANALYSIS,
      userId: USER,
      extracted: SERVER_NAME,
      confirmed: "合成乙工程有限公司",
    });
  });

  it("does not write a confirmed name the user never sent", async () => {
    await POST(request({}));
    expect(mocks.saveNames).toHaveBeenCalledWith({ analysisId: ANALYSIS, userId: USER, extracted: SERVER_NAME });
  });
});

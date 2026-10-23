import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QUOTE_CHECK_ITEMS } from "@/lib/quote-selfcheck";
import { resetMemoryRateLimitForTests } from "@/lib/memory-rate-limit";

const mocks = vi.hoisted(() => ({
  getAuthUser: vi.fn(),
  completeQuotePdf: vi.fn(),
  begin: vi.fn(),
  finish: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  getAuthUser: () => mocks.getAuthUser(),
}));

vi.mock("@/lib/quote-analysis/provider", () => ({
  completeQuotePdf: (bytes: Uint8Array) => mocks.completeQuotePdf(bytes),
}));

vi.mock("@/lib/quote-analysis/store", () => ({
  supabaseQuoteStore: {
    begin: (input: unknown) => mocks.begin(input),
    finish: (input: unknown) => mocks.finish(input),
  },
}));

import { POST } from "./route";

const USER = "11111111-1111-4111-8111-111111111111";
const ANALYSIS = "22222222-2222-4222-8222-222222222222";

function pdfFile(): File {
  const encoded = new TextEncoder().encode("%PDF-1.4\n/Type /Page\n");
  const copy = new Uint8Array(encoded.byteLength);
  copy.set(encoded);
  return new File([copy], "scan.pdf", { type: "application/pdf" });
}

function request(fields?: { acknowledged?: boolean; file?: boolean }) {
  const form = new FormData();
  if (fields?.acknowledged) form.set("acknowledged", "1");
  if (fields?.file !== false) {
    form.set("file", pdfFile());
  }
  return new Request("http://localhost/api/quote/analyze", {
    method: "POST",
    headers: {
      origin: "http://localhost",
      "x-forwarded-for": "203.0.113.40",
    },
    body: form,
  });
}

function enableAzure() {
  vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "1");
  vi.stubEnv("AZURE_OPENAI_ENDPOINT", "https://quote.example.invalid");
  vi.stubEnv("AZURE_OPENAI_API_KEY", "test-not-a-key");
  vi.stubEnv("AZURE_OPENAI_DEPLOYMENT", "quote-gpt-6-luna");
}

describe("POST /api/quote/analyze", () => {
  beforeEach(() => {
    resetMemoryRateLimitForTests();
    mocks.getAuthUser.mockReset();
    mocks.completeQuotePdf.mockReset();
    mocks.begin.mockReset();
    mocks.finish.mockReset();
    mocks.getAuthUser.mockResolvedValue({ id: USER, email: "person@example.com" });
    mocks.begin.mockResolvedValue({ ok: true, claimId: ANALYSIS });
    mocks.finish.mockResolvedValue({ analysisId: ANALYSIS });
    mocks.completeQuotePdf.mockResolvedValue({
      object: {
        isQuotation: true,
        items: [{ id: "waterproofing", status: "vague" }],
      },
      inputTokens: 100,
      outputTokens: 40,
    });
    enableAzure();
    vi.spyOn(globalThis, "fetch");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 503 when the flag is off and does not call Azure", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "0");
    const res = await POST(request({ acknowledged: true }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("quote_unavailable");
    expect(mocks.completeQuotePdf).not.toHaveBeenCalled();
    expect(mocks.begin).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("returns 503 when Azure env is missing", async () => {
    vi.stubEnv("AZURE_OPENAI_API_KEY", "");
    const res = await POST(request({ acknowledged: true }));
    expect(res.status).toBe(503);
    expect(mocks.completeQuotePdf).not.toHaveBeenCalled();
  });

  it("requires a signed-in account", async () => {
    mocks.getAuthUser.mockResolvedValue(null);
    const res = await POST(request({ acknowledged: true }));
    expect(res.status).toBe(401);
    expect((await res.json()).error).toBe("auth_required");
    expect(mocks.completeQuotePdf).not.toHaveBeenCalled();
  });

  it("requires the acknowledgement checkbox", async () => {
    const res = await POST(request({ acknowledged: false }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("acknowledgement_required");
    expect(body.message).toContain("遮好個人資料");
    expect(mocks.completeQuotePdf).not.toHaveBeenCalled();
    expect(mocks.begin).not.toHaveBeenCalled();
  });

  it("stops at the 2-a-day account limit before Azure", async () => {
    mocks.begin.mockResolvedValue({ ok: false, reason: "quota" });
    const res = await POST(request({ acknowledged: true }));
    expect(res.status).toBe(429);
    expect((await res.json()).message).toContain("今日免費分析次數已用完");
    expect(mocks.begin).toHaveBeenCalledWith(
      expect.objectContaining({ userId: USER, dailyLimit: 2 }),
    );
    expect(mocks.completeQuotePdf).not.toHaveBeenCalled();
  });

  it("stops when the daily budget breaker is closed", async () => {
    mocks.begin.mockResolvedValue({ ok: false, reason: "budget" });
    const res = await POST(request({ acknowledged: true }));
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error).toBe("quote_paused");
    expect(body.message).toContain("今日嘅報價分析名額已滿");
    expect(mocks.begin).toHaveBeenCalledWith(
      expect.objectContaining({ capMicroUsd: 2_000_000 }),
    );
    expect(mocks.completeQuotePdf).not.toHaveBeenCalled();
  });

  it("parses a mocked Azure result into Cantonese findings", async () => {
    const res = await POST(request({ acknowledged: true }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(ANALYSIS);
    expect(body.items).toHaveLength(QUOTE_CHECK_ITEMS.length);
    const waterproofing = body.items.find(
      (item: { id: string }) => item.id === "waterproofing",
    );
    expect(waterproofing.status).toBe("vague");
    expect(waterproofing.finding).toContain("寫得含糊");
    expect(body.items.some((item: { id: string }) => item.id === "arithmetic")).toBe(
      false,
    );
    const stored = mocks.finish.mock.calls[0]?.[0] as {
      items: Array<Record<string, unknown>>;
    };
    expect(stored.items.every((item) => Object.keys(item).sort().join() === "id,status")).toBe(
      true,
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});

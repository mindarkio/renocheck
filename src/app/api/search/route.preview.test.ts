import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildRegisterPreview: vi.fn(),
  runSearchPipeline: vi.fn(),
  isSupabaseAdminConfigured: vi.fn(() => true),
  checkRateLimit: vi.fn<(key: string, maxPerWindow?: number) => boolean>(() => true),
}));

vi.mock("@/lib/register-preview", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/register-preview")>();
  return {
    ...actual,
    buildRegisterPreview: mocks.buildRegisterPreview,
  };
});

vi.mock("@/lib/supabase/admin", () => ({
  isSupabaseAdminConfigured: () => mocks.isSupabaseAdminConfigured(),
  getSupabaseAdmin: () => ({ mocked: true }),
}));

vi.mock("@/lib/search-pipeline", () => ({
  runSearchPipeline: mocks.runSearchPipeline,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: (key: string, maxPerWindow?: number) => mocks.checkRateLimit(key, maxPerWindow),
  SEARCH_MAX_PER_WINDOW: 5,
}));

import { POST } from "./route";

function previewRequest(body: unknown) {
  return new Request("http://localhost/api/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function reportResult() {
  return {
    fingerprint: "abc",
    cacheHit: false,
    report: {
      reportVersion: "test",
      summaryZh: "公開資料有限。",
      signals: {
        themes: [],
        retrievalEvidence: [],
        actionableClauses: [],
        contractChecklist: ["有無書面合約？"],
      },
    },
    meta: { serpConfigured: false, webHitCount: 0 },
  };
}

describe("POST /api/search register preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSupabaseAdminConfigured.mockReturnValue(true);
    mocks.checkRateLimit.mockReturnValue(true);
  });

  it("returns public candidate fields and does not run a report", async () => {
    mocks.buildRegisterPreview.mockResolvedValue({
      matchCount: 2,
      windowFull: false,
      candidates: [
        {
          companyName: "合成設計",
          companyNameEn: null,
          registrationNo: "MWC(W) 1/2026",
          exact: true,
        },
      ],
    });
    const res = await POST(previewRequest({ preview: "register", companyName: "合成設計" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.candidates[0].registrationNo).toBe("MWC(W) 1/2026");
    expect(JSON.stringify(body)).not.toContain("phone");
    expect(mocks.runSearchPipeline).not.toHaveBeenCalled();
    expect(mocks.buildRegisterPreview).toHaveBeenCalledWith(
      expect.anything(),
      "合成設計",
    );
  });

  it("rejects a preview without a company name", async () => {
    const res = await POST(previewRequest({ preview: "register" }));
    expect(res.status).toBe(400);
    expect(mocks.buildRegisterPreview).not.toHaveBeenCalled();
    expect(mocks.runSearchPipeline).not.toHaveBeenCalled();
  });

  it("does not call the register when Supabase is not configured", async () => {
    mocks.isSupabaseAdminConfigured.mockReturnValue(false);
    const res = await POST(previewRequest({ preview: "register", companyName: "合成設計" }));
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "register_lookup_failed" });
    expect(mocks.buildRegisterPreview).not.toHaveBeenCalled();
  });

  it("rejects an unknown preview value instead of running a report", async () => {
    const res = await POST(previewRequest({ preview: "all", companyName: "合成設計" }));
    expect(res.status).toBe(400);
    expect(mocks.buildRegisterPreview).not.toHaveBeenCalled();
    expect(mocks.runSearchPipeline).not.toHaveBeenCalled();
  });

  it("limits a register preview on its own bucket and does not spend a search slot", async () => {
    mocks.buildRegisterPreview.mockResolvedValue({
      matchCount: 0,
      windowFull: false,
      candidates: [],
    });
    const preview = await POST(
      previewRequest({ preview: "register", companyName: "合成設計" }),
    );
    expect(preview.status).toBe(200);
    expect(mocks.checkRateLimit.mock.calls).toEqual([["register-preview:unknown", 5]]);

    mocks.checkRateLimit.mockClear();
    mocks.runSearchPipeline.mockResolvedValue(reportResult());
    const search = await POST(previewRequest({ companyName: "合成設計" }));
    expect(search.status).toBe(200);
    expect(mocks.checkRateLimit.mock.calls).toEqual([["unknown", undefined]]);
  });

  it("still allows a preview when the search bucket is full", async () => {
    mocks.checkRateLimit.mockImplementation((key) => key.startsWith("register-preview:"));
    mocks.buildRegisterPreview.mockResolvedValue({ matchCount: 0, windowFull: false, candidates: [] });
    const res = await POST(previewRequest({ preview: "register", companyName: "合成設計" }));
    expect(res.status).toBe(200);
  });

  it("charges a search slot when preview is null", async () => {
    mocks.checkRateLimit.mockImplementation((key) => key.startsWith("register-preview:"));
    const res = await POST(previewRequest({ preview: null, companyName: "合成設計" }));
    expect(res.status).toBe(429);
    expect(mocks.checkRateLimit.mock.calls).toEqual([["unknown", undefined]]);
    expect(mocks.runSearchPipeline).not.toHaveBeenCalled();
  });

  it("returns 429 when the preview bucket is full", async () => {
    mocks.checkRateLimit.mockImplementation((key) => !key.startsWith("register-preview:"));
    const res = await POST(previewRequest({ preview: "register", companyName: "合成設計" }));
    expect(res.status).toBe(429);
    expect(await res.json()).toEqual({ error: "rate_limited" });
    expect(mocks.buildRegisterPreview).not.toHaveBeenCalled();
  });

  it("charges a search slot for a body that is not JSON", async () => {
    mocks.checkRateLimit.mockReturnValue(false);
    const res = await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{",
      }),
    );
    expect(res.status).toBe(429);
    expect(mocks.checkRateLimit.mock.calls).toEqual([["unknown", undefined]]);
  });

  it("accepts a company name of exactly 100 characters", async () => {
    mocks.buildRegisterPreview.mockResolvedValue({ matchCount: 0, windowFull: false, candidates: [] });
    const res = await POST(
      previewRequest({ preview: "register", companyName: "合".repeat(100) }),
    );
    expect(res.status).toBe(200);
    expect(mocks.buildRegisterPreview).toHaveBeenCalledWith(expect.anything(), "合".repeat(100));
  });

  it("rejects a company name longer than 100 characters", async () => {
    const res = await POST(
      previewRequest({ preview: "register", companyName: "合".repeat(101) }),
    );
    expect(res.status).toBe(400);
    expect(mocks.buildRegisterPreview).not.toHaveBeenCalled();
  });

  it("refuses synthetic probe names in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    try {
      const res = await POST(previewRequest({ preview: "register", companyName: "ZZQ_合成設計" }));
      expect(res.status).toBe(400);
      expect(mocks.buildRegisterPreview).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllEnvs();
    }
  });
});

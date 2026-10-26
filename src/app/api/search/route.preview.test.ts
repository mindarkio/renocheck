import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  buildRegisterPreview: vi.fn(),
  runSearchPipeline: vi.fn(),
  isSupabaseAdminConfigured: vi.fn(() => true),
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
  checkRateLimit: () => true,
}));

import { POST } from "./route";

function previewRequest(body: unknown) {
  return new Request("http://localhost/api/search", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/search register preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isSupabaseAdminConfigured.mockReturnValue(true);
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
});

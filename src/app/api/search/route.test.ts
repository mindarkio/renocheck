import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  runSearchPipeline: vi.fn(),
}));

vi.mock("@/lib/search-pipeline", () => ({
  runSearchPipeline: mocks.runSearchPipeline,
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => true,
}));

import { SearchPipelineError } from "@/lib/search-pipeline-error";
import { POST } from "./route";

function request() {
  return new Request("http://localhost/api/search", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "192.0.2.40",
    },
    body: JSON.stringify({ companyName: "示例裝修有限公司" }),
  });
}

describe("POST /api/search service pause", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.runSearchPipeline.mockResolvedValue({
      fingerprint: "abc",
      cacheHit: false,
      report: { reportVersion: "test" },
      meta: { serpConfigured: true, webHitCount: 0 },
    });
  });

  it("returns 503 service_paused when the pipeline throws after a cache miss", async () => {
    mocks.runSearchPipeline.mockRejectedValue(
      new SearchPipelineError("service_paused"),
    );
    const res = await POST(request());
    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "service_paused" });
    expect(mocks.runSearchPipeline).toHaveBeenCalledTimes(1);
  });

  it("runs the pipeline when the service is not paused", async () => {
    const res = await POST(request());
    expect(res.status).toBe(200);
    expect(mocks.runSearchPipeline).toHaveBeenCalledTimes(1);
  });

  it("rejects ZZQ probe names in production before any pipeline write", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyName: "ZZQ_PROBE LIMITED" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_input" });
    expect(mocks.runSearchPipeline).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("rejects full-width ZZQ probe names in production too", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyName: "ＺＺＱ＿PROBE LIMITED" }),
      }),
    );
    expect(res.status).toBe(400);
    expect(mocks.runSearchPipeline).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("keeps ZZQ names working outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const res = await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyName: "ZZQ TESTING LIMITED" }),
      }),
    );
    expect(res.status).toBe(200);
    expect(mocks.runSearchPipeline).toHaveBeenCalledTimes(1);
    vi.unstubAllEnvs();
  });

  it("forwards a valid anon id and drops an invalid one without failing the search", async () => {
    const anonId = "12345678-1234-4234-8234-123456789abc";
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const ok = await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ companyName: "示例裝修有限公司", anonId }),
      }),
    );
    expect(ok.status).toBe(200);
    expect(mocks.runSearchPipeline).toHaveBeenCalledWith(
      expect.objectContaining({ companyName: "示例裝修有限公司" }),
      expect.objectContaining({ anonId }),
    );
    expect(info.mock.calls.join(" ")).not.toContain(anonId);

    mocks.runSearchPipeline.mockClear();
    const ignored = await POST(
      new Request("http://localhost/api/search", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyName: "示例裝修有限公司",
          anonId: "not-a-uuid",
        }),
      }),
    );
    expect(ignored.status).toBe(200);
    expect(mocks.runSearchPipeline).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ anonId: null }),
    );
    info.mockRestore();
  });
});

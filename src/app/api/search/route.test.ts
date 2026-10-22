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
});

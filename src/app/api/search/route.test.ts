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

  it("redacts third-party text in the response and leaves registry names", async () => {
    const report = {
      reportVersion: "2.7.0",
      summaryZh: "陳生話尾數未清，電話 91234567。",
      entity: {
        displayName: "陳生",
        normalizedPhone: "91234567",
      },
      official: {
        mwcMatched: true,
        details: { companyName: "陳生", authorizedSignatory: "陳生" },
      },
      signals: {
        themes: ["醫生", "陳生"],
        retrievalEvidence: [
          {
            url: "https://example.com/e",
            title: "陳生投訴",
            snippetExcerpt: "電話 91234567",
            matchedToken: "示例裝修工程有限公司",
          },
        ],
        actionableClauses: [],
        contractChecklist: ["可致電 91234567？"],
      },
      disclaimerVersion: "1.2.4",
      grade: "C",
    };
    mocks.runSearchPipeline.mockResolvedValue({
      fingerprint: "abc",
      cacheHit: false,
      report,
      meta: { serpConfigured: true, webHitCount: 1 },
    });

    const res = await POST(request());
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      report: {
        summaryZh: string;
        entity: { displayName: string; normalizedPhone: string };
        official: {
          details: { companyName: string; authorizedSignatory: string };
        };
        signals: {
          themes: string[];
          contractChecklist: string[];
          retrievalEvidence: Array<{ title: string; matchedToken: string }>;
        };
        disclaimerVersion: string;
        grade: string;
      };
    };

    expect(report.summaryZh).toBe("陳生話尾數未清，電話 91234567。");
    expect(body.report.summaryZh).toBe("[姓名]話尾數未清，電話 [電話]。");
    expect(body.report.signals.themes).toEqual(["醫生", "[姓名]"]);
    expect(body.report.signals.retrievalEvidence[0]?.title).toBe("[姓名]投訴");
    expect(body.report.signals.retrievalEvidence[0]?.matchedToken).toBe(
      "示例裝修工程有限公司",
    );
    expect(body.report.signals.contractChecklist).toEqual(["可致電 91234567？"]);
    expect(body.report.entity.displayName).toBe("陳生");
    expect(body.report.entity.normalizedPhone).toBe("91234567");
    expect(body.report.official.details.authorizedSignatory).toBe("陳生");
    expect(body.report.official.details.companyName).toBe("陳生");
    expect(body.report.disclaimerVersion).toBe("1.2.4");
    expect(body.report.grade).toBe("C");
  });
});

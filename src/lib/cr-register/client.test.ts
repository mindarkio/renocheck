import { afterEach, describe, expect, it, vi } from "vitest";
import { resetCrCircuitBreakerForTests } from "./circuit-breaker";
import { resetCrApiThrottleForTests } from "./throttle";
import { searchCrLocalByNameBeginsWith } from "./client";

function mockFetchResponse(init: {
  ok: boolean;
  status: number;
  body: string;
}) {
  return {
    ok: init.ok,
    status: init.status,
    headers: { get: () => null },
    text: async () => init.body,
  };
}

describe("searchCrLocalByNameBeginsWith", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetCrApiThrottleForTests();
    resetCrCircuitBreakerForTests();
  });

  it("maps HTTP 400 no result message to no_result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          ok: false,
          status: 400,
          body: JSON.stringify({ status: 400, message: "No result found." }),
        }),
      ),
    );
    const res = await searchCrLocalByNameBeginsWith("合成測試");
    expect(res).toEqual({ kind: "no_result" });
  });

  it("maps other HTTP 400 to http_400 (M1)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          ok: false,
          status: 400,
          body: JSON.stringify({
            status: 400,
            message: "Invalid requested Filter.",
          }),
        }),
      ),
    );
    const res = await searchCrLocalByNameBeginsWith("合成測試");
    expect(res).toEqual({ kind: "error", message: "http_400" });
  });

  it("maps HTTP 200 + body status 400 to error (M1)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        mockFetchResponse({
          ok: true,
          status: 200,
          body: JSON.stringify({ status: 400, message: "bad" }),
        }),
      ),
    );
    const res = await searchCrLocalByNameBeginsWith("合成測試");
    expect(res).toEqual({ kind: "error", message: "body_status_400" });
  });
});

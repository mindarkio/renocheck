import { afterEach, describe, expect, it, vi } from "vitest";
import { resetCrApiThrottleForTests } from "./throttle";
import { searchCrLocalByNameBeginsWith } from "./client";

describe("searchCrLocalByNameBeginsWith", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetCrApiThrottleForTests();
  });

  it("maps HTTP 400 to no_result", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => JSON.stringify({ status: 400, message: "No result found." }),
      }),
    );
    const res = await searchCrLocalByNameBeginsWith("合成測試");
    expect(res).toEqual({ kind: "no_result" });
  });
});

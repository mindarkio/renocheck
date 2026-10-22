import { APICallError, RetryError } from "ai";
import { describe, expect, it } from "vitest";
import { isLlmBusyError } from "./llm-risk-report";

function apiError(statusCode: number): APICallError {
  return new APICallError({
    message: "upstream",
    url: "https://example.invalid/v1beta/models/gemini-3.5-flash:generateContent",
    requestBodyValues: {},
    statusCode,
  });
}

describe("isLlmBusyError", () => {
  it("treats APICallError 429 and 5xx, including a cause or RetryError, as busy", () => {
    expect(isLlmBusyError(apiError(429))).toBe(true);
    expect(isLlmBusyError(apiError(503))).toBe(true);
    expect(isLlmBusyError(apiError(500))).toBe(true);
    expect(isLlmBusyError(new Error("wrap", { cause: apiError(429) }))).toBe(true);
    expect(
      isLlmBusyError(
        new RetryError({
          message: "max retries",
          reason: "maxRetriesExceeded",
          errors: [apiError(429)],
        }),
      ),
    ).toBe(true);
  });

  it("keeps other failures on llm_failed", () => {
    expect(isLlmBusyError(apiError(400))).toBe(false);
    expect(isLlmBusyError(new Error("schema"))).toBe(false);
    expect(isLlmBusyError(undefined)).toBe(false);
  });
});

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertQuoteProviderBody,
  completeQuotePdf,
} from "@/lib/quote-analysis/provider";

const env = {
  QUOTE_ANALYSIS_ENABLED: "1",
  AZURE_OPENAI_ENDPOINT: "https://quote.example.invalid",
  AZURE_OPENAI_API_KEY: "test-not-a-key",
  AZURE_OPENAI_DEPLOYMENT: "quote-gpt-6-luna",
};

describe("quote Azure reasoning body", () => {
  afterEach(() => {
    globalThis.AI_SDK_LOG_WARNINGS = undefined;
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("sends reasoning effort low for a custom deployment name", async () => {
    globalThis.AI_SDK_LOG_WARNINGS = false;
    const bodies: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
        const raw = init?.body;
        bodies.push(
          typeof raw === "string"
            ? raw
            : raw instanceof Uint8Array
              ? new TextDecoder().decode(raw)
              : "",
        );
        return new Response("{}", {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }),
    );

    await expect(
      completeQuotePdf(new TextEncoder().encode("%PDF-1.4\n"), env),
    ).rejects.toThrow();

    expect(bodies).toHaveLength(1);
    const body = bodies[0] ?? "";
    assertQuoteProviderBody(body);
    const parsed = JSON.parse(body) as {
      store?: boolean;
      reasoning?: { effort?: string; summary?: string };
      model?: string;
    };
    expect(parsed.store).toBe(false);
    expect(parsed.model).toBe("quote-gpt-6-luna");
    expect(parsed.reasoning).toEqual({ effort: "low" });
  });
});

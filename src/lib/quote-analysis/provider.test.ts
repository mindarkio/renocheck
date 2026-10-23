import { beforeEach, describe, expect, it, vi } from "vitest";

const generateObject = vi.hoisted(() => vi.fn());

vi.mock("ai", () => ({
  generateObject,
}));

import {
  assertQuoteProviderBody,
  completeQuotePdf,
  createGuardedFetch,
  QUOTE_PROVIDER_OPTIONS,
} from "@/lib/quote-analysis/provider";

const env = {
  QUOTE_ANALYSIS_ENABLED: "1",
  AZURE_OPENAI_ENDPOINT: "https://quote.example.invalid",
  AZURE_OPENAI_API_KEY: "test-not-a-key",
  AZURE_OPENAI_DEPLOYMENT: "quote-gpt-6-luna",
};

describe("quote Azure provider", () => {
  beforeEach(() => {
    generateObject.mockReset();
    generateObject.mockResolvedValue({
      object: { isQuotation: true, items: [] },
      usage: { inputTokens: 12, outputTokens: 4 },
    });
  });

  it("asks for store false and a generic filename without calling fetch", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const bytes = new TextEncoder().encode("%PDF-1.4\n");
    const result = await completeQuotePdf(bytes, env);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.inputTokens).toBe(12);
    expect(QUOTE_PROVIDER_OPTIONS.azure.store).toBe(false);
    const call = generateObject.mock.calls[0]?.[0] as {
      maxOutputTokens: number;
      abortSignal?: AbortSignal;
      maxRetries: number;
      providerOptions: { azure: { store: boolean } };
      messages: Array<{ content: Array<{ filename?: string }> }>;
    };
    expect(call.maxRetries).toBe(0);
    expect(call.maxOutputTokens).toBe(4000);
    expect(call.abortSignal).toBeInstanceOf(AbortSignal);
    expect(call.providerOptions.azure.store).toBe(false);
    const file = call.messages[0]?.content.find((part) => part.filename);
    expect(file?.filename).toBe("quote.pdf");
    fetchSpy.mockRestore();
  });

  it("refuses to send a body that would store the response", async () => {
    const inner = vi.fn(async () => new Response("ok"));
    const guarded = createGuardedFetch(inner as typeof fetch);
    await expect(
      guarded("https://quote.example.invalid/openai/v1/responses", {
        method: "POST",
        body: JSON.stringify({ store: true, filename: "quote.pdf" }),
      }),
    ).rejects.toThrow(/store/);
    expect(inner).not.toHaveBeenCalled();
    expect(() =>
      assertQuoteProviderBody(
        JSON.stringify({ store: false, filename: "scan.pdf" }),
      ),
    ).toThrow(/filename/);
    await guarded("https://quote.example.invalid/openai/v1/responses", {
      method: "POST",
      body: JSON.stringify({ store: false, filename: "quote.pdf" }),
    });
    expect(inner).toHaveBeenCalledOnce();
  });

  it("refuses background, chained, file-id and unreadable bodies", async () => {
    for (const body of [
      { store: false, background: true },
      { store: false, previous_response_id: "r" },
      { store: false, input: [{ content: [{ file_id: "f" }] }] },
    ]) {
      expect(() => assertQuoteProviderBody(JSON.stringify(body))).toThrow();
    }
    const inner = vi.fn(async () => new Response("ok"));
    const guarded = createGuardedFetch(inner as typeof fetch);
    await expect(
      guarded("https://quote.example.invalid/openai/v1/responses", {
        method: "POST",
        body: new Blob(["{}"]),
      }),
    ).rejects.toThrow(/quote_provider_body/);
    expect(inner).not.toHaveBeenCalled();
  });
});

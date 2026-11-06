import "server-only";

import { createAzure } from "@ai-sdk/azure";
import { generateObject } from "ai";
import {
  quoteAzureBaseUrl,
  readQuoteAzureEnv,
} from "@/lib/quote-analysis/config";
import {
  QUOTE_ANALYSIS_USER_TEXT,
  QUOTE_EXTRACT_SYSTEM_PROMPT,
  QUOTE_EXTRACT_USER_TEXT,
  quoteAnalysisSystemPrompt,
} from "@/lib/quote-analysis/prompt";
import { QUOTE_EXTRACT_MAX_OUTPUT_TOKENS } from "@/lib/quote-analysis/config";
import {
  activeQuoteCheckIds,
  quoteExtractSchema,
  quoteLlmSchema,
} from "@/lib/quote-analysis/schema";

export type QuoteModelResult = {
  object: unknown;
  inputTokens: number | null;
  outputTokens: number | null;
};

const GENERIC_FILENAME = "quote.pdf";

/** Throws before the request leaves the process when the body would store the file. */
export function assertQuoteProviderBody(body: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    throw new Error("quote_provider_body");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("quote_provider_body");
  }
  const record = parsed as Record<string, unknown>;
  if (record.store !== false) throw new Error("quote_provider_store");
  if ("background" in record || "previous_response_id" in record) {
    throw new Error("quote_provider_body");
  }
  if (JSON.stringify(record).includes('"file_id"')) {
    throw new Error("quote_provider_body");
  }
  const filenames = collectFilenames(record);
  if (filenames.some((name) => name !== GENERIC_FILENAME)) {
    throw new Error("quote_provider_filename");
  }
}

function collectFilenames(value: unknown): string[] {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return value.flatMap(collectFilenames);
  const record = value as Record<string, unknown>;
  const found: string[] = [];
  if (typeof record.filename === "string") found.push(record.filename);
  for (const nested of Object.values(record)) {
    found.push(...collectFilenames(nested));
  }
  return found;
}

export function createGuardedFetch(inner: typeof fetch): typeof fetch {
  return async (input, init) => {
    const method = (
      init?.method ??
      (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    if (method === "POST") {
      const text = await readOutgoingBody(input, init);
      if (text == null) throw new Error("quote_provider_body");
      assertQuoteProviderBody(text);
    }
    return inner(input, init);
  };
}

async function readOutgoingBody(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
): Promise<string | null> {
  const body = init?.body;
  if (typeof body === "string") return body;
  if (body instanceof Uint8Array) return new TextDecoder().decode(body);
  if (input instanceof Request) return input.clone().text();
  return null;
}

export const QUOTE_PROVIDER_OPTIONS = {
  azure: {
    store: false as const,
    reasoningEffort: "low" as const,
    // Custom deployment names are not on the SDK allowlist, so effort is
    // dropped unless the model is forced onto the reasoning path.
    // null keeps the SDK from adding a "detailed" reasoning summary.
    reasoningSummary: null,
    forceReasoning: true,
    strictJsonSchema: true,
  },
};

export async function completeQuotePdf(
  bytes: Uint8Array,
  env: Record<string, string | undefined> = process.env,
): Promise<QuoteModelResult> {
  const settings = readQuoteAzureEnv(env);
  if (!settings) throw new Error("quote_llm_unavailable");

  const azure = createAzure({
    baseURL: quoteAzureBaseUrl(settings.endpoint),
    apiKey: settings.apiKey,
    fetch: createGuardedFetch(fetch),
  });
  const ids = activeQuoteCheckIds(env);
  const result = await generateObject({
    model: azure(settings.deployment),
    schema: quoteLlmSchema(ids),
    system: quoteAnalysisSystemPrompt(env),
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: QUOTE_ANALYSIS_USER_TEXT,
          },
          {
            type: "file",
            data: bytes,
            mediaType: "application/pdf",
            filename: GENERIC_FILENAME,
          },
        ],
      },
    ],
    maxRetries: 0,
    maxOutputTokens: 4000,
    abortSignal: AbortSignal.timeout(45_000),
    providerOptions: QUOTE_PROVIDER_OPTIONS,
  });

  return usageResult(result);
}

/** Company name only. No checklist. The whole PDF is sent; there is no page splitter. */
export async function extractQuoteCompanyName(
  bytes: Uint8Array,
  env: Record<string, string | undefined> = process.env,
): Promise<QuoteModelResult> {
  const settings = readQuoteAzureEnv(env);
  if (!settings) throw new Error("quote_llm_unavailable");

  const azure = createAzure({
    baseURL: quoteAzureBaseUrl(settings.endpoint),
    apiKey: settings.apiKey,
    fetch: createGuardedFetch(fetch),
  });
  const result = await generateObject({
    model: azure(settings.deployment),
    schema: quoteExtractSchema,
    system: QUOTE_EXTRACT_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: QUOTE_EXTRACT_USER_TEXT },
          {
            type: "file",
            data: bytes,
            mediaType: "application/pdf",
            filename: GENERIC_FILENAME,
          },
        ],
      },
    ],
    maxRetries: 0,
    maxOutputTokens: QUOTE_EXTRACT_MAX_OUTPUT_TOKENS,
    abortSignal: AbortSignal.timeout(20_000),
    providerOptions: QUOTE_PROVIDER_OPTIONS,
  });
  return usageResult(result);
}

function usageResult(result: {
  object: unknown;
  usage: { inputTokens?: number; outputTokens?: number };
}): QuoteModelResult {
  const inputTokens = result.usage.inputTokens;
  const outputTokens = result.usage.outputTokens;
  return {
    object: result.object,
    inputTokens: typeof inputTokens === "number" ? inputTokens : null,
    outputTokens: typeof outputTokens === "number" ? outputTokens : null,
  };
}

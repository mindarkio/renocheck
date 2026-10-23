/** Code constant. The Azure deployment name is env, because Aaron names the deployment. */
export const QUOTE_MODEL_ID = "gpt-6-luna";

export const QUOTE_FREE_ANALYSES_PER_DAY = 2;

/** US$0.10 / 1M input, US$0.50 / 1M output. Global Standard, Japan East meter (DEC-0013). */
export const QUOTE_INPUT_USD_PER_MILLION = 0.1;
export const QUOTE_OUTPUT_USD_PER_MILLION = 0.5;

export const QUOTE_PDF_MAX_BYTES = 4_000_000;
export const QUOTE_PDF_MAX_PAGES = 6;

/** Default app-side cap for this draft. Azure itself has no hard cap. */
export const QUOTE_DEFAULT_DAILY_BUDGET_USD = 2;

const USD_TO_MICRO = 1_000_000;

export type QuoteAzureEnv = {
  endpoint: string;
  apiKey: string;
  deployment: string;
};

export function isQuoteAnalysisFlagOn(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = env.QUOTE_ANALYSIS_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function isQuoteArithmeticEnabled(
  env: Record<string, string | undefined> = process.env,
): boolean {
  const raw = env.QUOTE_ARITHMETIC_ENABLED?.trim().toLowerCase();
  return raw === "1" || raw === "true" || raw === "yes";
}

export function readQuoteAzureEnv(
  env: Record<string, string | undefined> = process.env,
): QuoteAzureEnv | null {
  const endpoint = env.AZURE_OPENAI_ENDPOINT?.trim();
  const apiKey = env.AZURE_OPENAI_API_KEY?.trim();
  const deployment = env.AZURE_OPENAI_DEPLOYMENT?.trim();
  if (!endpoint || !apiKey || !deployment) return null;
  if (!endpoint.startsWith("https://")) return null;
  return { endpoint, apiKey, deployment };
}

/** Flag on and all three Azure env vars present. Otherwise the upload UI stays hidden. */
export function isQuoteAnalysisAvailable(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return isQuoteAnalysisFlagOn(env) && readQuoteAzureEnv(env) !== null;
}

/**
 * Portal endpoints look like https://<resource>.openai.azure.com/.
 * @ai-sdk/azure uses a base URL that already ends in /openai/v1 as-is.
 */
export function quoteAzureBaseUrl(endpoint: string): string {
  const url = new URL(endpoint);
  if (url.protocol !== "https:") {
    throw new Error("quote_azure_endpoint");
  }
  const path = url.pathname.replace(/\/+$/, "");
  if (path === "" || path === "/") {
    url.pathname = "/openai/v1";
  } else if (path === "/openai") {
    url.pathname = "/openai/v1";
  } else {
    url.pathname = path;
  }
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

export function quoteDailyBudgetMicroUsd(
  env: Record<string, string | undefined> = process.env,
): number {
  const raw = env.QUOTE_DAILY_BUDGET_USD?.trim();
  if (!raw) return QUOTE_DEFAULT_DAILY_BUDGET_USD * USD_TO_MICRO;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0) {
    return QUOTE_DEFAULT_DAILY_BUDGET_USD * USD_TO_MICRO;
  }
  return Math.round(value * USD_TO_MICRO);
}

export function microUsdFromTokens(inputTokens: number, outputTokens: number): number {
  const usd =
    (inputTokens / 1_000_000) * QUOTE_INPUT_USD_PER_MILLION +
    (outputTokens / 1_000_000) * QUOTE_OUTPUT_USD_PER_MILLION;
  return Math.ceil(usd * USD_TO_MICRO);
}

/** Conservative reserve before the call. Output is the 4,000 token cap. */
export function reserveMicroUsd(pageCount: number): number {
  const inputTokens = 2_500 + pageCount * 3_800;
  return microUsdFromTokens(inputTokens, 4_000);
}

/**
 * Same comparison the SQL function applies.
 * Quota is checked first so a full free allowance is not reported as a budget pause.
 */
export function spendDecision(input: {
  used: number;
  limit: number;
  spent: number;
  reserved: number;
  reserve: number;
  cap: number;
}): "ok" | "quota" | "budget" {
  if (input.used >= input.limit) return "quota";
  if (input.spent + input.reserved + input.reserve > input.cap) return "budget";
  return "ok";
}

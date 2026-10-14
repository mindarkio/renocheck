import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { gateway } from "@ai-sdk/gateway";
import type { LanguageModel } from "ai";

/** Default Gemini model for structured risk summaries (override with GEMINI_MODEL). */
export const DEFAULT_GEMINI_MODEL = "gemini-3.5-flash";

function googleGenerativeAiKey(): string | undefined {
  return (
    process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim() ||
    process.env.GOOGLE_GENERATIVE_AI_KEY?.trim() ||
    undefined
  );
}

/** Gemini (local dev) → AI Gateway gpt-4o-mini (Vercel deploy). */
export function isLlmConfigured(): boolean {
  return resolveRiskReportModel() != null;
}

export function resolveRiskReportModel(): LanguageModel | null {
  const googleKey = googleGenerativeAiKey();
  if (googleKey) {
    const modelId =
      process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
    const google = createGoogleGenerativeAI({ apiKey: googleKey });
    return google(modelId);
  }

  if (
    process.env.AI_GATEWAY_API_KEY?.trim() ||
    process.env.VERCEL_OIDC_TOKEN?.trim()
  ) {
    return gateway("openai/gpt-4o-mini");
  }

  return null;
}

export function llmProviderLabel(): string | null {
  if (googleGenerativeAiKey()) {
    return `google/${process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL}`;
  }
  if (
    process.env.AI_GATEWAY_API_KEY?.trim() ||
    process.env.VERCEL_OIDC_TOKEN?.trim()
  ) {
    return "gateway/openai/gpt-4o-mini";
  }
  return null;
}

export type WebSearchProvider = "serper" | "serpapi";

/** Prefer Serper when keyed (cost); override with SERP_PROVIDER. */
export function resolveWebSearchProvider(): WebSearchProvider | null {
  const forced = process.env.SERP_PROVIDER?.trim().toLowerCase();
  const serper = process.env.SERPER_API_KEY?.trim();
  const serpapi = process.env.SERPAPI_KEY?.trim();

  if (forced === "serper" && serper) return "serper";
  if (forced === "serpapi" && serpapi) return "serpapi";
  if (serper) return "serper";
  if (serpapi) return "serpapi";
  return null;
}

export function isWebSearchConfigured(): boolean {
  return resolveWebSearchProvider() != null;
}

import { NextResponse } from "next/server";
import { searchInputSchema } from "@/lib/report-schema";
import { normalizeSearchInput } from "@/lib/normalize-search-input";
import { runSearchPipeline } from "@/lib/search-pipeline";
import { SearchPipelineError } from "@/lib/search-pipeline-error";
import { checkRateLimit } from "@/lib/rate-limit";

export const maxDuration = 60;

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const parsed = searchInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const refresh =
    process.env.NODE_ENV === "development" &&
    typeof body === "object" &&
    body !== null &&
    (body as { refresh?: boolean }).refresh === true;

  const input = normalizeSearchInput(parsed.data);

  try {
    const result = await runSearchPipeline(input, {
      skipCache: refresh,
    });
    console.info(
      JSON.stringify({
        event: "search",
        fingerprint: result.fingerprint,
        cache_hit: result.cacheHit,
        match_type: input.matchType,
        serp_configured: result.meta.serpConfigured,
        web_hits: result.meta.webHitCount,
      }),
    );
    return NextResponse.json(result);
  } catch (e) {
    const code =
      e instanceof SearchPipelineError ? e.code : "search_failed";
    console.error(
      JSON.stringify({
        event: "search_error",
        code,
        message: String(e),
        cause:
          e instanceof Error && e.cause
            ? String(
                (e.cause as { message?: string }).message ?? e.cause,
              )
            : undefined,
      }),
    );
    const status = e instanceof SearchPipelineError ? 503 : 502;
    return NextResponse.json({ error: code }, { status });
  }
}

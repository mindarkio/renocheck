import { NextResponse } from "next/server";
import { searchInputSchema } from "@/lib/report-schema";
import { normalizeSearchInput } from "@/lib/normalize-search-input";
import { runSearchPipeline } from "@/lib/search-pipeline";
import { SearchPipelineError } from "@/lib/search-pipeline-error";
import { checkRateLimit, SEARCH_MAX_PER_WINDOW } from "@/lib/rate-limit";
import { isAnonId } from "@/lib/anon-id";
import { redactReportForPublicResponse } from "@/lib/redact-public-report";
import { isSyntheticProbeTerm } from "@/lib/synthetic-probe";
import {
  buildRegisterPreview,
  readRegisterPreviewCompanyName,
} from "@/lib/register-preview";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

/**
 * Register preview bucket (DEC-0015 rule 9). Same in-memory limiter and
 * one-minute window as search, under its own key, so a preview never spends a
 * search slot. It needs no secret or database table, so the picker keeps
 * working wherever search works.
 */
function registerPreviewAllowed(ip: string): boolean {
  return checkRateLimit(`register-preview:${ip}`, SEARCH_MAX_PER_WINDOW);
}

function anonIdFromBody(body: unknown): string | null {
  if (typeof body !== "object" || body === null || !("anonId" in body)) {
    return null;
  }
  const value = (body as { anonId?: unknown }).anonId;
  return isAnonId(value) ? value.toLowerCase() : null;
}

export const maxDuration = 60;

export async function POST(req: Request) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    if (!checkRateLimit(ip)) {
      return NextResponse.json({ error: "rate_limited" }, { status: 429 });
    }
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  // Pick the bucket from the parsed body, not from the key being present:
  // `{ preview: null, … }` is a full search and must spend a search slot.
  const previewName = readRegisterPreviewCompanyName(body);
  const allowed = previewName === null ? checkRateLimit(ip) : registerPreviewAllowed(ip);
  if (!allowed) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  if (previewName === "invalid") {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }
  if (previewName) {
    if (process.env.NODE_ENV === "production" && isSyntheticProbeTerm(previewName)) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
    if (!isSupabaseAdminConfigured()) {
      return NextResponse.json({ error: "register_lookup_failed" }, { status: 503 });
    }
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: "register_lookup_failed" }, { status: 503 });
    }
    try {
      const preview = await buildRegisterPreview(supabase, previewName);
      console.info(
        JSON.stringify({
          event: "register_preview",
          match_count: preview.matchCount,
          window_full: preview.windowFull,
        }),
      );
      return NextResponse.json(preview);
    } catch (e) {
      console.error(
        JSON.stringify({
          event: "register_preview_error",
          message: e instanceof Error ? e.name : "error",
        }),
      );
      return NextResponse.json({ error: "register_lookup_failed" }, { status: 503 });
    }
  }

  const parsed = searchInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  if (
    process.env.NODE_ENV === "production" &&
    isSyntheticProbeTerm(parsed.data.companyName ?? "")
  ) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const refresh =
    process.env.NODE_ENV === "development" &&
    typeof body === "object" &&
    body !== null &&
    (body as { refresh?: boolean }).refresh === true;

  const input = normalizeSearchInput(parsed.data);
  const anonId = anonIdFromBody(body);

  try {
    const result = await runSearchPipeline(input, {
      skipCache: refresh,
      anonId,
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
    return NextResponse.json({
      ...result,
      report: redactReportForPublicResponse(result.report),
    });
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

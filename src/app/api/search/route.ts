import { NextResponse } from "next/server";
import { searchInputSchema } from "@/lib/report-schema";
import { normalizeSearchInput } from "@/lib/normalize-search-input";
import { runSearchPipeline } from "@/lib/search-pipeline";
import { SearchPipelineError } from "@/lib/search-pipeline-error";
import { rateLimitIp, takeAuthRateLimit } from "@/lib/auth/rate-limit";
import { checkRateLimit, SEARCH_MAX_PER_WINDOW } from "@/lib/rate-limit";
import { isAnonId } from "@/lib/anon-id";
import { redactReportForPublicResponse } from "@/lib/redact-public-report";
import { isSyntheticProbeTerm } from "@/lib/synthetic-probe";
import {
  buildRegisterPreview,
  readRegisterPreviewCompanyName,
} from "@/lib/register-preview";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "@/lib/supabase/admin";

/** Same one-minute window as search, stored under a different HMAC key. */
const REGISTER_PREVIEW_WINDOW_MS = 60_000;

function isRegisterPreviewAttempt(body: unknown): boolean {
  return typeof body === "object" && body !== null && "preview" in body;
}

async function registerPreviewLimitResponse(ip: string): Promise<NextResponse | null> {
  const result = await takeAuthRateLimit({
    key: `register-preview:${rateLimitIp(ip)}`,
    limit: SEARCH_MAX_PER_WINDOW,
    windowMs: REGISTER_PREVIEW_WINDOW_MS,
  });
  if (result === "limited") {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  if (result !== "ok") {
    return NextResponse.json({ error: "register_lookup_failed" }, { status: 503 });
  }
  return null;
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

  if (isRegisterPreviewAttempt(body)) {
    const limited = await registerPreviewLimitResponse(ip);
    if (limited) return limited;
  } else if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  const previewName = readRegisterPreviewCompanyName(body);
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

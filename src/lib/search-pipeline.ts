import type { RiskReport } from "./report-schema";
import type { NormalizedSearchInput } from "./normalize-search-input";
import { normalizeHongKongPhone } from "./normalize-phone";
import { buildSearchFingerprint } from "./search-fingerprint";
import { lookupMwcWithMeta } from "./mwc-lookup";
import {
  buildBrandHostForumQuery,
  fetchSerpOrganicHits,
  fetchWebSearchHitsForEntity,
  isSerpConfigured,
  mergeWebSearchHits,
} from "./web-search";
import {
  entityL1MustIncludeAny,
  entityMatchTokens,
  resolveBrandSerpSearchPhrase,
} from "./search-entity-labels";
import { enforceHighlightEvidenceAlignment } from "./highlight-evidence-alignment";
import {
  buildRetrievalEvidence,
  countBoundDisputeSignals,
  countBoundPraiseSignals,
  filterWebSearchHitsForLlm,
} from "./search-evidence-filter";
import { mirrorEvaluationConfidence } from "./evaluation-stub";
import { calibrateEvaluation } from "./risk-report-calibration-v2";
import { synthesizeRiskReport } from "./llm-risk-report";
import {
  getCachedReport,
  logSearchEvent,
  setCachedReport,
} from "./search-cache";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./supabase/admin";
import { SearchPipelineError } from "./search-pipeline-error";
import { isLlmConfigured } from "./llm-model";
import {
  buildQueryEcho,
  computeNameAlignment,
  resolveAuthoritativeSearchLabel,
} from "./entity-report-context";

export type SearchPipelineResult = {
  fingerprint: string;
  report: RiskReport;
  cacheHit: boolean;
  meta: {
    serpConfigured: boolean;
    webHitCount: number;
  };
};

export type SearchPipelineOptions = {
  /** Dev only: bypass search_cache read */
  skipCache?: boolean;
};

export async function runSearchPipeline(
  input: NormalizedSearchInput,
  options?: SearchPipelineOptions,
): Promise<SearchPipelineResult> {
  const fingerprint = buildSearchFingerprint(input);
  const serpConfigured = isSerpConfigured();

  if (!isSupabaseAdminConfigured()) {
    throw new SearchPipelineError("supabase_unavailable");
  }
  if (!serpConfigured) {
    throw new SearchPipelineError("serp_unavailable");
  }
  if (!isLlmConfigured()) {
    throw new SearchPipelineError("llm_unavailable");
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    throw new SearchPipelineError("supabase_unavailable");
  }

  if (!options?.skipCache) {
    const cached = await getCachedReport(supabase, fingerprint);
    if (cached) {
      await logSearchEvent(supabase, fingerprint, true);
      return {
        fingerprint,
        report: cached,
        cacheHit: true,
        meta: {
          serpConfigured,
          webHitCount: cached.signals.serpHitCount ?? 0,
        },
      };
    }
  }

  const pipelineStart = performance.now();
  const mwcStart = performance.now();
  const mwcLookup = await lookupMwcWithMeta(supabase, input);
  const mwc = mwcLookup.row;
  const mwcMs = Math.round(performance.now() - mwcStart);

  const mwcOpts = mwc ? { mwcCompanyName: mwc.company_name } : undefined;
  const searchLabelUsed = resolveAuthoritativeSearchLabel(input, mwcOpts);
  const queryEcho = buildQueryEcho(input);
  const nameAlignment = computeNameAlignment(
    input,
    mwc,
    mwcLookup.ambiguous,
  );

  const serpStart = performance.now();
  const { hits: serpHits } = await fetchWebSearchHitsForEntity(input, mwcOpts);

  const tokens = entityMatchTokens(input, {
    mwcCompanyName: mwc?.company_name,
    phoneNormalized: input.phone,
  });
  const phoneForL1 = normalizeHongKongPhone(input.phone) ?? undefined;
  const l1Opts = {
    mustIncludeAny: entityL1MustIncludeAny(searchLabelUsed),
    normalizedPhone: phoneForL1,
  };

  let rawHits = serpHits;
  const previewBound = filterWebSearchHitsForLlm(rawHits, tokens, l1Opts).length;
  const brandPhrase = resolveBrandSerpSearchPhrase(searchLabelUsed);
  if (previewBound === 0 && brandPhrase) {
    try {
      const retryQ = buildBrandHostForumQuery(brandPhrase);
      const retryHits = await fetchSerpOrganicHits(retryQ, { pages: 1 });
      rawHits = mergeWebSearchHits(rawHits, retryHits);
      console.info(
        JSON.stringify({
          event: "serp_brand_host_retry",
          brand_phrase_chars: brandPhrase.length,
          retry_organic: retryHits.length,
          merged_organic: rawHits.length,
        }),
      );
    } catch (e) {
      console.warn(
        JSON.stringify({
          event: "serp_query_failed",
          query_index: 4,
          query_kind: "brand_host_forum",
          message: String(e).slice(0, 160),
        }),
      );
    }
  }

  const serpMs = Math.round(performance.now() - serpStart);

  const webHitsForLlm = filterWebSearchHitsForLlm(rawHits, tokens, l1Opts);
  const boundHitCount = webHitsForLlm.length;

  const sampleHosts =
    rawHits.length > 0 && webHitsForLlm.length === 0
      ? rawHits
          .slice(0, 3)
          .map((h) => {
            try {
              return new URL(h.url).hostname;
            } catch {
              return "invalid-url";
            }
          })
      : undefined;

  console.info(
    JSON.stringify({
      event: "search_evidence",
      raw_hits: rawHits.length,
      llm_hits: boundHitCount,
      token_count: tokens.length,
      ...(sampleHosts ? { l1_no_match_sample_hosts: sampleHosts } : {}),
    }),
  );

  const llmStart = performance.now();
  let fullReport = await synthesizeRiskReport({
    input,
    mwc,
    webHits: webHitsForLlm,
    serpHitCount: rawHits.length,
    boundHitCount,
    entityContext: {
      queryEcho,
      searchLabelUsed,
      nameAlignment,
    },
  });
  const llmMs = Math.round(performance.now() - llmStart);

  const allowedUrls = new Set(webHitsForLlm.map((h) => h.url));
  const beforeHighlights = fullReport.signals.highlights?.length ?? 0;
  fullReport = enforceHighlightEvidenceAlignment(fullReport, allowedUrls);
  const afterHighlights = fullReport.signals.highlights?.length ?? 0;
  if (beforeHighlights > afterHighlights) {
    console.warn(
      JSON.stringify({
        event: "highlight_url_rejected",
        dropped: beforeHighlights - afterHighlights,
      }),
    );
  }

  const retrievalEvidence = buildRetrievalEvidence(webHitsForLlm, tokens, {
    normalizedPhone: phoneForL1,
  });
  fullReport = {
    ...fullReport,
    signals: {
      ...fullReport.signals,
      retrievalEvidence,
      boundHitCount: boundHitCount,
    },
  };

  const calibrated = calibrateEvaluation({
    slice: {
      grade: fullReport.grade,
      confidence: fullReport.confidence,
      summaryZh: fullReport.summaryZh,
      discussionCount: fullReport.signals.discussionCount,
      themes: fullReport.signals.themes,
      highlights: fullReport.signals.highlights ?? [],
    },
    evidence: {
      llmHitCount: webHitsForLlm.length,
      boundHitCount,
      serpHitCount: rawHits.length,
      boundDisputeHitCount: countBoundDisputeSignals(webHitsForLlm),
      boundPraiseHitCount: countBoundPraiseSignals(webHitsForLlm),
    },
    mwcMatched: mwc != null,
    mwcAmbiguous: mwcLookup.ambiguous,
    generatedAt: fullReport.generatedAt,
  });

  fullReport = {
    ...fullReport,
    grade: calibrated.grade,
    confidence: calibrated.confidence,
    summaryZh: calibrated.summaryZh,
    evaluation: calibrated.evaluation,
    signals: {
      ...fullReport.signals,
      themes: calibrated.themes,
      discussionCount: calibrated.discussionCount,
    },
  };

  if (mwcLookup.ambiguous && fullReport.confidence !== "low") {
    fullReport = mirrorEvaluationConfidence(fullReport, "low");
  }

  const { riskReportSchema } = await import("./report-schema");
  const validated = riskReportSchema.parse(fullReport);

  await setCachedReport(supabase, fingerprint, input, validated);
  await logSearchEvent(supabase, fingerprint, false);

  console.info(
    JSON.stringify({
      event: "search_timing",
      mwc_ms: mwcMs,
      serp_ms: serpMs,
      llm_ms: llmMs,
      total_ms: Math.round(performance.now() - pipelineStart),
    }),
  );

  return {
    fingerprint,
    report: validated,
    cacheHit: false,
    meta: { serpConfigured, webHitCount: rawHits.length },
  };
}

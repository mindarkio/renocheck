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
import { selectPublicLinkHits } from "./public-link-signal";
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
  isReportCrLookupDegraded,
  isReportLookupDegraded,
  LEGAL_LOOKUP_DEGRADED_CACHE_TTL_MS,
  logSearchEvent,
  setCachedReport,
} from "./search-cache";
import { getSupabaseAdmin, isSupabaseAdminConfigured } from "./supabase/admin";
import { SearchPipelineError } from "./search-pipeline-error";
import { getServiceStatus } from "./service-status";
import { isLlmConfigured } from "./llm-model";
import {
  buildQueryEcho,
  computeNameAlignment,
  resolveAuthoritativeSearchLabel,
} from "./entity-report-context";
import { applyLegalEventFloors } from "./legal-event-calibration";
import { applyRiskBandMaxCapToReport } from "./risk-band-calibration";
import {
  isLegalLookupDegraded,
  startLegalLookupForSearch,
} from "./search-pipeline-legal-lookup";
import { summaryZhForLegalLookupDegraded } from "./search-pipeline-legal-summary";
import { isLegalEventsEnabled } from "./legal-events-config";
import { lookupCompaniesRegistryForSearch } from "./cr-registry-lookup";
import { isSyntheticProbeTerm } from "./synthetic-probe";

export type SearchPipelineResult = {
  fingerprint: string;
  report: RiskReport;
  cacheHit: boolean;
  meta: {
    serpConfigured: boolean;
    webHitCount: number;
  };
};

/**
 * Whole-pipeline wall-clock budget (route.ts maxDuration = 60s). SERP must finish
 * by deadline − LLM_RESERVE_MS so Gemini always gets ≥ LLM_RESERVE_MS; the LLM call
 * is aborted at the deadline. Leaves ~10s for cache read/write + search_events + response.
 * CR (CR_LOOKUP_BUDGET_MS 25s) starts in parallel before SERP, so it ends before
 * deadline − LLM_RESERVE_MS as well.
 */
export const PIPELINE_BUDGET_MS = 50_000;
export const LLM_RESERVE_MS = 20_000;

export type SearchPipelineOptions = {
  /** Dev only: bypass search_cache read */
  skipCache?: boolean;
  /** Random browser id. Omitted for ZZQ probes and when the column is absent. */
  anonId?: string | null;
};

function searchEventAnonId(
  input: NormalizedSearchInput,
  anonId: string | null | undefined,
): string | null {
  if (!anonId) return null;
  if (isSyntheticProbeTerm(input.companyName ?? "")) return null;
  return anonId;
}

export async function runSearchPipeline(
  input: NormalizedSearchInput,
  options?: SearchPipelineOptions,
): Promise<SearchPipelineResult> {
  const fingerprint = buildSearchFingerprint(input);
  const serpConfigured = isSerpConfigured();
  const pipelineDeadlineMs = Date.now() + PIPELINE_BUDGET_MS;
  const serpDeadlineMs = pipelineDeadlineMs - LLM_RESERVE_MS;

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
    if (cached && !isReportLookupDegraded(cached)) {
      await logSearchEvent(
        supabase,
        fingerprint,
        true,
        searchEventAnonId(input, options?.anonId),
      );
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

  if (getServiceStatus().paused) {
    throw new SearchPipelineError("service_paused");
  }

  const pipelineStart = performance.now();
  const mwcStart = performance.now();
  const mwcLookup = await lookupMwcWithMeta(supabase, input);
  const mwc = mwcLookup.row;
  const mwcMs = Math.round(performance.now() - mwcStart);

  const mwcOpts = mwc ? { mwcCompanyName: mwc.company_name } : undefined;
  const searchLabelUsed = resolveAuthoritativeSearchLabel(input, mwcOpts);
  const companiesRegistryPromise = lookupCompaniesRegistryForSearch(
    input,
    searchLabelUsed,
    mwc,
  );
  const queryEcho = buildQueryEcho(input);
  const nameAlignment = computeNameAlignment(
    input,
    mwc,
    mwcLookup.ambiguous,
  );

  const legalEventsEnabled = isLegalEventsEnabled();
  const legalLookupPromise = startLegalLookupForSearch(
    supabase,
    {
      searchLabelUsed,
      br: input.br,
    },
    legalEventsEnabled,
  );

  const serpStart = performance.now();
  const { hits: serpHits, queriesCompleted } = await fetchWebSearchHitsForEntity(
    input,
    {
      ...mwcOpts,
      deadlineMs: serpDeadlineMs,
    },
  );
  let anySearchSourceOk = queriesCompleted > 0;

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
      const retryHits = await fetchSerpOrganicHits(retryQ, {
        pages: 1,
        deadlineMs: serpDeadlineMs,
      });
      rawHits = mergeWebSearchHits(rawHits, retryHits);
      console.info(
        JSON.stringify({
          event: "serp_brand_host_retry",
          brand_phrase_chars: brandPhrase.length,
          retry_organic: retryHits.length,
          merged_organic: rawHits.length,
        }),
      );
      anySearchSourceOk = true;
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
  if (!anySearchSourceOk) {
    console.warn(JSON.stringify({ event: "serp_all_sources_failed" }));
    throw new SearchPipelineError("serp_failed");
  }
  const [legalLookup, companiesRegistry] = await Promise.all([
    legalLookupPromise,
    companiesRegistryPromise,
  ]);

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
    abortSignal: AbortSignal.timeout(
      Math.max(1_000, pipelineDeadlineMs - Date.now()),
    ),
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

  const highlightUrls = new Set(
    (fullReport.signals.highlights ?? []).map((h) => h.url),
  );
  const publicLinks = selectPublicLinkHits(webHitsForLlm, tokens, {
    normalizedPhone: phoneForL1,
    alwaysIncludeUrls: highlightUrls,
    // No highlights → calibration uses the dispute-keyword sentence when any
    // L1 hit has a dispute word. Those hits must stay visible.
    keepDisputeSources: highlightUrls.size === 0,
  });
  console.info(
    JSON.stringify({
      event: "public_link_signal",
      bound: webHitsForLlm.length,
      kept: publicLinks.kept,
      ...publicLinks.dropped,
    }),
  );
  const retrievalEvidence = buildRetrievalEvidence(publicLinks.hits, tokens, {
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
      sourceTitles: Object.fromEntries(webHitsForLlm.map((h) => [h.url, h.title])),
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

  fullReport = applyLegalEventFloors(
    fullReport,
    legalLookup.events,
    boundHitCount,
  );
  const legalDegraded = isLegalLookupDegraded(legalLookup.status);
  fullReport = {
    ...fullReport,
    ...(legalDegraded
      ? {
          summaryZh: summaryZhForLegalLookupDegraded(fullReport.summaryZh),
        }
      : {}),
    official: {
      ...fullReport.official,
      ...(legalLookup.events.length > 0
        ? { legalEvents: legalLookup.events }
        : {}),
      ...(legalLookup.registryAsOf
        ? { legalRegistryAsOf: legalLookup.registryAsOf }
        : {}),
      ...(legalLookup.attempted
        ? { legalLookupStatus: legalLookup.status }
        : {}),
      companiesRegistry,
    },
  };

  const { riskReportSchema } = await import("./report-schema");
  const validated = riskReportSchema.parse(fullReport);
  const lookupDegraded =
    legalDegraded || isReportCrLookupDegraded(validated);

  await setCachedReport(supabase, fingerprint, input, validated, {
    ttlMs: lookupDegraded ? LEGAL_LOOKUP_DEGRADED_CACHE_TTL_MS : undefined,
    skipIfHealthyCacheExists: lookupDegraded,
  });
  await logSearchEvent(
    supabase,
    fingerprint,
    false,
    searchEventAnonId(input, options?.anonId),
  );

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
    report: applyRiskBandMaxCapToReport(validated),
    cacheHit: false,
    meta: { serpConfigured, webHitCount: rawHits.length },
  };
}

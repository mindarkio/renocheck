import { generateObject } from "ai";
import { llmProviderLabel, resolveRiskReportModel } from "./llm-model";
import { z } from "zod";
import type { MwcRow } from "./mwc-lookup";
import { RISK_REPORT_SYSTEM_PROMPT } from "./prompts/risk-report";
import type { NormalizedSearchInput } from "./normalize-search-input";
import type { WebSearchHit } from "./web-search";
import { gradeSchema, type RiskReport } from "./report-schema";

type Grade = z.infer<typeof gradeSchema>;
import { DISCLAIMER_VERSION, REPORT_VERSION } from "./constants";
import { buildOfficialMwcDetails } from "./mwc-official-details";
import { SearchPipelineError } from "./search-pipeline-error";
import { isLlmConfigured } from "./llm-model";
import type { NameAlignment } from "./entity-report-context";
import { defaultContractChecklist } from "./contract-checklist";
import { buildEvaluationStub } from "./evaluation-stub";
import { bindLlmSliceToWebHits, llmSliceSchema } from "./llm-risk-slice";

export async function synthesizeRiskReport(params: {
  input: NormalizedSearchInput;
  mwc: MwcRow | null;
  webHits: WebSearchHit[];
  serpHitCount: number;
  boundHitCount: number;
  entityContext: {
    queryEcho: string;
    searchLabelUsed: string;
    nameAlignment: NameAlignment;
  };
  /** Whole-pipeline deadline (search-pipeline.ts); aborts generateObject incl. retries. */
  abortSignal?: AbortSignal;
}): Promise<RiskReport> {
  const {
    input,
    mwc,
    webHits,
    serpHitCount,
    boundHitCount,
    entityContext,
  } = params;

  if (!isLlmConfigured()) {
    throw new SearchPipelineError("llm_unavailable");
  }

  const model = resolveRiskReportModel();
  if (!model) {
    throw new SearchPipelineError("llm_unavailable");
  }

  const displayName =
    mwc?.company_name ??
    input.companyName ??
    input.phone ??
    input.br ??
    "未知查詢";

  const entity = {
    displayName,
    matchType: input.matchType,
    queryEcho: entityContext.queryEcho,
    searchLabelUsed: entityContext.searchLabelUsed,
    nameAlignment: entityContext.nameAlignment,
    ...(input.phone ? { normalizedPhone: input.phone } : {}),
  };

  const official = {
    mwcMatched: mwc != null,
    ...(mwc ? { details: buildOfficialMwcDetails(mwc) } : {}),
  };

  const userPayload = JSON.stringify({
    query: input,
    mwc,
    webHits,
  });

  try {
    const { object: raw } = await generateObject({
      model,
      schema: llmSliceSchema,
      system: RISK_REPORT_SYSTEM_PROMPT,
      prompt: userPayload,
      ...(params.abortSignal ? { abortSignal: params.abortSignal } : {}),
    });

    const bound = bindLlmSliceToWebHits(raw, webHits);
    if (bound.highlightsDropped > 0) {
      console.warn(
        JSON.stringify({
          event: "highlight_url_rejected",
          stage: "llm_bind",
          dropped: bound.highlightsDropped,
        }),
      );
    }

    const slice = bound.calibrationInput;

    console.info(
      JSON.stringify({
        event: "llm_ok",
        provider: llmProviderLabel(),
        discussion_count: slice.discussionCount,
        confidence: slice.confidence,
        llm_hits: webHits.length,
        highlights_len: slice.highlights.length,
        grade_hint: slice.grade,
        actionable_clauses: bound.actionableClauses.length,
        ...(bound.disputeHints.disputeLevel
          ? { dispute_level_hint: bound.disputeHints.disputeLevel }
          : {}),
      }),
    );

    const grade = (slice.grade as Grade) ?? "C";
    const highlightCount = slice.highlights.length;

    return {
      reportVersion: REPORT_VERSION,
      entity,
      grade,
      confidence: slice.confidence,
      evaluation: buildEvaluationStub({
        overallGrade: grade,
        confidence: slice.confidence,
        mwcMatched: mwc != null,
        boundHitCount,
        highlightCount,
      }),
      summaryZh: slice.summaryZh,
      official,
      signals: {
        discussionCount: slice.discussionCount,
        themes: slice.themes,
        highlights: slice.highlights,
        serpHitCount,
        boundHitCount,
        retrievalEvidence: [],
        actionableClauses: bound.actionableClauses,
        contractChecklist: defaultContractChecklist(),
      },
      disclaimerVersion: DISCLAIMER_VERSION,
      generatedAt: new Date().toISOString(),
    };
  } catch (e) {
    console.warn(
      JSON.stringify({
        event: "llm_error",
        provider: llmProviderLabel(),
        message: String(e),
      }),
    );
    throw new SearchPipelineError("llm_failed", String(e));
  }
}

import { z } from "zod";
import { nameAlignmentSchema } from "./entity-report-context";
import {
  legalTrackSchema,
  officialLegalEventSchema,
} from "./legal-event-schema";

export const gradeSchema = z.enum(["A", "B", "C", "D", "E", "F"]);
export const confidenceSchema = z.enum(["high", "medium", "low"]);

export const dataSaturationSchema = z.enum([
  "rich",
  "moderate",
  "sparse",
  "unindexed",
]);

export const licenseStatusSchema = z.enum([
  "active",
  "not_found",
  "ambiguous",
]);

export const disputeLevelSchema = z.enum([
  "none_detected",
  "historical_isolated",
  "active_concerning",
  "severe",
]);

/** DEC-0010 user-facing risk band (primary UI label). */
export const riskBandZhSchema = z.enum([
  "風險偏高",
  "風險中等",
  "中性",
  "未見負面摘要",
]);

export const retrievalMatchReasonSchema = z.enum([
  "entity_token",
  "phone_anchor",
]);

export const incidentTypeSchema = z.enum([
  "payment_dispute",
  "quality_defect",
  "delay_abandonment",
  "communication",
  "other",
]);

/** Max highlights per report (aligned with SERP_LLM_HIT_CAP default 15). */
export const HIGHLIGHTS_MAX = 15;

export const discussionHighlightSchema = z.object({
  summaryZh: z.string().max(160),
  url: z.string().url(),
  sourceName: z.string().max(60).optional(),
  /** snippet 可見日期或「日期不詳」 */
  dateHint: z.string().max(40).optional(),
  incidentType: incidentTypeSchema.optional(),
  approxYear: z.string().max(4).optional(),
  factSummary: z.string().max(160).optional(),
});

export type DiscussionHighlight = z.infer<typeof discussionHighlightSchema>;

/** L1-bound Serp hit; pipeline-only (not LLM-generated). DEC-0006 / DEC-0007 */
export const retrievalEvidenceItemSchema = z.object({
  url: z.string().url(),
  title: z.string().max(200),
  snippetExcerpt: z.string().max(280),
  matchedToken: z.string().max(80),
  matchReason: retrievalMatchReasonSchema.default("entity_token"),
});

export type RetrievalEvidenceItem = z.infer<typeof retrievalEvidenceItemSchema>;

export const actionableClauseSchema = z.object({
  category: z.string().max(40),
  clauseText: z.string().max(200),
  reason: z.string().max(120),
});

export type ActionableClause = z.infer<typeof actionableClauseSchema>;

export const complianceTrackSchema = z.object({
  isMwcRegistered: z.boolean(),
  registrationClass: z.string().max(40).optional(),
  licenseStatus: licenseStatusSchema,
});

export const reputationTrackSchema = z.object({
  disputeLevel: disputeLevelSchema,
  recentDisputeCount: z.number().int().nonnegative(),
});

export const evaluationSchema = z.object({
  overallGrade: gradeSchema,
  displayGradeZh: z.string().max(8).optional(),
  riskBandZh: riskBandZhSchema,
  riskBandDetailZh: z.string().max(24).optional(),
  confidence: confidenceSchema,
  dataSaturation: dataSaturationSchema,
  complianceTrack: complianceTrackSchema,
  reputationTrack: reputationTrackSchema,
  /** DEC-0012 — display/debug; grading uses deterministic floors */
  legalTrack: legalTrackSchema.optional(),
});

export type Evaluation = z.infer<typeof evaluationSchema>;

export const companiesRegistryHintSchema = z.enum([
  "incorporation_under_one_year",
  "not_found_in_active_list",
]);

export const companiesRegistrySchema = z.object({
  lookupStatus: z.enum(["ok", "error", "timeout", "skipped"]),
  matched: z.boolean().optional(),
  matchAmbiguous: z.boolean().optional(),
  matchTier: z.enum(["A", "B", "C"]).optional(),
  brNo: z.string().max(32).optional(),
  companyType: z.string().max(120).optional(),
  nameZh: z.string().max(200).optional(),
  nameEn: z.string().max(200).optional(),
  incorporationDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  retrievedAt: z.string().datetime(),
  hints: z.array(companiesRegistryHintSchema),
  icrisHomeUrl: z.string().url(),
});

export type CompaniesRegistryOfficial = z.infer<typeof companiesRegistrySchema>;

const riskReportBaseSchema = z.object({
  reportVersion: z.string().min(1),
  entity: z.object({
    displayName: z.string().min(1),
    matchType: z.enum(["phone", "br", "company_name"]),
    /** @deprecated DEC-0011 — legacy cache only; new reports omit */
    maskedLabel: z.string().optional(),
    queryEcho: z.string().min(1),
    searchLabelUsed: z.string().min(1),
    nameAlignment: nameAlignmentSchema,
    /** 8-digit HK number when user supplied phone (DEC-0007) */
    normalizedPhone: z.string().max(8).optional(),
  }),
  grade: gradeSchema,
  confidence: confidenceSchema,
  evaluation: evaluationSchema,
  summaryZh: z.string().max(120),
  official: z.object({
    mwcMatched: z.boolean(),
    details: z
      .object({
        companyName: z.string(),
        registrationNo: z.string().optional(),
        /** ISO date (YYYY-MM-DD) from MWC open-data import */
        expiryDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional(),
        /** Primary authorized signatory (one AS per deduped register row) */
        authorizedSignatory: z.string().max(120).optional(),
        /** When the imported register snapshot was last refreshed */
        registryDataAsOf: z.string().datetime().optional(),
      })
      .optional(),
    /** DEC-0012 Track 1 court judgments (structured; not LLM) */
    legalEvents: z.array(officialLegalEventSchema).max(10).optional(),
    legalRegistryAsOf: z.string().datetime().optional(),
    /** Set when Track 1 lookup ran; error/timeout → UI degraded message */
    legalLookupStatus: z.enum(["ok", "error", "timeout"]).optional(),
    /** PR-CR: Companies Registry open data (company-level only; no personal names) */
    companiesRegistry: companiesRegistrySchema.optional(),
  }),
  signals: z.object({
    discussionCount: z.number().int().nonnegative(),
    themes: z.array(z.string()),
    /** LLM 整理：來源、時間提示、事件摘要 */
    highlights: z.array(discussionHighlightSchema).max(HIGHLIGHTS_MAX).optional(),
    /** Serp 命中條數（未必全部相關）；AI 未完成時供參考 */
    serpHitCount: z.number().int().nonnegative().optional(),
    /** L1 後送 LLM 的條數 */
    boundHitCount: z.number().int().nonnegative().optional(),
    /** 與 bound 對齊的公開來源列表（檢索層 SSOT） */
    retrievalEvidence: z.array(retrievalEvidenceItemSchema).max(30),
    contractChecklist: z.array(z.string()).min(1),
    actionableClauses: z.array(actionableClauseSchema).max(8).default([]),
  }),
  /** @deprecated Launch open access; new reports use signals.contractChecklist */
  premium: z
    .object({
      discussionSnippets: z.array(
        z.object({
          title: z.string(),
          url: z.string().url(),
          excerpt: z.string(),
        }),
      ),
      contractChecklist: z.array(z.string()),
    })
    .optional(),
  disclaimerVersion: z.string(),
  generatedAt: z.string().datetime(),
});

export const riskReportSchema = riskReportBaseSchema.superRefine((data, ctx) => {
  if (data.grade !== data.evaluation.overallGrade) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "grade must mirror evaluation.overallGrade",
      path: ["grade"],
    });
  }
  if (data.confidence !== data.evaluation.confidence) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "confidence must mirror evaluation.confidence",
      path: ["confidence"],
    });
  }
});

export type RiskReport = z.infer<typeof riskReportBaseSchema>;

export const searchInputSchema = z
  .object({
    companyName: z.string().optional(),
    phone: z.string().optional(),
    br: z.string().optional(),
  })
  .refine(
    (data) =>
      Boolean(
        data.companyName?.trim() ||
          data.phone?.trim() ||
          data.br?.trim(),
      ),
    { message: "invalid_input" },
  );

export type SearchInput = z.infer<typeof searchInputSchema>;

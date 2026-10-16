import { z } from "zod";

/** DEC-0012 Appendix A */
export const judgmentCategorySchema = z.enum([
  "renovation_engineering_civil",
  "building_defect_water_damage",
  "arbitration_award",
  "small_claims_debt",
  "general_contract_debt",
  "small_works_regulatory",
  "criminal_regulatory",
  "winding_up_insolvency",
  "employment_labour",
  "personal_injury_site",
  "landlord_tenant",
  "intellectual_property",
  "defamation",
  "other_civil",
  "unknown",
]);

export const partyRoleSchema = z.enum([
  "defendant",
  "plaintiff",
  "third_party",
  "unknown",
]);

import { outcomeHintSchema, type OutcomeHint } from "./outcome-hint";

export { outcomeHintSchema, type OutcomeHint };

export const procedureStageSchema = z.enum([
  "final_judgment",
  "interlocutory",
  "appeal",
  "hearing_only",
  "unknown",
]);

export type JudgmentCategory = z.infer<typeof judgmentCategorySchema>;
export type PartyRole = z.infer<typeof partyRoleSchema>;
export type ProcedureStage = z.infer<typeof procedureStageSchema>;

export const legalEventReviewStatusSchema = z.enum(["auto", "human_verified"]);

export const legalEventBusinessFormSchema = z.enum(["sole_proprietorship"]);

export const officialLegalEventSchema = z.object({
  sourceType: z.literal("court_judgment"),
  caseRef: z.string().max(80),
  court: z.string().max(120),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  judgmentCategory: judgmentCategorySchema,
  partyRole: partyRoleSchema,
  outcomeHint: outcomeHintSchema.optional(),
  procedureStage: procedureStageSchema.optional(),
  hearingKeyPointsZh: z.array(z.string().max(200)).min(1).max(8),
  sourceUrl: z.string().url(),
  matchReasonZh: z.string().max(80),
  sourceLabel: z.string().max(40).optional(),
  reviewStatus: legalEventReviewStatusSchema.optional(),
  businessForm: legalEventBusinessFormSchema.optional(),
  /** 獨資：UI 顯示東主／個人名；商號用 lookup alias 匹配。 */
  defendantDisplayNameZh: z.string().max(120).optional(),
});

export type OfficialLegalEvent = z.infer<typeof officialLegalEventSchema>;

export const legalTrackSchema = z.object({
  matchedCount: z.number().int().nonnegative(),
  strongestCategory: judgmentCategorySchema.optional(),
});

export type LegalTrack = z.infer<typeof legalTrackSchema>;

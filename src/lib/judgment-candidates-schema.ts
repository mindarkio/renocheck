import { z } from "zod";

export const judgmentCandidateRowSchema = z.object({
  caseRef: z.string().min(3),
  eventDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partiesLine: z.string().min(1),
  neutralCitation: z.string().optional(),
  database: z.string().min(1),
  lrsListingUrl: z.string().url(),
  judgmentUrl: z.string().url().optional(),
  discoveredFrom: z.object({
    profileId: z.string(),
    tier: z.string(),
  }),
  fetchedAt: z.string().datetime(),
});

export const judgmentCandidatesManifestSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  policy: z.literal("no_serp_track1"),
  entryCount: z.number().int().nonnegative(),
  candidates: z.array(judgmentCandidateRowSchema),
});

export type JudgmentCandidateRow = z.infer<typeof judgmentCandidateRowSchema>;
export type JudgmentCandidatesManifest = z.infer<
  typeof judgmentCandidatesManifestSchema
>;

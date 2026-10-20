import { z } from "zod";

export const COMPANY_REPORT_FINGERPRINT_RE = /^[0-9a-f]{32}$/;

/** F1 accepts company_report only. quote_analysis is reserved. */
export const feedbackBodySchema = z.object({
  surface: z.literal("company_report"),
  reportRef: z.string().regex(COMPANY_REPORT_FINGERPRINT_RE),
  rating: z.enum(["up", "down"]),
  comment: z.string().max(500).optional(),
  placement: z.enum(["slide_in", "inline"]),
});

export type FeedbackBody = z.infer<typeof feedbackBodySchema>;

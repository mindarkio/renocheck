"use client";

import { FeedbackComposer } from "./FeedbackComposer";
import { FEEDBACK_COMPANY_HEADING_ZH } from "@/lib/feedback-copy-zh";

export function FeedbackInline({
  rating,
  comment,
  done,
  busy,
  onRating,
  onComment,
  onSubmit,
}: {
  rating: "up" | "down" | null;
  comment: string;
  done: boolean;
  busy?: boolean;
  onRating: (rating: "up" | "down") => void;
  onComment: (comment: string) => void;
  onSubmit: () => void;
}) {
  return (
    <section
      aria-label={FEEDBACK_COMPANY_HEADING_ZH}
      className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm"
    >
      <FeedbackComposer
        heading={FEEDBACK_COMPANY_HEADING_ZH}
        rating={rating}
        comment={comment}
        done={done}
        busy={busy}
        onRating={onRating}
        onComment={onComment}
        onSubmit={onSubmit}
      />
    </section>
  );
}

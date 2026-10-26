"use client";

import type { Ref } from "react";
import { FeedbackComposer } from "./FeedbackComposer";
import { FEEDBACK_COMPANY_HEADING_ZH } from "@/lib/feedback-copy-zh";

export function FeedbackInline({
  sectionRef,
  rating,
  comment,
  done,
  busy,
  error,
  announce,
  onRating,
  onComment,
  onSubmit,
  onChangeRating,
}: {
  sectionRef?: Ref<HTMLElement>;
  rating: "up" | "down" | null;
  comment: string;
  done: boolean;
  busy?: boolean;
  error?: string | null;
  announce?: boolean;
  onRating: (rating: "up" | "down") => void;
  onComment: (comment: string) => void;
  onSubmit: () => void;
  onChangeRating: () => void;
}) {
  return (
    <section
      ref={sectionRef}
      tabIndex={-1}
      aria-label={FEEDBACK_COMPANY_HEADING_ZH}
      className="rounded-xl border border-border bg-card px-4 py-4 shadow-sm"
    >
      <FeedbackComposer
        heading={FEEDBACK_COMPANY_HEADING_ZH}
        rating={rating}
        comment={comment}
        done={done}
        busy={busy}
        error={error}
        announce={announce}
        onRating={onRating}
        onComment={onComment}
        onSubmit={onSubmit}
        onChangeRating={onChangeRating}
      />
    </section>
  );
}

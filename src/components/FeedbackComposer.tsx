"use client";

import { useId } from "react";
import {
  FEEDBACK_COMMENT_MAX,
  FEEDBACK_DOWN_ZH,
  FEEDBACK_PLACEHOLDER_ZH,
  FEEDBACK_SUBMIT_ZH,
  FEEDBACK_THANKS_ZH,
  FEEDBACK_UP_ZH,
} from "@/lib/feedback-copy-zh";

const tap =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 disabled:opacity-60";

export function FeedbackComposer({
  heading,
  rating,
  comment,
  done,
  busy,
  onRating,
  onComment,
  onSubmit,
}: {
  heading: string;
  rating: "up" | "down" | null;
  comment: string;
  done: boolean;
  busy?: boolean;
  onRating: (rating: "up" | "down") => void;
  onComment: (comment: string) => void;
  onSubmit: () => void;
}) {
  const counterId = useId();

  if (done) {
    return (
      <p aria-live="polite" className="text-sm text-foreground">
        {FEEDBACK_THANKS_ZH}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-foreground">{heading}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`${tap} ${
            rating === "up"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-background text-foreground"
          }`}
          aria-pressed={rating === "up"}
          disabled={busy}
          onClick={() => onRating("up")}
        >
          {FEEDBACK_UP_ZH}
        </button>
        <button
          type="button"
          className={`${tap} ${
            rating === "down"
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-background text-foreground"
          }`}
          aria-pressed={rating === "down"}
          disabled={busy}
          onClick={() => onRating("down")}
        >
          {FEEDBACK_DOWN_ZH}
        </button>
      </div>
      {rating ? (
        <div className="space-y-2">
          <label className="block">
            <span className="sr-only">{FEEDBACK_PLACEHOLDER_ZH}</span>
            <textarea
              value={comment}
              maxLength={FEEDBACK_COMMENT_MAX}
              rows={3}
              placeholder={FEEDBACK_PLACEHOLDER_ZH}
              aria-describedby={counterId}
              disabled={busy}
              onChange={(event) => onComment(event.target.value)}
              className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
            />
          </label>
          <p id={counterId} className="text-xs text-muted-foreground">
            {comment.length}/{FEEDBACK_COMMENT_MAX}
          </p>
          <button
            type="button"
            className={`${tap} border-primary bg-primary text-primary-foreground`}
            disabled={busy}
            onClick={onSubmit}
          >
            {FEEDBACK_SUBMIT_ZH}
          </button>
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { useId, useLayoutEffect, useRef } from "react";
import Link from "next/link";
import {
  FEEDBACK_CHANGE_ZH,
  FEEDBACK_COMMENT_LABEL_ZH,
  FEEDBACK_COMMENT_MAX,
  FEEDBACK_DOWN_ZH,
  FEEDBACK_PLACEHOLDER_ZH,
  FEEDBACK_PRIVACY_HREF,
  FEEDBACK_PRIVACY_LINK_ZH,
  FEEDBACK_SUBMIT_ZH,
  FEEDBACK_THANKS_ZH,
  FEEDBACK_UP_ZH,
} from "@/lib/feedback-copy-zh";

const tap =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border px-3 text-sm font-medium transition-colors motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 disabled:opacity-60";

export function FeedbackComposer({
  heading,
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
  heading: string;
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
  const counterId = useId();
  const thanksRef = useRef<HTMLParagraphElement>(null);
  const upRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  const changeFocus = useRef(false);

  useLayoutEffect(() => {
    if (!done || !returnFocus.current) return;
    returnFocus.current = false;
    thanksRef.current?.focus();
  }, [done]);

  useLayoutEffect(() => {
    if (done || !changeFocus.current) return;
    changeFocus.current = false;
    upRef.current?.focus();
  }, [done]);

  return (
    <div className="space-y-3">
      <div aria-live={announce === false ? undefined : "polite"} className="space-y-2">
        {error ? <p className="text-sm text-foreground">{error}</p> : null}
        {done ? (
          <p
            ref={thanksRef}
            tabIndex={-1}
            className="text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            {FEEDBACK_THANKS_ZH}
          </p>
        ) : null}
      </div>
      {done ? (
        <button
          type="button"
          className={`${tap} border-border bg-background text-foreground`}
          onClick={() => {
            changeFocus.current = true;
            onChangeRating();
          }}
        >
          {FEEDBACK_CHANGE_ZH}
        </button>
      ) : (
        <>
      <p className="text-sm font-medium text-foreground">{heading}</p>
      <div className="flex flex-wrap gap-2">
        <button
          ref={upRef}
          type="button"
          className={`${tap} ${
            rating === "up"
              ? "border-primary bg-primary/10 font-semibold text-foreground"
              : "border-border bg-background text-foreground"
          }`}
          aria-pressed={rating === "up"}
          disabled={busy}
          onClick={() => onRating("up")}
        >
          {rating === "up" ? <span aria-hidden="true">✓ </span> : null}
          {FEEDBACK_UP_ZH}
        </button>
        <button
          type="button"
          className={`${tap} ${
            rating === "down"
              ? "border-primary bg-primary/10 font-semibold text-foreground"
              : "border-border bg-background text-foreground"
          }`}
          aria-pressed={rating === "down"}
          disabled={busy}
          onClick={() => onRating("down")}
        >
          {rating === "down" ? <span aria-hidden="true">✓ </span> : null}
          {FEEDBACK_DOWN_ZH}
        </button>
      </div>
      {rating ? (
        <div className="space-y-2">
          <label className="block space-y-2">
            <span className="text-sm text-foreground">{FEEDBACK_COMMENT_LABEL_ZH}</span>
            <textarea
              value={comment}
              maxLength={FEEDBACK_COMMENT_MAX}
              rows={3}
              placeholder={FEEDBACK_PLACEHOLDER_ZH}
              aria-describedby={counterId}
              disabled={busy}
              onChange={(event) => onComment(event.target.value)}
              className="w-full resize-y rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            />
          </label>
          <p id={counterId} className="text-xs text-muted-foreground">
            {comment.length}/{FEEDBACK_COMMENT_MAX}
          </p>
          <button
            type="button"
            className={`${tap} border-primary bg-primary text-primary-foreground`}
            disabled={busy}
            onClick={() => {
              returnFocus.current = true;
              onSubmit();
            }}
          >
            {FEEDBACK_SUBMIT_ZH}
          </button>
        </div>
      ) : null}
        </>
      )}
      <Link
        href={FEEDBACK_PRIVACY_HREF}
        className="inline-flex min-h-11 items-center text-xs text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      >
        {FEEDBACK_PRIVACY_LINK_ZH}
      </Link>
    </div>
  );
}

"use client";

import { useEffect, useId, useRef, useState } from "react";
import { FeedbackComposer } from "./FeedbackComposer";
import { reportReadingColumnClass } from "./report-column";
import {
  FEEDBACK_CLOSE_LABEL_ZH,
  FEEDBACK_COMPANY_HEADING_ZH,
  FEEDBACK_DISMISS_ZH,
  FEEDBACK_REGION_LABEL_ZH,
  FEEDBACK_THANKS_ZH,
} from "@/lib/feedback-copy-zh";

export function FeedbackSlideIn({
  open,
  rating,
  comment,
  done,
  busy,
  onRating,
  onComment,
  onSubmit,
  onDismiss,
}: {
  open: boolean;
  rating: "up" | "down" | null;
  comment: string;
  done: boolean;
  busy?: boolean;
  onRating: (rating: "up" | "down") => void;
  onComment: (comment: string) => void;
  onSubmit: () => void;
  onDismiss: () => void;
}) {
  const titleId = useId();
  const regionRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const [liftPx, setLiftPx] = useState<number | null>(null);

  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media?.matches) return;
    region.dataset.motion = "reduced";
    region.classList.remove("transition-transform", "duration-200", "ease-out");
  }, [open]);

  useEffect(() => {
    const live = liveRef.current;
    if (!open || !live || live.textContent) return;
    live.textContent = FEEDBACK_REGION_LABEL_ZH;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      const region = document.getElementById("report-feedback-slide");
      if (region && region.contains(document.activeElement)) onDismiss();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onDismiss]);

  useEffect(() => {
    if (!open) return;
    const cta = document.getElementById("report-new-search");
    if (!cta) return;
    const update = () => {
      const rect = cta.getBoundingClientRect();
      const inView = rect.top < window.innerHeight && rect.bottom > 0;
      if (!inView) {
        setLiftPx(null);
        return;
      }
      setLiftPx(Math.max(0, window.innerHeight - rect.top + 12));
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [open]);

  if (!open) return null;

  const bottom =
    liftPx == null
      ? "max(1rem, env(safe-area-inset-bottom))"
      : `max(${liftPx}px, 1rem, env(safe-area-inset-bottom))`;

  return (
    <div
      id="report-feedback-slide"
      role="region"
      aria-label={FEEDBACK_REGION_LABEL_ZH}
      ref={regionRef}
      data-motion="slide"
      className={`${reportReadingColumnClass} fixed z-20 rounded-xl border border-border bg-card p-4 shadow motion-reduce:transition-none transition-transform duration-200 ease-out`}
      style={{
        bottom,
        left: "1rem",
        right: "1rem",
        width: "auto",
        marginLeft: "auto",
        marginRight: "auto",
      }}
    >
      <p ref={liveRef} className="sr-only" aria-live="polite" />
      <div className="mb-2 flex items-start justify-end">
        <button
          type="button"
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          aria-label={FEEDBACK_CLOSE_LABEL_ZH}
          onClick={onDismiss}
        >
          ✕
        </button>
      </div>
      {done ? (
        <p id={titleId} aria-live="polite" className="text-sm text-foreground">
          {FEEDBACK_THANKS_ZH}
        </p>
      ) : (
        <FeedbackComposer
          heading={FEEDBACK_COMPANY_HEADING_ZH}
          rating={rating}
          comment={comment}
          done={false}
          busy={busy}
          onRating={onRating}
          onComment={onComment}
          onSubmit={onSubmit}
        />
      )}
      <button
        type="button"
        className="mt-3 inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        onClick={onDismiss}
      >
        {FEEDBACK_DISMISS_ZH}
      </button>
    </div>
  );
}

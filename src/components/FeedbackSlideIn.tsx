"use client";

import { useEffect, useRef, useState } from "react";
import { FeedbackComposer } from "./FeedbackComposer";
import {
  FEEDBACK_CLOSE_LABEL_ZH,
  FEEDBACK_COMPANY_HEADING_ZH,
  FEEDBACK_DISMISS_ZH,
  FEEDBACK_REGION_LABEL_ZH,
} from "@/lib/feedback-copy-zh";

export function FeedbackSlideIn({
  open,
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
  onDismiss,
}: {
  open: boolean;
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
  onDismiss: () => void;
}) {
  const regionRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef<HTMLParagraphElement>(null);
  const [liftPx, setLiftPx] = useState<number | null>(null);
  const [entered, setEntered] = useState(false);
  if (!open && entered) setEntered(false);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    const region = regionRef.current;
    if (!region) return;
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!media?.matches) return;
    region.dataset.motion = "reduced";
    region.classList.remove(
      "transition-[transform,opacity]",
      "duration-200",
      "ease-out",
      "translate-y-4",
      "opacity-0",
    );
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
      className={`mx-auto w-full max-w-[584px] fixed z-20 rounded-xl border border-border bg-card p-4 shadow-lg transition-[transform,opacity] duration-200 ease-out motion-reduce:translate-y-0 motion-reduce:opacity-100 motion-reduce:transition-none ${
        entered ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
      }`}
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
          className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-sm text-muted-foreground"
          aria-label={FEEDBACK_CLOSE_LABEL_ZH}
          onClick={onDismiss}
        >
          ✕
        </button>
      </div>
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
      <button
        type="button"
        className="mt-3 inline-flex min-h-11 items-center rounded-sm text-sm text-muted-foreground underline-offset-2 hover:underline"
        onClick={onDismiss}
      >
        {FEEDBACK_DISMISS_ZH}
      </button>
    </div>
  );
}

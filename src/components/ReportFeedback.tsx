"use client";

import { useEffect, useRef, useState } from "react";
import { FeedbackInline } from "./FeedbackInline";
import { FeedbackSlideIn } from "./FeedbackSlideIn";

const VISIBLE_MS = 40_000;
const TICK_MS = 1_000;
const THANKS_MS = 2_000;

type StorageValue = "shown" | "dismissed" | "submitted";

function storageKey(fingerprint: string): string {
  return `renocheck:fb:company_report:${fingerprint}`;
}

function readStorage(fingerprint: string): StorageValue | null {
  const key = storageKey(fingerprint);
  try {
    const local = localStorage.getItem(key);
    if (local === "shown" || local === "dismissed" || local === "submitted") {
      return local;
    }
  } catch {
    // private mode: sessionStorage below
  }
  try {
    const session = sessionStorage.getItem(key);
    if (
      session === "shown" ||
      session === "dismissed" ||
      session === "submitted"
    ) {
      return session;
    }
  } catch {
    return null;
  }
  return null;
}

function writeStorage(fingerprint: string, value: StorageValue): void {
  const key = storageKey(fingerprint);
  try {
    localStorage.setItem(key, value);
    return;
  } catch {
    // fall through
  }
  try {
    sessionStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function ReportFeedback({ fingerprint }: { fingerprint: string }) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [comment, setComment] = useState("");
  const [phase, setPhase] = useState<"editing" | "submitting" | "done">(() =>
    readStorage(fingerprint) === "submitted" ? "done" : "editing",
  );
  const [slideOpen, setSlideOpen] = useState(false);
  const [inlineUsed, setInlineUsed] = useState(false);
  const [storageBlock, setStorageBlock] = useState(() => {
    const stored = readStorage(fingerprint);
    return stored === "shown" || stored === "dismissed" || stored === "submitted";
  });

  const sentinelRef = useRef<HTMLDivElement>(null);
  const inlineRef = useRef<HTMLDivElement>(null);
  const inlineSectionRef = useRef<HTMLElement>(null);
  const inlineInView = useRef(true);
  const sentinelSeen = useRef(false);
  const timerReady = useRef(false);
  const slideOpenRef = useRef(false);

  function syncInlineInView() {
    const el = inlineRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;
    inlineInView.current = rect.bottom > 0 && rect.top < window.innerHeight;
  }

  function openSlide() {
    syncInlineInView();
    if (storageBlock || inlineUsed || phase === "done" || slideOpenRef.current) {
      return;
    }
    if (inlineInView.current) return;
    if (!sentinelSeen.current && !timerReady.current) return;
    slideOpenRef.current = true;
    setSlideOpen(true);
    writeStorage(fingerprint, "shown");
  }

  useEffect(() => {
    if (storageBlock || inlineUsed || phase === "done") return;
    const sentinel = sentinelRef.current;
    const inline = inlineRef.current;
    if (!sentinel || !inline) return;

    const sentinelObserver = new IntersectionObserver(
      (entries) => {
        sentinelSeen.current = entries.some(
          (entry) => entry.isIntersecting && entry.intersectionRatio >= 0.5,
        );
        openSlide();
      },
      { threshold: [0, 0.5, 1] },
    );
    const inlineObserver = new IntersectionObserver(
      (entries) => {
        inlineInView.current = entries.some(
          (entry) => entry.isIntersecting && entry.intersectionRatio > 0,
        );
        openSlide();
      },
      { threshold: [0, 0.01] },
    );
    sentinelObserver.observe(sentinel);
    inlineObserver.observe(inline);
    return () => {
      sentinelObserver.disconnect();
      inlineObserver.disconnect();
    };
    // openSlide closes over the latest fingerprint via writeStorage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageBlock, inlineUsed, phase, fingerprint]);

  useEffect(() => {
    if (storageBlock || inlineUsed || phase === "done" || slideOpen) return;
    let visibleMs = 0;
    const id = window.setInterval(() => {
      if (document.visibilityState === "hidden") return;
      visibleMs += TICK_MS;
      if (visibleMs >= VISIBLE_MS) {
        window.clearInterval(id);
        timerReady.current = true;
        openSlide();
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageBlock, inlineUsed, phase, slideOpen, fingerprint]);

  async function submit(placement: "inline" | "slide_in") {
    if (!rating || phase !== "editing") return;
    setPhase("submitting");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          surface: "company_report",
          reportRef: fingerprint,
          rating,
          ...(comment.trim() ? { comment } : {}),
          placement,
        }),
      });
      if (res.status === 204 || res.status === 404) {
        writeStorage(fingerprint, "submitted");
        setPhase("done");
        if (placement === "slide_in") {
          window.setTimeout(() => {
            const slide = document.getElementById("report-feedback-slide");
            if (slide?.contains(document.activeElement)) {
              inlineSectionRef.current?.focus();
            }
            slideOpenRef.current = false;
            setSlideOpen(false);
          }, THANKS_MS);
        }
        return;
      }
    } catch {
      // The page stays usable. The form remains so they can retry.
    }
    setPhase("editing");
  }

  function dismissSlide() {
    const slide = document.getElementById("report-feedback-slide");
    if (slide?.contains(document.activeElement)) {
      inlineSectionRef.current?.focus();
    }
    writeStorage(fingerprint, "dismissed");
    setStorageBlock(true);
    slideOpenRef.current = false;
    setSlideOpen(false);
  }

  return (
    <>
      <div
        ref={sentinelRef}
        data-feedback-sentinel=""
        className="h-px w-full"
        aria-hidden="true"
      />
      <div
        ref={inlineRef}
        data-feedback-inline=""
        className="mx-auto mt-8 w-full max-w-[584px] sm:mt-10"
      >
        <FeedbackInline
          sectionRef={inlineSectionRef}
          rating={rating}
          comment={comment}
          done={phase === "done"}
          busy={phase === "submitting"}
          onRating={(next) => {
            setInlineUsed(true);
            if (slideOpenRef.current) {
              slideOpenRef.current = false;
              setSlideOpen(false);
            }
            setRating(next);
          }}
          onComment={setComment}
          onSubmit={() => void submit("inline")}
        />
      </div>
      <FeedbackSlideIn
        open={slideOpen}
        rating={rating}
        comment={comment}
        done={phase === "done"}
        busy={phase === "submitting"}
        onRating={setRating}
        onComment={setComment}
        onSubmit={() => void submit("slide_in")}
        onDismiss={dismissSlide}
      />
    </>
  );
}

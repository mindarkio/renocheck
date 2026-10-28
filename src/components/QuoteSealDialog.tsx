"use client";

import { useEffect, useRef } from "react";
import { SignInForm } from "@/components/SignInForm";
import {
  QUOTE_SEAL_CLOSE_ZH,
  QUOTE_SEAL_MODAL_BODY_ZH,
  QUOTE_SEAL_MODAL_TITLE_ZH,
} from "@/lib/quote-analysis/copy";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function QuoteSealDialog({
  open,
  onClose,
  onVerified,
}: {
  open: boolean;
  onClose: () => void;
  onVerified: () => void | Promise<void>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const root = dialogRef.current;
    const focusables = () =>
      root ? [...root.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
    focusables()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusables();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/40 p-4 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-seal-title"
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-background p-5 shadow-lg motion-reduce:transition-none"
      >
        <h2 id="quote-seal-title" className="text-lg font-semibold text-primary">
          {QUOTE_SEAL_MODAL_TITLE_ZH}
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {QUOTE_SEAL_MODAL_BODY_ZH}
        </p>
        <SignInForm onVerified={onVerified} />
        <button
          type="button"
          onClick={onClose}
          className="mt-4 inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          {QUOTE_SEAL_CLOSE_ZH}
        </button>
      </div>
    </div>
  );
}

export function QuoteReportSkeleton() {
  return (
    <div aria-hidden="true" className="pointer-events-none mt-6 select-none blur-md motion-reduce:blur">
      <div className="h-5 w-2/3 rounded bg-muted" />
      <div className="mt-3 h-11 w-full rounded-lg bg-muted" />
      <div className="mt-4 space-y-3">
        <div className="h-4 w-full rounded bg-muted" />
        <div className="h-4 w-5/6 rounded bg-muted" />
        <div className="h-4 w-4/6 rounded bg-muted" />
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { SignInForm } from "@/components/SignInForm";
import {
  QUOTE_SEAL_CLOSE_ZH,
  QUOTE_SEAL_MODAL_BODY_ZH,
  QUOTE_SEAL_MODAL_TITLE_ZH,
  QUOTE_SEAL_REOPEN_ZH,
} from "@/lib/quote-analysis/copy";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function QuoteSealDialog({
  open,
  onClose,
  onAbandon,
  onVerified,
}: {
  open: boolean;
  /** Escape. Keeps the sealed result and the blurred placeholder. */
  onClose: () => void;
  /** Discards the sealed result and returns to an empty upload form. */
  onAbandon: () => void;
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
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/25 p-4 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-seal-title"
        className="max-h-[min(92vh,40rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-background px-5 py-6 shadow-lg motion-reduce:transition-none sm:px-6"
      >
        <h2 id="quote-seal-title" className="text-xl font-semibold leading-snug text-primary">
          {QUOTE_SEAL_MODAL_TITLE_ZH}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {QUOTE_SEAL_MODAL_BODY_ZH}
        </p>
        <SignInForm
          onVerified={onVerified}
          submitLabel={QUOTE_SEAL_REOPEN_ZH}
          onAbandon={onAbandon}
          abandonLabel={QUOTE_SEAL_CLOSE_ZH}
        />
      </div>
    </div>
  );
}

/** Generic report shape. No quotation text, name, or checklist result. */
export function QuoteReportSkeleton() {
  return (
    <div data-quote-report-skeleton="" className="space-y-5">
      <div className="h-8 w-1/2 rounded-md bg-foreground/15" />
      <div className="h-4 w-full rounded bg-foreground/10" />
      <div className="h-4 w-4/5 rounded bg-foreground/10" />
      <div className="rounded-xl border border-border bg-background p-4 shadow-sm">
        <div className="h-5 w-1/3 rounded bg-foreground/15" />
        <div className="mt-4 h-11 w-full rounded-lg bg-foreground/10" />
      </div>
      <div className="space-y-4 rounded-xl border border-border bg-background p-4 shadow-sm">
        {["a", "b", "c", "d", "e", "f"].map((row) => (
          <div key={row} className="space-y-2 border-b border-border/70 pb-3 last:border-b-0">
            <div className="h-4 w-2/5 rounded bg-foreground/15" />
            <div className="h-3 w-full rounded bg-foreground/10" />
            <div className="h-3 w-3/4 rounded bg-foreground/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

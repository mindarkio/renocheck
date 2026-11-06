"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { SignInForm } from "@/components/SignInForm";
import {
  QUOTE_VERIFY_ABANDON_ZH,
  QUOTE_VERIFY_MODAL_BODY_ZH,
  QUOTE_VERIFY_MODAL_TITLE_ZH,
  QUOTE_VERIFY_REOPEN_ZH,
} from "@/lib/quote-analysis/copy";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function QuoteVerifyDialog({
  open,
  onClose,
  onAbandon,
  onVerified,
  verified = false,
  pending = false,
  error = null,
  pendingLabel,
}: {
  open: boolean;
  /** Escape. Keeps the company search result and the blurred placeholder. */
  onClose: () => void;
  /** Discards the file and the confirmed name and returns to an empty upload form. */
  onAbandon: () => void;
  onVerified: () => void | Promise<void>;
  /** Email already verified (for example the analysis then failed): retry the analysis without a new code. */
  verified?: boolean;
  pending?: boolean;
  /** Analysis error. Shown inside the dialog because the upload form is hidden after the name step. */
  error?: string | null;
  pendingLabel?: string;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const retryRef = useRef<HTMLButtonElement>(null);
  // Keep the latest handler without re-running the focus effect on every parent render.
  const onCloseRef = useRef(onClose);
  useLayoutEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Layout effect: the trap and Escape handler are live in the same commit that shows the dialog.
  useLayoutEffect(() => {
    if (!open) return;
    const root = dialogRef.current;
    const focusables = () =>
      root ? [...root.querySelectorAll<HTMLElement>(FOCUSABLE)] : [];
    focusables()[0]?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
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
  }, [open]);

  // The sign-in form unmounts once the email is verified; keep focus inside the dialog.
  useEffect(() => {
    if (open && verified && !pending) retryRef.current?.focus();
  }, [open, verified, pending]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-foreground/25 p-4 sm:items-center">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quote-verify-title"
        className="max-h-[min(92vh,40rem)] w-full max-w-md overflow-y-auto rounded-2xl bg-background px-5 py-6 shadow-lg motion-reduce:transition-none sm:px-6"
      >
        <h2 id="quote-verify-title" className="text-xl font-semibold leading-snug text-primary">
          {QUOTE_VERIFY_MODAL_TITLE_ZH}
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
          {QUOTE_VERIFY_MODAL_BODY_ZH}
        </p>
        {pending && pendingLabel ? (
          <p className="mt-4 text-sm text-muted-foreground" role="status">
            {pendingLabel}
          </p>
        ) : null}
        {error ? (
          <p className="mt-4 text-sm leading-relaxed text-[var(--brand-coral-emphasis)]" role="alert">
            {error}
          </p>
        ) : null}
        {verified ? (
          <div className="mt-6 space-y-3">
            <button
              ref={retryRef}
              type="button"
              onClick={() => void onVerified()}
              disabled={pending}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {QUOTE_VERIFY_REOPEN_ZH}
            </button>
            <div className="flex justify-center">
              <button
                type="button"
                onClick={onAbandon}
                className="inline-flex min-h-11 items-center justify-center px-3 text-sm text-muted-foreground underline-offset-2 hover:underline"
              >
                {QUOTE_VERIFY_ABANDON_ZH}
              </button>
            </div>
          </div>
        ) : (
          <SignInForm
            onVerified={onVerified}
            submitLabel={QUOTE_VERIFY_REOPEN_ZH}
            onAbandon={onAbandon}
            abandonLabel={QUOTE_VERIFY_ABANDON_ZH}
          />
        )}
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

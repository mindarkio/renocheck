"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  QUOTE_ACK_ERROR_ZH,
  QUOTE_ACK_LABEL_ZH,
  QUOTE_ANALYSING_ZH,
  QUOTE_FAILED_ZH,
  QUOTE_FILE_HINT_ZH,
  QUOTE_FILE_LABEL_ZH,
  QUOTE_SUBMIT_ZH,
  QUOTE_UPLOAD_NOTICE_ZH,
} from "@/lib/quote-analysis/copy";

export function QuoteAnalysisForm() {
  const router = useRouter();
  const checkboxRef = useRef<HTMLInputElement>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!acknowledged) {
      setError(QUOTE_ACK_ERROR_ZH);
      checkboxRef.current?.focus();
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    data.set("acknowledged", "1");
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/quote/analyze", { method: "POST", body: data });
      const body = (await res.json().catch(() => null)) as {
        id?: string;
        message?: string;
      } | null;
      if (!res.ok || !body?.id) {
        setError(body?.message ?? QUOTE_FAILED_ZH);
        return;
      }
      router.push(`/quote/analyses/${body.id}`);
      router.refresh();
    } catch {
      setError(QUOTE_FAILED_ZH);
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">{QUOTE_UPLOAD_NOTICE_ZH}</p>
      <div>
        <label htmlFor="quote-pdf" className="text-sm font-medium text-foreground">
          {QUOTE_FILE_LABEL_ZH}
        </label>
        <input
          id="quote-pdf"
          name="file"
          type="file"
          accept="application/pdf"
          required
          className="mt-1 block w-full min-h-11 text-sm file:mr-3 file:min-h-11 file:rounded-md file:border-0 file:bg-primary file:px-3 file:text-sm file:font-medium file:text-primary-foreground"
        />
        <p className="mt-1 text-sm text-muted-foreground">{QUOTE_FILE_HINT_ZH}</p>
      </div>
      <label className="flex min-h-11 items-start gap-3 text-sm text-foreground">
        <input
          ref={checkboxRef}
          id="quote-ack"
          type="checkbox"
          name="acknowledged"
          value="1"
          checked={acknowledged}
          onChange={(event) => {
            setAcknowledged(event.target.checked);
            setError(null);
          }}
          required
          className="mt-1 size-5 shrink-0"
          aria-describedby={error ? "quote-ack-error" : undefined}
        />
        <span>{QUOTE_ACK_LABEL_ZH}</span>
      </label>
      {error ? (
        <p id="quote-ack-error" className="text-sm text-[var(--brand-coral-emphasis)]" role="alert">
          {error}
        </p>
      ) : null}
      {pending ? (
        <p className="text-sm text-muted-foreground" role="status">
          {QUOTE_ANALYSING_ZH}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60"
      >
        {QUOTE_SUBMIT_ZH}
      </button>
    </form>
  );
}

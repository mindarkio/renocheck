"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore } from "react";
import { SignInForm } from "@/components/SignInForm";
import { holdQuoteCompanyName } from "@/lib/quote-analysis/company-name-handoff";
import {
  QUOTE_ACK_ERROR_ZH,
  QUOTE_ACK_LABEL_ZH,
  QUOTE_ANALYSING_ZH,
  QUOTE_FAILED_ZH,
  QUOTE_FILE_HINT_ZH,
  QUOTE_FILE_LABEL_ZH,
  QUOTE_FILE_RESELECT_ZH,
  QUOTE_LOGIN_AFTER_FILE_ZH,
  QUOTE_PICK_FIRST_ZH,
  QUOTE_SUBMIT_ZH,
  QUOTE_UPLOAD_NOTICE_ZH,
} from "@/lib/quote-analysis/copy";

/** Flag only. The PDF stays in component state and is never written here. */
export const QUOTE_FILE_PENDING_KEY = "renocheck:quote-upload-pending";

function readPendingFlag(): boolean {
  try {
    return sessionStorage.getItem(QUOTE_FILE_PENDING_KEY) === "1";
  } catch {
    return false;
  }
}

function writePendingFlag(): void {
  try {
    sessionStorage.setItem(QUOTE_FILE_PENDING_KEY, "1");
  } catch {
    // Private mode can block storage. The file is still only in memory.
  }
}

function clearPendingFlag(): void {
  try {
    sessionStorage.removeItem(QUOTE_FILE_PENDING_KEY);
  } catch {
    // ignore
  }
}

export function QuoteAnalysisForm({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const checkboxRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<File | null>(null);
  const ackRef = useRef(false);
  const authedRef = useRef(signedIn);
  const [file, setFile] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [authed, setAuthed] = useState(signedIn);
  const pendingFlag = useSyncExternalStore(
    () => () => {},
    readPendingFlag,
    () => false,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function rememberFile(next: File | null) {
    fileRef.current = next;
    setFile(next);
    if (next) writePendingFlag();
  }

  async function submitAnalysis() {
    if (!authedRef.current) return;
    if (!ackRef.current) {
      setError(QUOTE_ACK_ERROR_ZH);
      checkboxRef.current?.focus();
      return;
    }
    const chosen = fileRef.current;
    if (!chosen) return;
    const data = new FormData();
    data.set("file", chosen);
    data.set("acknowledged", "1");
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/quote/analyze", { method: "POST", body: data });
      const body = (await res.json().catch(() => null)) as {
        id?: string;
        companyName?: string | null;
        message?: string;
      } | null;
      if (!res.ok || !body?.id) {
        setError(body?.message ?? QUOTE_FAILED_ZH);
        return;
      }
      clearPendingFlag();
      holdQuoteCompanyName(
        body.id,
        typeof body.companyName === "string" ? body.companyName : null,
      );
      router.push(`/quote/analyses/${body.id}`);
      router.refresh();
    } catch {
      setError(QUOTE_FAILED_ZH);
    } finally {
      setPending(false);
    }
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAnalysis();
  }

  async function afterLogin() {
    authedRef.current = true;
    setAuthed(true);
    await submitAnalysis();
  }

  return (
    <div className="mt-6 space-y-4">
      {pendingFlag && !file ? (
        <p className="text-sm leading-relaxed text-foreground" role="status">
          {QUOTE_FILE_RESELECT_ZH}
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{QUOTE_UPLOAD_NOTICE_ZH}</p>
        {!signedIn && !file ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{QUOTE_PICK_FIRST_ZH}</p>
        ) : null}
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
            onChange={(event) => {
              rememberFile(event.target.files?.[0] ?? null);
            }}
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
              ackRef.current = event.target.checked;
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
        {authed ? (
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {QUOTE_SUBMIT_ZH}
          </button>
        ) : null}
      </form>
      {!authed && file ? (
        <div>
          <p className="text-sm leading-relaxed text-muted-foreground">{QUOTE_LOGIN_AFTER_FILE_ZH}</p>
          <SignInForm onVerified={afterLogin} />
        </div>
      ) : null}
    </div>
  );
}

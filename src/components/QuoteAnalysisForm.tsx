"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { QuoteCompanyConfirm } from "@/components/QuoteCompanyConfirm";
import { QuoteReportSkeleton, QuoteSealDialog } from "@/components/QuoteSealDialog";
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
  QUOTE_SEAL_EXPIRED_ZH,
  QUOTE_SEAL_REOPEN_ZH,
  QUOTE_SUBMIT_ZH,
  QUOTE_UPLOAD_NOTICE_ZH,
} from "@/lib/quote-analysis/copy";

/** Flag only. The PDF and the sealed blob stay in component state. */
export const QUOTE_FILE_PENDING_KEY = "renocheck:quote-upload-pending";
const SEAL_PENDING_KEY = "renocheck:quote-seal-pending";

function readFlag(key: string): boolean {
  try {
    return sessionStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    sessionStorage.setItem(key, "1");
  } catch {
    // Private mode can block storage. Nothing sensitive is written.
  }
}

function clearFlag(key: string): void {
  try {
    sessionStorage.removeItem(key);
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
  const anonymousRef = useRef(false);
  const sealedRef = useRef<string | null>(null);
  const inFlight = useRef(false);
  const [file, setFile] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [authed, setAuthed] = useState(signedIn);
  const [anonymous, setAnonymous] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [sealed, setSealed] = useState(false);
  const pendingFile = useSyncExternalStore(
    () => () => {},
    () => readFlag(QUOTE_FILE_PENDING_KEY),
    () => false,
  );
  const sealWasOpen = useSyncExternalStore(
    () => () => {},
    () => readFlag(SEAL_PENDING_KEY),
    () => false,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [claimed, setClaimed] = useState<{
    id: string;
    items: Array<{ id: string; label: string; status: string; finding: string }>;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    const pending = fetch("/api/quote/availability");
    if (!pending || typeof pending.then !== "function") return;
    pending
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { anonymous?: boolean } | null) => {
        if (!cancelled && data?.anonymous === true) {
          anonymousRef.current = true;
          setAnonymous(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function rememberFile(next: File | null) {
    fileRef.current = next;
    setFile(next);
    if (next) writeFlag(QUOTE_FILE_PENDING_KEY);
  }

  async function submitAnalysis() {
    if (inFlight.current) return;
    if (!ackRef.current) {
      setError(QUOTE_ACK_ERROR_ZH);
      checkboxRef.current?.focus();
      return;
    }
    const chosen = fileRef.current;
    if (!chosen) return;
    if (!authedRef.current && !anonymousRef.current) return;
    inFlight.current = true;
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
        sealed?: string;
        message?: string;
      } | null;
      if (!res.ok || (!body?.id && !body?.sealed)) {
        setError(body?.message ?? QUOTE_FAILED_ZH);
        return;
      }
      clearFlag(QUOTE_FILE_PENDING_KEY);
      if (body.sealed && !body.id) {
        sealedRef.current = body.sealed;
        writeFlag(SEAL_PENDING_KEY);
        setSealed(true);
        setModalOpen(true);
        return;
      }
      if (body.id) {
        clearFlag(SEAL_PENDING_KEY);
        holdQuoteCompanyName(
          body.id,
          typeof body.companyName === "string" ? body.companyName : null,
        );
        router.push(`/quote/analyses/${body.id}`);
        router.refresh();
      }
    } catch {
      setError(QUOTE_FAILED_ZH);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  async function claimSealed() {
    const blob = sealedRef.current;
    if (!blob || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError(null);
    try {
      const res = await fetch("/api/quote/claim", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sealed: blob }),
      });
      const body = (await res.json().catch(() => null)) as {
        id?: string;
        companyName?: string | null;
        items?: Array<{ id: string; label: string; status: string; finding: string }>;
        message?: string;
      } | null;
      if (!res.ok || !body?.id) {
        setError(body?.message ?? QUOTE_FAILED_ZH);
        return;
      }
      clearFlag(SEAL_PENDING_KEY);
      sealedRef.current = null;
      setSealed(false);
      setModalOpen(false);
      holdQuoteCompanyName(
        body.id,
        typeof body.companyName === "string" ? body.companyName : null,
      );
      setClaimed({ id: body.id, items: body.items ?? [] });
    } catch {
      setError(QUOTE_FAILED_ZH);
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }

  function maybeAutoRun() {
    if (!ackRef.current || !fileRef.current) return;
    if (authedRef.current || anonymousRef.current) void submitAnalysis();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await submitAnalysis();
  }

  async function afterLogin() {
    authedRef.current = true;
    setAuthed(true);
    if (sealedRef.current) {
      setModalOpen(false);
      await claimSealed();
      return;
    }
    await submitAnalysis();
  }

  const showExpired = sealWasOpen && !sealed;

  return (
    <div className="mt-6 space-y-4">
      {showExpired ? (
        <p className="text-sm leading-relaxed text-foreground" role="status">
          {QUOTE_SEAL_EXPIRED_ZH}
        </p>
      ) : null}
      {pendingFile && !file && !showExpired ? (
        <p className="text-sm leading-relaxed text-foreground" role="status">
          {QUOTE_FILE_RESELECT_ZH}
        </p>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-4">
        <p className="text-sm leading-relaxed text-muted-foreground">{QUOTE_UPLOAD_NOTICE_ZH}</p>
        {!signedIn && !anonymous && !file ? (
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
              maybeAutoRun();
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
              if (event.target.checked) maybeAutoRun();
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
        {authed && !anonymous ? (
          <button
            type="submit"
            disabled={pending}
            className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {QUOTE_SUBMIT_ZH}
          </button>
        ) : null}
      </form>
      {!authed && !anonymous && file ? (
        <div>
          <p className="text-sm leading-relaxed text-muted-foreground">{QUOTE_LOGIN_AFTER_FILE_ZH}</p>
          <SignInForm onVerified={afterLogin} />
        </div>
      ) : null}
      {claimed ? (
        <div>
          <QuoteCompanyConfirm analysisId={claimed.id} />
          <ol className="mt-8 space-y-4">
            {claimed.items.map((item) => (
              <li key={item.id} className="text-sm leading-relaxed">
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="mt-1 text-muted-foreground">{item.finding}</p>
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {sealed ? (
        <>
          <QuoteReportSkeleton />
          {modalOpen ? null : (
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              {QUOTE_SEAL_REOPEN_ZH}
            </button>
          )}
          <QuoteSealDialog
            open={modalOpen}
            onClose={() => setModalOpen(false)}
            onVerified={afterLogin}
          />
        </>
      ) : null}
    </div>
  );
}

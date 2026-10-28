"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { QuoteCompanyConfirm } from "@/components/QuoteCompanyConfirm";
import { QuoteReportSkeleton, QuoteSealDialog } from "@/components/QuoteSealDialog";
import { holdQuoteCompanyName } from "@/lib/quote-analysis/company-name-handoff";
import {
  QUOTE_ACK_ERROR_ZH,
  QUOTE_ACK_LABEL_ZH,
  QUOTE_ANALYSIS_LOCKED_ZH,
  QUOTE_ANALYSIS_SECTION_ZH,
  QUOTE_ANALYSIS_VERIFY_CTA_ZH,
  QUOTE_ANALYSING_ZH,
  QUOTE_FAILED_ZH,
  QUOTE_FILE_HINT_ZH,
  QUOTE_FILE_LABEL_ZH,
  QUOTE_FILE_RESELECT_ZH,
  QUOTE_RESULT_LEAD_ZH,
  QUOTE_SUBMIT_ZH,
  QUOTE_UPLOAD_NOTICE_ZH,
} from "@/lib/quote-analysis/copy";

/** Flag only. The PDF stays in component state. */
export const QUOTE_FILE_PENDING_KEY = "renocheck:quote-upload-pending";

type ChecklistItem = { id: string; label: string; status: string; finding: string };

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
  const inFlight = useRef(false);
  const flowEpoch = useRef(0);
  const requestAbort = useRef<AbortController | null>(null);
  const confirmedRef = useRef<string | null>(null);
  const reopenRef = useRef<HTMLButtonElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [authed, setAuthed] = useState(signedIn);
  const [modalOpen, setModalOpen] = useState(false);
  const pendingFile = useSyncExternalStore(
    () => () => {},
    () => readFlag(QUOTE_FILE_PENDING_KEY),
    () => false,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [extracted, setExtracted] = useState<string | null | undefined>(undefined);
  const [searchReady, setSearchReady] = useState(false);
  const [reportItems, setReportItems] = useState<ChecklistItem[] | null>(null);

  useEffect(() => {
    authedRef.current = signedIn;
  }, [signedIn]);

  function rememberFile(next: File | null) {
    fileRef.current = next;
    setFile(next);
    if (next) writeFlag(QUOTE_FILE_PENDING_KEY);
  }

  async function postPdf(mode: "extract" | "full") {
    if (!ackRef.current) {
      setError(QUOTE_ACK_ERROR_ZH);
      checkboxRef.current?.focus();
      return null;
    }
    const chosen = fileRef.current;
    if (!chosen || inFlight.current) return null;
    const epoch = flowEpoch.current;
    const abort = new AbortController();
    requestAbort.current = abort;
    inFlight.current = true;
    setPending(true);
    setError(null);
    const data = new FormData();
    data.set("file", chosen);
    data.set("acknowledged", "1");
    if (mode === "full") {
      if (confirmedRef.current) data.set("confirmedCompanyName", confirmedRef.current);
    }
    try {
      const res = await fetch("/api/quote/analyze", {
        method: "POST",
        body: data,
        signal: abort.signal,
      });
      if (epoch !== flowEpoch.current) return null;
      const body = (await res.json().catch(() => null)) as {
        id?: string;
        companyName?: string | null;
        items?: ChecklistItem[];
        message?: string;
      } | null;
      if (!res.ok || !body) {
        setError(body?.message ?? QUOTE_FAILED_ZH);
        return null;
      }
      return body;
    } catch {
      if (epoch === flowEpoch.current) setError(QUOTE_FAILED_ZH);
      return null;
    } finally {
      if (requestAbort.current === abort) requestAbort.current = null;
      if (epoch === flowEpoch.current) {
        inFlight.current = false;
        setPending(false);
      }
    }
  }

  async function submitExtraction() {
    const body = await postPdf("extract");
    if (!body) return;
    if (body.id) {
      // The server saw a session (for example a sign-in in another tab) and ran the full analysis.
      authedRef.current = true;
      setAuthed(true);
      showFull(body, true);
      return;
    }
    clearFlag(QUOTE_FILE_PENDING_KEY);
    const name = typeof body.companyName === "string" ? body.companyName : null;
    setExtracted(name);
  }

  async function submitFull(navigate: boolean) {
    const body = await postPdf("full");
    if (!body) return;
    if (!body.id) {
      if (!("items" in body) && "companyName" in body && !body.message) {
        // Name-only reply: the session is gone, so the server treated this as logged out.
        authedRef.current = false;
        setAuthed(false);
        setModalOpen(true);
      }
      // A 200 without a row (for example not_quotation) still carries a message.
      setError(body.message ?? QUOTE_FAILED_ZH);
      return;
    }
    showFull(body, navigate);
  }

  function showFull(
    body: { id?: string; companyName?: string | null; items?: ChecklistItem[] },
    navigate: boolean,
  ) {
    if (!body.id) return;
    clearFlag(QUOTE_FILE_PENDING_KEY);
    holdQuoteCompanyName(body.id, typeof body.companyName === "string" ? body.companyName : null);
    if (navigate) {
      router.push(`/quote/analyses/${body.id}`);
      router.refresh();
      return;
    }
    setModalOpen(false);
    setReportItems(body.items ?? []);
  }

  function maybeAutoRun() {
    if (!ackRef.current || !fileRef.current || extracted !== undefined) return;
    if (authedRef.current) void submitFull(true);
    else void submitExtraction();
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (authedRef.current) await submitFull(true);
  }

  function abandonAnalysis() {
    flowEpoch.current += 1;
    requestAbort.current?.abort();
    requestAbort.current = null;
    inFlight.current = false;
    fileRef.current = null;
    ackRef.current = false;
    confirmedRef.current = null;
    clearFlag(QUOTE_FILE_PENDING_KEY);
    setFile(null);
    setAcknowledged(false);
    setExtracted(undefined);
    setSearchReady(false);
    setReportItems(null);
    setModalOpen(false);
    setError(null);
    setPending(false);
    requestAnimationFrame(() => document.getElementById("quote-pdf")?.focus());
  }

  const epochAtRender = flowEpoch.current;

  async function afterLogin() {
    if (flowEpoch.current !== epochAtRender) return;
    authedRef.current = true;
    setAuthed(true);
    if (flowEpoch.current !== epochAtRender) return;
    if (!fileRef.current) {
      setError(QUOTE_FILE_RESELECT_ZH);
      return;
    }
    await submitFull(false);
  }

  const showConfirm = extracted !== undefined;

  return (
    <div className="mt-6 space-y-4">
      {pendingFile && !file && extracted === undefined ? (
        <p className="text-sm leading-relaxed text-foreground" role="status">
          {QUOTE_FILE_RESELECT_ZH}
        </p>
      ) : null}
      {showConfirm ? null : (
        <form onSubmit={onSubmit} className="space-y-4">
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
              aria-describedby={error && !modalOpen ? "quote-ack-error" : undefined}
            />
            <span>{QUOTE_ACK_LABEL_ZH}</span>
          </label>
          {error && !modalOpen ? (
            <p id="quote-ack-error" className="text-sm text-[var(--brand-coral-emphasis)]" role="alert">
              {error}
            </p>
          ) : null}
          {pending && !modalOpen ? (
            <p className="text-sm text-muted-foreground" role="status">
              {QUOTE_ANALYSING_ZH}
            </p>
          ) : null}
          {signedIn ? (
            <button
              type="submit"
              disabled={pending}
              className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {QUOTE_SUBMIT_ZH}
            </button>
          ) : null}
        </form>
      )}
      {showConfirm ? (
        <QuoteCompanyConfirm
          analysisId="pending"
          extractedFromServer={extracted}
          deferPersist
          onConfirmed={(companyName) => {
            confirmedRef.current = companyName;
          }}
          onReport={() => setSearchReady(true)}
        />
      ) : null}
      {showConfirm && searchReady && !reportItems ? (
        <section className="mt-8" aria-label={QUOTE_ANALYSIS_SECTION_ZH}>
          <h2 className="text-sm font-semibold text-primary">{QUOTE_ANALYSIS_SECTION_ZH}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{QUOTE_ANALYSIS_LOCKED_ZH}</p>
          <div className="pointer-events-none mt-4 select-none blur-sm motion-reduce:blur-none" aria-hidden="true">
            <QuoteReportSkeleton />
          </div>
          <button
            ref={reopenRef}
            type="button"
            onClick={() => setModalOpen(true)}
            className="mt-4 inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            {QUOTE_ANALYSIS_VERIFY_CTA_ZH}
          </button>
        </section>
      ) : null}
      {reportItems ? (
        <section className="mt-8" aria-label={QUOTE_ANALYSIS_SECTION_ZH}>
          <h2 className="text-sm font-semibold text-primary">{QUOTE_ANALYSIS_SECTION_ZH}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{QUOTE_RESULT_LEAD_ZH}</p>
          <ol className="mt-4 space-y-4">
            {reportItems.map((item) => (
              <li key={item.id} className="text-sm leading-relaxed">
                <p className="font-medium text-foreground">{item.label}</p>
                <p className="mt-1 text-muted-foreground">{item.finding}</p>
              </li>
            ))}
          </ol>
        </section>
      ) : null}
      <QuoteSealDialog
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          requestAnimationFrame(() => reopenRef.current?.focus());
        }}
        onAbandon={abandonAnalysis}
        onVerified={afterLogin}
        verified={authed && !signedIn}
        pending={pending}
        error={modalOpen ? error : null}
        pendingLabel={QUOTE_ANALYSING_ZH}
      />
    </div>
  );
}

"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { RegisterMatchPanel } from "@/components/RegisterMatchPanel";
import { ReportCard } from "@/components/ReportCard";
import { SearchProgressModal } from "@/components/SearchProgress";
import { getOrCreateAnonId } from "@/lib/anon-id";
import { classifyCompanyNameQuery } from "@/lib/company-query-gate";
import { readQuoteCompanyName } from "@/lib/quote-analysis/company-name-handoff";
import {
  QUOTE_COMPANY_CONFIRM_ZH,
  QUOTE_COMPANY_HOLD_ZH,
  QUOTE_COMPANY_LABEL_ZH,
  QUOTE_COMPANY_MISSING_ZH,
  QUOTE_COMPANY_NEED_NAME_ZH,
  QUOTE_COMPANY_RESULT_HEADING_ZH,
  QUOTE_VERIFY_EXPIRED_ZH,
  quoteCompanyFoundZh,
} from "@/lib/quote-analysis/copy";
import { COMPANY_NAME_MAX_LENGTH, type RiskReport } from "@/lib/report-schema";
import {
  decideRegisterCandidateGate,
  type PublicMwcCandidate,
} from "@/lib/register-candidate-gate";
import {
  CONTINUE_AS_COMPANY_ZH,
  REGISTER_LOADING_LABEL_ZH,
  REGISTER_LOADING_ZH,
  personalNameMessageZh,
  shortCompanyNameMessageZh,
} from "@/lib/search-disambiguation-copy";

const REPORT_RETRY_ZH = "報告未能顯示，請稍後再試。";
const SERVICE_PAUSED_ZH = "用戶擁擠，系統暫停服務，請稍後再試";
const RATE_LIMIT_ZH = "查詢過於頻繁，請稍後再試。";

const PIPELINE_ERROR_ZH: Record<string, string> = {
  supabase_unavailable: REPORT_RETRY_ZH,
  serp_unavailable: REPORT_RETRY_ZH,
  serp_failed: "報告未能顯示：公開搜尋暫時失敗，請稍後再試。",
  llm_unavailable: REPORT_RETRY_ZH,
  llm_failed: "報告未能顯示：AI 摘要暫時失敗，請稍後再試。",
  llm_busy: SERVICE_PAUSED_ZH,
  service_paused: SERVICE_PAUSED_ZH,
  search_failed: REPORT_RETRY_ZH,
};

type NameNotice = {
  kind: "short" | "personal";
  input: string;
  allowCompanyOverride: boolean;
};

type MatchPanel =
  | { kind: "picker"; input: string; candidates: PublicMwcCandidate[] }
  | { kind: "too_many"; input: string }
  | { kind: "register_error"; input: string };

type SearchBody = {
  companyName: string;
  mwcRegistrationNo?: string;
};

function isRiskReport(value: unknown): value is RiskReport {
  if (!value || typeof value !== "object") return false;
  const entity = (value as { entity?: { displayName?: unknown } }).entity;
  return typeof entity?.displayName === "string" && entity.displayName.length > 0;
}

const fieldClass =
  "mt-1 w-full min-h-11 rounded-lg border border-border bg-background px-3 text-base text-foreground";

const UNKNOWN_NAME = "\u0001";
const PENDING_NAME = "\u0000";

export function QuoteCompanyConfirm({
  analysisId,
  extractedFromServer,
  deferPersist = false,
  onConfirmed,
  onReport,
}: {
  analysisId: string;
  /** Undefined when this view does not know whether a name was extracted. */
  extractedFromServer?: string | null;
  /** Skip the authenticated name write. Used before a checklist row exists. */
  deferPersist?: boolean;
  onConfirmed?: (companyName: string) => void;
  onReport?: () => void;
}) {
  const storedName = useSyncExternalStore(
    () => () => {},
    () => {
      const held = readQuoteCompanyName(analysisId);
      if (held.present) return held.name ?? "";
      if (extractedFromServer === undefined) return UNKNOWN_NAME;
      return extractedFromServer ?? "";
    },
    () => PENDING_NAME,
  );
  const [draft, setDraft] = useState<string | null>(null);
  const known = storedName !== PENDING_NAME && storedName !== UNKNOWN_NAME;
  const name = draft ?? (known ? storedName : "");
  const extracted = known && storedName ? storedName : null;
  const [message, setMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<NameNotice | null>(null);
  const [panel, setPanel] = useState<MatchPanel | null>(null);
  const [report, setReport] = useState<RiskReport | null>(null);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [progressStartedAt, setProgressStartedAt] = useState<number | null>(null);
  const reportInFlight = useRef(false);

  function clearGates() {
    setNotice(null);
    setPanel(null);
    setMessage(null);
  }

  async function rememberConfirmed(companyName: string) {
    onConfirmed?.(companyName);
    if (deferPersist) return;
    try {
      await fetch("/api/quote/company-name", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ analysisId, companyName }),
      });
    } catch {
      // The search still runs. A missing column is not a search failure.
    }
  }

  async function runReport(body: SearchBody) {
    if (reportInFlight.current) return;
    await rememberConfirmed(body.companyName);
    reportInFlight.current = true;
    setProgressStartedAt(Date.now());
    setMessage(null);
    try {
      const anonId = getOrCreateAnonId();
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(anonId ? { ...body, anonId } : body),
      });
      if (res.status === 429) {
        setMessage(RATE_LIMIT_ZH);
        return;
      }
      if (!res.ok) {
        let code = "search_failed";
        try {
          const errBody = (await res.json()) as { error?: string };
          if (errBody.error) code = errBody.error;
        } catch {
          // ignore
        }
        setMessage(PIPELINE_ERROR_ZH[code] ?? PIPELINE_ERROR_ZH.search_failed);
        return;
      }
      const data = (await res.json()) as { report?: unknown };
      if (!isRiskReport(data.report)) {
        setMessage(REPORT_RETRY_ZH);
        return;
      }
      setReport(data.report);
      onReport?.();
    } catch {
      setMessage("網絡錯誤，請稍後再試。");
    } finally {
      reportInFlight.current = false;
      setProgressStartedAt(null);
    }
  }

  async function previewRegister(companyName: string) {
    await rememberConfirmed(companyName);
    setRegisterLoading(true);
    setNotice(null);
    setPanel(null);
    setMessage(null);
    let reportBody: SearchBody | null = null;
    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preview: "register", companyName }),
      });
      if (res.status === 429) {
        setMessage(RATE_LIMIT_ZH);
        return;
      }
      if (!res.ok) {
        setPanel({ kind: "register_error", input: companyName });
        return;
      }
      const data = (await res.json()) as {
        matchCount?: number;
        windowFull?: boolean;
        candidates?: PublicMwcCandidate[];
      };
      const gate = decideRegisterCandidateGate({
        matchCount: data.matchCount ?? 0,
        windowFull: data.windowFull === true,
      });
      if (gate === "too_many") {
        setPanel({ kind: "too_many", input: companyName });
        return;
      }
      if (gate === "picker") {
        setPanel({
          kind: "picker",
          input: companyName,
          candidates: data.candidates ?? [],
        });
        return;
      }
      reportBody = { companyName };
    } catch {
      setPanel({ kind: "register_error", input: companyName });
    } finally {
      setRegisterLoading(false);
    }
    if (reportBody) await runReport(reportBody);
  }

  async function confirmName(raw: string) {
    if (registerLoading || reportInFlight.current) return;
    const trimmed = raw.trim();
    if (!trimmed) {
      setNotice(null);
      setPanel(null);
      setMessage(QUOTE_COMPANY_NEED_NAME_ZH);
      return;
    }
    const gate = classifyCompanyNameQuery(trimmed);
    if (gate.kind === "empty") {
      setNotice(null);
      setPanel(null);
      setMessage(QUOTE_COMPANY_NEED_NAME_ZH);
      return;
    }
    if (gate.kind === "short" || gate.kind === "personal") {
      setPanel(null);
      setMessage(null);
      setNotice({
        kind: gate.kind,
        input: gate.input,
        allowCompanyOverride: gate.kind === "personal" && gate.allowCompanyOverride,
      });
      return;
    }
    await previewRegister(gate.input);
  }

  const busy = registerLoading || progressStartedAt !== null;

  return (
    <section className="mt-6" aria-label={QUOTE_COMPANY_LABEL_ZH}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void confirmName(name);
        }}
        className="space-y-3"
      >
        {storedName === UNKNOWN_NAME ? (
          <p className="text-sm leading-relaxed text-foreground">{QUOTE_VERIFY_EXPIRED_ZH}</p>
        ) : null}
        {extracted ? (
          <p className="text-sm leading-relaxed text-foreground">{quoteCompanyFoundZh(extracted)}</p>
        ) : storedName === "" ? (
          <p className="text-sm leading-relaxed text-muted-foreground">{QUOTE_COMPANY_MISSING_ZH}</p>
        ) : null}
        <div>
          <label htmlFor="quote-company-name" className="text-sm font-medium text-foreground">
            {QUOTE_COMPANY_LABEL_ZH}
          </label>
          <input
            id="quote-company-name"
            name="companyName"
            type="text"
            autoComplete="organization"
            value={name}
            maxLength={COMPANY_NAME_MAX_LENGTH}
            onChange={(event) => {
              setDraft(event.target.value);
              clearGates();
            }}
            disabled={busy}
            className={fieldClass}
          />
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">{QUOTE_COMPANY_HOLD_ZH}</p>
        <button
          type="submit"
          disabled={busy}
          className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          {QUOTE_COMPANY_CONFIRM_ZH}
        </button>
      </form>
      {progressStartedAt !== null ? (
        <SearchProgressModal key={progressStartedAt} startedAt={progressStartedAt} />
      ) : null}
      {registerLoading ? (
        <p role="status" aria-label={REGISTER_LOADING_LABEL_ZH} className="mt-4 text-sm text-muted-foreground">
          {REGISTER_LOADING_ZH}
        </p>
      ) : null}
      {notice ? (
        <div role="status" className="mt-4 rounded-lg border border-warning/30 bg-warning-foreground px-3 py-2 text-sm text-warning">
          <p>
            {notice.kind === "personal"
              ? personalNameMessageZh(notice.input)
              : shortCompanyNameMessageZh(notice.input)}
          </p>
          {notice.allowCompanyOverride ? (
            <button
              type="button"
              onClick={() => void previewRegister(notice.input)}
              className="mt-2 inline-flex min-h-11 items-center rounded text-sm font-medium underline underline-offset-2"
            >
              {CONTINUE_AS_COMPANY_ZH}
            </button>
          ) : null}
        </div>
      ) : null}
      {panel ? (
        <RegisterMatchPanel
          input={panel.input}
          mode={panel.kind}
          candidates={panel.kind === "picker" ? panel.candidates : []}
          onPick={(registrationNo) =>
            void runReport({ companyName: panel.input, mwcRegistrationNo: registrationNo })
          }
          onBack={() => {
            setPanel(null);
            document.getElementById("quote-company-name")?.focus();
          }}
          onRetry={() => void previewRegister(panel.input)}
        />
      ) : null}
      {message ? (
        <p role="status" className="mt-4 text-sm text-warning">
          {message}
        </p>
      ) : null}
      {report ? (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-primary">{QUOTE_COMPANY_RESULT_HEADING_ZH}</h2>
          <div className="mt-4">
            <ReportCard report={report} />
          </div>
        </div>
      ) : null}
    </section>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  parseUnifiedSearchQuery,
  parsedSearchQueryLabel,
  toSearchInputBody,
} from "@/lib/parse-unified-search-query";
import { classifyCompanyNameQuery } from "@/lib/company-query-gate";
import { COMPANY_NAME_MAX_LENGTH } from "@/lib/report-schema";
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
import { getOrCreateAnonId } from "@/lib/anon-id";
import { brandSectionTitleClass } from "@/lib/ui-surfaces";
import { RegisterMatchPanel } from "./RegisterMatchPanel";
import { SearchProgressModal } from "./SearchProgress";

const REPORT_RETRY_ZH = "報告未能顯示，請稍後再試。";
const SERVICE_PAUSED_ZH = "用戶擁擠，系統暫停服務，請稍後再試";

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

type SearchFormProps = {
  variant?: "card" | "landing";
  paused?: boolean;
};

const inputBase =
  "w-full min-h-11 bg-transparent text-foreground outline-none placeholder:text-muted-foreground disabled:opacity-60";

const inputCard =
  "rounded-lg border border-border bg-background px-3 py-2 focus:ring-2 focus:ring-primary/30";

const inputLanding = "px-1 py-2.5 focus:ring-0";

type SearchBody = {
  companyName?: string;
  phone?: string;
  br?: string;
  mwcRegistrationNo?: string;
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

export function SearchForm({ variant = "card", paused = false }: SearchFormProps) {
  const router = useRouter();
  const [unifiedQuery, setUnifiedQuery] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [br, setBr] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pausedByApi, setPausedByApi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [notice, setNotice] = useState<NameNotice | null>(null);
  const [panel, setPanel] = useState<MatchPanel | null>(null);
  const [progressStartedAt, setProgressStartedAt] = useState<number | null>(
    null,
  );
  /** A held or repeated Enter on a picker row must not post the report twice. */
  const reportInFlight = useRef(false);

  const isLanding = variant === "landing";

  useEffect(() => {
    if (!pausedByApi) return;
    const t = setTimeout(() => setPausedByApi(false), 120_000);
    return () => clearTimeout(t);
  }, [pausedByApi]);

  const parsedUnified = useMemo(
    () => parseUnifiedSearchQuery(unifiedQuery),
    [unifiedQuery],
  );
  const detectLabel = parsedSearchQueryLabel(parsedUnified);

  const inputsDisabled = loading || registerLoading || pausedByApi;

  function clearGates() {
    setNotice(null);
    setPanel(null);
    setMessage(null);
  }

  function focusQuery() {
    document.getElementById(isLanding ? "search-query" : "companyName")?.focus();
  }

  async function runReport(body: SearchBody) {
    if (reportInFlight.current) return;
    reportInFlight.current = true;
    setLoading(true);
    setMessage(null);
    setProgressStartedAt(Date.now());

    try {
      const anonId = getOrCreateAnonId();
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(anonId ? { ...body, anonId } : body),
      });

      if (res.status === 429) {
        setMessage("查詢過於頻繁，請稍後再試。");
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
        // service_paused: cached reports are still served, so keep the box usable.
        if (res.status === 503 && code === "llm_busy") {
          setPausedByApi(true);
        }
        setMessage(
          PIPELINE_ERROR_ZH[code] ?? PIPELINE_ERROR_ZH.search_failed,
        );
        return;
      }

      const data = (await res.json()) as {
        fingerprint: string;
        report: unknown;
      };
      try {
        sessionStorage.setItem(
          `renocheck:report:${data.fingerprint}`,
          JSON.stringify(data.report),
        );
      } catch {
        // private mode / quota — report page may fall back to API
      }
      router.push(`/report/${data.fingerprint}`);
    } catch {
      setMessage("網絡錯誤，請稍後再試。");
    } finally {
      reportInFlight.current = false;
      setLoading(false);
      setProgressStartedAt(null);
    }
  }

  async function previewRegister(companyName: string) {
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
        setMessage("查詢過於頻繁，請稍後再試。");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pausedByApi || registerLoading || loading) return;
    const body: SearchBody | null = isLanding
      ? toSearchInputBody(parseUnifiedSearchQuery(unifiedQuery))
      : {
          companyName: companyName.trim() || undefined,
          phone: phone.trim() || undefined,
          br: br.trim() || undefined,
        };

    if (!body) {
      setNotice(null);
      setPanel(null);
      setMessage("請輸入公司名稱、香港電話或 BR 號碼。");
      return;
    }

    if (body.companyName && !body.phone && !body.br) {
      const gate = classifyCompanyNameQuery(body.companyName);
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
      if (gate.kind === "search") {
        await previewRegister(gate.input);
        return;
      }
    }

    await runReport(body);
  }

  const fieldClass = `${inputBase} ${isLanding ? "text-sm sm:text-[15px]" : "text-base"} ${isLanding ? inputLanding : inputCard}`;
  const showDetectHint =
    Boolean(detectLabel && unifiedQuery.trim()) &&
    !notice &&
    !panel &&
    !registerLoading;
  const submitLabel = loading
    ? "查閱中"
    : registerLoading
      ? REGISTER_LOADING_LABEL_ZH
      : "查閱公開資料摘要";
  const statusClass = `rounded-lg border border-warning/30 bg-warning-foreground px-3 py-2 text-sm text-warning ${
    isLanding ? "mt-4 text-center" : ""
  }`;

  return (
    <form
      onSubmit={handleSubmit}
      className={
        isLanding
          ? "w-full max-w-[584px]"
          : "space-y-4 rounded-xl border border-border bg-background p-4 shadow-sm sm:p-6"
      }
    >
      {isLanding ? (
        <div className="space-y-1.5">
          <div
            className="flex items-center gap-3 rounded-full border border-border/80 bg-background px-4 py-1 shadow-[0_1px_6px_rgba(32,33,36,0.16)] transition-shadow hover:shadow-[0_1px_8px_rgba(32,33,36,0.22)] focus-within:shadow-[0_1px_8px_rgba(32,33,36,0.22)] sm:px-5"
          >
            <button
              type="submit"
              disabled={inputsDisabled}
              aria-label={submitLabel}
              className="flex shrink-0 items-center justify-center rounded-full p-1.5 text-muted-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-60"
            >
              <SearchGlyph className="size-5" />
            </button>
            <label htmlFor="search-query" className="sr-only">
              輸入裝修公司名稱、電話或 BR 號碼
            </label>
            <input
              id="search-query"
              name="q"
              type="search"
              enterKeyHint="search"
              autoComplete="off"
              value={unifiedQuery}
              onChange={(e) => {
                setUnifiedQuery(e.target.value);
                clearGates();
              }}
              disabled={inputsDisabled}
              aria-describedby={paused ? "service-paused-banner" : undefined}
              className={`${fieldClass} min-h-12`}
              maxLength={COMPANY_NAME_MAX_LENGTH}
              placeholder="輸入裝修公司名稱、電話或 BR 號碼"
            />
          </div>
          {showDetectHint && (
            <p className="px-4 text-center text-xs text-muted-foreground">
              將以
              <strong className="font-medium text-foreground/80">
                {detectLabel}
              </strong>
              搜尋 · 8 位數字不明確時可加「BR」前綴
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <label
              htmlFor="companyName"
              className={brandSectionTitleClass}
            >
              公司名稱
            </label>
            <input
              id="companyName"
              name="companyName"
              type="text"
              autoComplete="organization"
              value={companyName}
              onChange={(e) => {
                setCompanyName(e.target.value);
                clearGates();
              }}
              disabled={inputsDisabled}
              className={fieldClass}
              maxLength={COMPANY_NAME_MAX_LENGTH}
              placeholder="例：某某裝修工程有限公司"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="phone" className={brandSectionTitleClass}>
              香港電話
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value);
                clearGates();
              }}
              disabled={inputsDisabled}
              className={fieldClass}
              placeholder="例：9123 4567"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="br" className={brandSectionTitleClass}>
              商業登記號碼（BR）
            </label>
            <input
              id="br"
              name="br"
              type="text"
              value={br}
              onChange={(e) => {
                setBr(e.target.value);
                clearGates();
              }}
              disabled={inputsDisabled}
              className={fieldClass}
              placeholder="例：12345678"
            />
          </div>
        </>
      )}

      {!isLanding && (
        <button
          type="submit"
          disabled={inputsDisabled}
          className="w-full min-h-11 rounded-lg bg-primary px-4 py-2 text-base font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
        >
          {loading ? "查閱中…" : registerLoading ? `${REGISTER_LOADING_LABEL_ZH}…` : "查閱公開資料摘要"}
        </button>
      )}

      {progressStartedAt !== null && (
        <SearchProgressModal
          key={progressStartedAt}
          startedAt={progressStartedAt}
        />
      )}
      {registerLoading && (
        <p role="status" aria-label={REGISTER_LOADING_LABEL_ZH} className={statusClass}>
          {REGISTER_LOADING_ZH}
        </p>
      )}
      {notice && (
        <div role="status" className={statusClass}>
          <p>
            {notice.kind === "personal"
              ? personalNameMessageZh(notice.input)
              : shortCompanyNameMessageZh(notice.input)}
          </p>
          {notice.allowCompanyOverride ? (
            <button
              type="button"
              onClick={() => void previewRegister(notice.input)}
              className="mt-2 inline-flex min-h-11 items-center rounded text-sm font-medium underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
            >
              {CONTINUE_AS_COMPANY_ZH}
            </button>
          ) : null}
        </div>
      )}
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
            focusQuery();
          }}
          onRetry={() => void previewRegister(panel.input)}
        />
      ) : null}
      {message && (
        <p role="status" className={statusClass}>
          {message}
        </p>
      )}
    </form>
  );
}

function SearchGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

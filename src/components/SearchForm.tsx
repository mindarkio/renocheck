"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  parseUnifiedSearchQuery,
  parsedSearchQueryLabel,
  toSearchInputBody,
} from "@/lib/parse-unified-search-query";
import { getOrCreateAnonId } from "@/lib/anon-id";
import { brandSectionTitleClass } from "@/lib/ui-surfaces";
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

export function SearchForm({ variant = "card", paused = false }: SearchFormProps) {
  const router = useRouter();
  const [unifiedQuery, setUnifiedQuery] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [br, setBr] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pausedByApi, setPausedByApi] = useState(false);
  const [loading, setLoading] = useState(false);
  const [progressStartedAt, setProgressStartedAt] = useState<number | null>(
    null,
  );

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

  const inputsDisabled = loading || pausedByApi;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pausedByApi) return;
    const body = isLanding
      ? toSearchInputBody(parseUnifiedSearchQuery(unifiedQuery))
      : {
          companyName: companyName.trim() || undefined,
          phone: phone.trim() || undefined,
          br: br.trim() || undefined,
        };

    if (!body) {
      setMessage("請輸入公司名稱、香港電話或 BR 號碼。");
      return;
    }

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
      setLoading(false);
      setProgressStartedAt(null);
    }
  }

  const fieldClass = `${inputBase} ${isLanding ? "text-sm sm:text-[15px]" : "text-base"} ${isLanding ? inputLanding : inputCard}`;

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
              aria-label={loading ? "查閱中" : "查閱公開資料摘要"}
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
              onChange={(e) => setUnifiedQuery(e.target.value)}
              disabled={inputsDisabled}
              aria-describedby={paused ? "service-paused-banner" : undefined}
              className={`${fieldClass} min-h-12`}
              placeholder="輸入裝修公司名稱、電話或 BR 號碼"
            />
          </div>
          {detectLabel && unifiedQuery.trim() && (
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
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={inputsDisabled}
              className={fieldClass}
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
              onChange={(e) => setPhone(e.target.value)}
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
              onChange={(e) => setBr(e.target.value)}
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
          {loading ? "查閱中…" : "查閱公開資料摘要"}
        </button>
      )}

      {progressStartedAt !== null && (
        <SearchProgressModal
          key={progressStartedAt}
          startedAt={progressStartedAt}
        />
      )}
      {message && (
        <p
          role="status"
          className={`rounded-lg border border-warning/30 bg-warning-foreground px-3 py-2 text-sm text-warning ${
            isLanding ? "mt-4 text-center" : ""
          }`}
        >
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

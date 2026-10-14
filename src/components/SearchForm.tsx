"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SearchProgress } from "./SearchProgress";

const PIPELINE_ERROR_ZH: Record<string, string> = {
  supabase_unavailable:
    "報告未能顯示：資料庫未設定或無法連線，請檢查 Supabase 環境變數。",
  serp_unavailable:
    "報告未能顯示：未設定網搜 API（SERPER_API_KEY 或 SERPAPI_KEY），無法搜尋公開討論。",
  serp_failed: "報告未能顯示：公開搜尋暫時失敗，請稍後再試。",
  llm_unavailable: "報告未能顯示：未設定 AI（Gemini 或 AI Gateway）。",
  llm_failed: "報告未能顯示：AI 摘要暫時失敗，請稍後再試。",
  search_failed: "報告未能顯示，請稍後再試。",
};

export function SearchForm() {
  const router = useRouter();
  const [companyName, setCompanyName] = useState("");
  const [phone, setPhone] = useState("");
  const [br, setBr] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progressStartedAt, setProgressStartedAt] = useState<number | null>(
    null,
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const hasInput =
      companyName.trim() || phone.trim() || br.trim();
    if (!hasInput) {
      setMessage("請至少填寫一項查詢資料。");
      return;
    }

    setLoading(true);
    setMessage(null);
    setProgressStartedAt(Date.now());

    try {
      const res = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyName: companyName.trim() || undefined,
          phone: phone.trim() || undefined,
          br: br.trim() || undefined,
        }),
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

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-4 rounded-xl border border-border bg-background p-4 shadow-sm sm:p-6"
    >
      <div className="space-y-1">
        <label htmlFor="companyName" className="text-sm font-medium text-foreground">
          公司名稱
        </label>
        <input
          id="companyName"
          name="companyName"
          type="text"
          autoComplete="organization"
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          disabled={loading}
          className="w-full min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
          placeholder="例：某某裝修工程有限公司"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="phone" className="text-sm font-medium text-foreground">
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
          disabled={loading}
          className="w-full min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
          placeholder="例：9123 4567"
        />
      </div>
      <div className="space-y-1">
        <label htmlFor="br" className="text-sm font-medium text-foreground">
          商業登記號碼（BR）
        </label>
        <input
          id="br"
          name="br"
          type="text"
          value={br}
          onChange={(e) => setBr(e.target.value)}
          disabled={loading}
          className="w-full min-h-11 rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-60"
          placeholder="例：12345678"
        />
      </div>
      <button
        type="submit"
        disabled={loading}
        className="w-full min-h-11 rounded-lg bg-primary px-4 py-2 text-base font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
      >
        {loading ? "查閱中…" : "查閱公開資料摘要"}
      </button>
      {progressStartedAt !== null && (
        <SearchProgress
          key={progressStartedAt}
          startedAt={progressStartedAt}
        />
      )}
      {message && (
        <p
          role="status"
          className="rounded-lg border border-warning/30 bg-warning-foreground px-3 py-2 text-sm text-warning"
        >
          {message}
        </p>
      )}
    </form>
  );
}

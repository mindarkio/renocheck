"use client";

import { useEffect, useState } from "react";
import type { RiskReport } from "@/lib/report-schema";
import { ReportCard } from "./ReportCard";

function readSessionReport(fingerprint: string): RiskReport | null {
  try {
    const raw = sessionStorage.getItem(`renocheck:report:${fingerprint}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RiskReport;
    return parsed?.entity?.displayName ? parsed : null;
  } catch {
    return null;
  }
}

export function ReportView({ fingerprint }: { fingerprint: string }) {
  const [report, setReport] = useState<RiskReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const storageKey = `renocheck:report:${fingerprint}`;

    void (async () => {
      const cached = readSessionReport(fingerprint);
      if (cached) {
        if (!cancelled) setReport(cached);
        return;
      }

      try {
        const res = await fetch(`/api/report/${fingerprint}`);
        if (res.status === 503) {
          if (!cancelled) {
            setError(
              "無法從伺服器讀取報告（請確認 .env.local 已設定 NEXT_PUBLIC_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY，並重啟 pnpm dev）。請從首頁重新搜尋。",
            );
          }
          return;
        }
        if (!res.ok) {
          if (!cancelled) setError("找不到報告或已過期，請重新搜尋。");
          return;
        }
        const data = (await res.json()) as { report: RiskReport };
        if (!cancelled) {
          setReport(data.report);
          try {
            sessionStorage.setItem(storageKey, JSON.stringify(data.report));
          } catch {
            // ignore
          }
        }
      } catch {
        if (!cancelled) setError("無法載入報告。");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fingerprint]);

  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10">
      <h1 className="mb-6 text-center text-xl font-semibold text-foreground">
        風險報告摘要
      </h1>
      {error && (
        <p className="text-center text-sm text-warning">{error}</p>
      )}
      {!error && !report && (
        <p className="text-center text-sm text-muted-foreground">載入中…</p>
      )}
      {report && <ReportCard report={report} />}
    </main>
  );
}

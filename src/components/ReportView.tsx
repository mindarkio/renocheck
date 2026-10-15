"use client";

import { Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
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
    <main className="flex min-h-0 flex-1 flex-col px-4 pb-12 pt-5 sm:px-6 sm:pb-16 sm:pt-7">
      <div className="mx-auto w-full max-w-[584px]">
        {error && (
          <div
            className="rounded-xl border border-warning/35 bg-warning-foreground/50 px-4 py-3 text-sm leading-relaxed text-warning"
            role="alert"
          >
            {error}
            <p className="mt-3">
              <Link
                href="/"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                返回首頁搜尋
              </Link>
            </p>
          </div>
        )}

        {!error && !report && (
          <div
            className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <Loader2
              className="size-4 shrink-0 animate-spin text-primary"
              aria-hidden
            />
            載入報告中…
          </div>
        )}

        {report && <ReportCard report={report} />}

        {(report || error) && (
          <div className="mt-8 sm:mt-10">
            <Link
              href="/"
              className="flex w-full min-h-12 items-center justify-center gap-2.5 rounded-xl border border-primary bg-transparent px-5 py-3 text-[15px] font-semibold tracking-wide text-primary transition-[transform,background-color] duration-200 hover:bg-primary/5 active:scale-[0.99] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
            >
              <Image
                src="/logo/mark-color-transparent.svg"
                alt=""
                width={28}
                height={30}
                className="size-7 shrink-0"
                aria-hidden
              />
              新搜尋
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}

"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { brandPageTitleClass } from "@/lib/ui-surfaces";

const STEPS = [
  "正在核對牌照資料",
  "搜尋公開討論",
  "分析風險信號",
  "生成報告",
] as const;

const STEP_MS = 10_000;
/** Cap bar below 100% until API returns (time-based estimate only). */
const MAX_PROGRESS = 96;

function computeProgress(startedAt: number): { stepIndex: number; percent: number } {
  const elapsed = Date.now() - startedAt;
  const stepIndex = Math.min(
    Math.floor(elapsed / STEP_MS),
    STEPS.length - 1,
  );
  const stepElapsed = elapsed - stepIndex * STEP_MS;
  const inStep = Math.min(stepElapsed / STEP_MS, 0.92);
  const percent = Math.min(
    ((stepIndex + inStep) / STEPS.length) * 100,
    MAX_PROGRESS,
  );
  return { stepIndex, percent };
}

function SearchProgressPanel({ startedAt }: { startedAt: number }) {
  const [{ stepIndex, percent }, setState] = useState(() =>
    computeProgress(startedAt),
  );

  useEffect(() => {
    const tick = () => setState(computeProgress(startedAt));
    const id = window.setInterval(tick, 150);
    tick();
    return () => window.clearInterval(id);
  }, [startedAt]);

  return (
    <>
      <div className="mb-4">
        <div
          className="flex items-center justify-between gap-3 text-xs text-muted-foreground"
          aria-hidden
        >
          <span>處理中</span>
          <span className="tabular-nums">{Math.round(percent)}%</span>
        </div>
        <div
          className="mt-2 h-2 overflow-hidden rounded-full bg-muted/80"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(percent)}
          aria-label="查詢進度"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out motion-reduce:transition-none"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      <p
        id="search-progress-title"
        className={`mb-4 flex items-center gap-2 ${brandPageTitleClass}`}
      >
        <Loader2
          className="size-4 shrink-0 animate-spin text-primary motion-reduce:animate-none"
          aria-hidden
        />
        <span>{STEPS[stepIndex]}…</span>
      </p>

      <ol className="space-y-2.5">
        {STEPS.map((label, i) => {
          const done = i < stepIndex;
          const current = i === stepIndex;
          return (
            <li
              key={label}
              className={`flex items-center gap-2.5 text-sm transition-colors duration-300 motion-reduce:transition-none ${
                current ? "motion-safe:animate-pulse" : ""
              } ${
                done
                  ? "text-muted-foreground"
                  : current
                    ? "font-medium text-primary"
                    : "text-muted-foreground/70"
              }`}
            >
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs transition-all duration-300 motion-reduce:transition-none ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : current
                      ? "border-2 border-primary bg-primary/[0.06] text-primary"
                      : "border border-border"
                }`}
                aria-hidden
              >
                {done ? (
                  "✓"
                ) : current ? (
                  <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" />
                ) : (
                  i + 1
                )}
              </span>
              <span className="flex-1">{label}</span>
            </li>
          );
        })}
      </ol>

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        首次查詢可能需一至兩分鐘，請稍候。
      </p>
    </>
  );
}

export function SearchProgressModal({ startedAt }: { startedAt: number }) {
  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="search-progress-title"
      aria-busy="true"
    >
      <div
        className="absolute inset-0 bg-primary/50 backdrop-blur-sm supports-[backdrop-filter]:bg-primary/40"
        aria-hidden
      />
      <div
        className="relative w-full max-w-sm rounded-2xl border border-border/80 bg-background px-5 py-5 shadow-[0_8px_32px_rgba(32,33,36,0.16)] sm:px-6 sm:py-6"
        role="status"
        aria-live="polite"
      >
        <SearchProgressPanel startedAt={startedAt} />
      </div>
    </div>,
    document.body,
  );
}

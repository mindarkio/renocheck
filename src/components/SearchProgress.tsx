"use client";

import { useEffect, useState } from "react";

const STEPS = [
  "正在核對牌照資料",
  "搜尋公開討論",
  "分析風險信號",
  "生成報告",
] as const;

const STEP_MS = 10_000;

export function SearchProgress({ startedAt }: { startedAt: number }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const tick = () => {
      setStepIndex(
        Math.min(
          Math.floor((Date.now() - startedAt) / STEP_MS),
          STEPS.length - 1,
        ),
      );
    };
    const id = window.setInterval(tick, 1000);
    const first = window.setTimeout(tick, 0);
    return () => {
      window.clearInterval(id);
      window.clearTimeout(first);
    };
  }, [startedAt]);

  return (
    <div
      className="rounded-lg border border-border bg-muted/40 px-3 py-3"
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <p className="mb-3 text-sm font-medium text-foreground">
        {STEPS[stepIndex]}…
      </p>
      <ol className="space-y-2">
        {STEPS.map((label, i) => {
          const done = i < stepIndex;
          const current = i === stepIndex;
          return (
            <li
              key={label}
              className={`flex items-center gap-2 text-sm ${
                done
                  ? "text-muted-foreground"
                  : current
                    ? "font-medium text-foreground"
                    : "text-muted-foreground/70"
              }`}
            >
              <span
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs ${
                  done
                    ? "bg-primary text-primary-foreground"
                    : current
                      ? "border-2 border-primary text-primary"
                      : "border border-border"
                }`}
                aria-hidden
              >
                {done ? "✓" : i + 1}
              </span>
              {label}
            </li>
          );
        })}
      </ol>
      <p className="mt-3 text-xs text-muted-foreground">
        首次查詢可能需一至兩分鐘，請稍候。
      </p>
    </div>
  );
}

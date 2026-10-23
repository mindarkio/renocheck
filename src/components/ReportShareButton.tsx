"use client";

import { useState } from "react";
import { sendUsageEvent } from "@/lib/usage-events-client";

export const REPORT_SHARE_BUTTON_ZH = "分享報告";
export const REPORT_SHARE_COPIED_ZH = "已複製連結";
export const REPORT_SHARE_FAILED_ZH = "未能複製連結";

const focusRingClass =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function reportUrl(fingerprint: string): string {
  return `${window.location.origin}/report/${fingerprint}`;
}

export function ReportShareButton({ fingerprint }: { fingerprint: string }) {
  const [notice, setNotice] = useState<"idle" | "copied" | "failed">("idle");

  async function onShare() {
    sendUsageEvent("report_share", { fingerprint });
    const url = reportUrl(fingerprint);
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ url });
        setNotice("idle");
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard unavailable");
      await navigator.clipboard.writeText(url);
      setNotice("copied");
    } catch {
      setNotice("failed");
    }
  }

  const status =
    notice === "copied"
      ? REPORT_SHARE_COPIED_ZH
      : notice === "failed"
        ? REPORT_SHARE_FAILED_ZH
        : "";

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-1">
      <button
        type="button"
        onClick={() => {
          void onShare();
        }}
        className={`inline-flex min-h-11 items-center justify-center rounded-lg border border-border bg-background px-4 text-sm font-medium text-foreground hover:bg-muted ${focusRingClass}`}
      >
        {REPORT_SHARE_BUTTON_ZH}
      </button>
      <p role="status" className="min-h-5 text-sm text-muted-foreground">
        {status}
      </p>
    </div>
  );
}

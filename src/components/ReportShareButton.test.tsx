// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { sendUsageEvent } from "@/lib/usage-events-client";
import {
  REPORT_SHARE_BUTTON_ZH,
  REPORT_SHARE_COPIED_ZH,
  REPORT_SHARE_FAILED_ZH,
  ReportShareButton,
} from "./ReportShareButton";
import {
  REPORT_TRUST_FORBIDDEN_ZH,
  REPORT_TRUST_NEGATED_ALLOWLIST_ZH,
} from "@/lib/report-trust-copy-zh";

const FP = "ab".repeat(16);

vi.mock("@/lib/usage-events-client", () => ({
  sendUsageEvent: vi.fn(),
}));

function assertClean(text: string): void {
  let t = text;
  for (const ok of REPORT_TRUST_NEGATED_ALLOWLIST_ZH) {
    t = t.split(ok).join("");
  }
  for (const word of REPORT_TRUST_FORBIDDEN_ZH) {
    expect(t).not.toContain(word);
  }
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ReportShareButton", () => {
  it("counts the click and copies the report URL when share is unavailable", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText }, share: undefined });
    render(<ReportShareButton fingerprint={FP} />);
    assertClean(document.body.textContent ?? "");
    fireEvent.click(screen.getByRole("button", { name: REPORT_SHARE_BUTTON_ZH }));
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(REPORT_SHARE_COPIED_ZH);
    });
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/report/${FP}`);
    expect(sendUsageEvent).toHaveBeenCalledWith("report_share", { fingerprint: FP });
    assertClean(REPORT_SHARE_COPIED_ZH);
    assertClean(REPORT_SHARE_FAILED_ZH);
  });

  it("counts the click when the share sheet is cancelled", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("abort", "AbortError"));
    Object.assign(navigator, { share });
    render(<ReportShareButton fingerprint={FP} />);
    fireEvent.click(screen.getByRole("button", { name: REPORT_SHARE_BUTTON_ZH }));
    await waitFor(() => expect(share).toHaveBeenCalled());
    expect(sendUsageEvent).toHaveBeenCalledWith("report_share", { fingerprint: FP });
    expect(screen.getByRole("status").textContent).toBe("");
  });

  it("says the copy failed when share and clipboard both fail", async () => {
    const share = vi.fn().mockRejectedValue(new DOMException("denied", "NotAllowedError"));
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    Object.assign(navigator, { share, clipboard: { writeText } });
    render(<ReportShareButton fingerprint={FP} />);
    fireEvent.click(screen.getByRole("button", { name: REPORT_SHARE_BUTTON_ZH }));
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(REPORT_SHARE_FAILED_ZH);
    });
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/report/${FP}`);
  });
});

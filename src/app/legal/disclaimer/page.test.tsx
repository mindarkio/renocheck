// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DisclaimerPage from "./page";
import { DISCLAIMER_VERSION, REPORT_VERSION } from "@/lib/constants";
import { FEEDBACK_PRIVACY_NOTICE_ZH } from "@/lib/feedback-copy-zh";
import {
  REPORT_TRUST_FORBIDDEN_ZH,
  REPORT_TRUST_NEGATED_ALLOWLIST_ZH,
} from "@/lib/report-trust-copy-zh";

const BANNED = [
  "刊憲",
  "數日",
  "小型申索",
  "觸犯",
  "LRS",
  "傢俬",
  "授權前",
  "匿名條數",
] as const;

function assertClean(text: string): void {
  let t = text;
  for (const ok of REPORT_TRUST_NEGATED_ALLOWLIST_ZH) {
    t = t.split(ok).join("");
  }
  for (const word of REPORT_TRUST_FORBIDDEN_ZH) {
    expect(t).not.toContain(word);
  }
  for (const word of BANNED) {
    expect(t).not.toContain(word);
  }
}

describe("disclaimer page feedback notice", () => {
  it("publishes the approved §七 notice at 1.2.1 without changing the report version", () => {
    expect(DISCLAIMER_VERSION).toBe("1.2.1");
    expect(REPORT_VERSION).toBe("2.7.0");
    render(<DisclaimerPage />);
    expect(screen.getByText("版本 1.2.1")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "七、個人資料（私隱）" })).toBeTruthy();
    const notice = document.getElementById("feedback-privacy");
    expect(notice?.textContent).toBe(FEEDBACK_PRIVACY_NOTICE_ZH);
    expect(notice?.querySelector("a")?.getAttribute("href")).toBe(
      "mailto:hello@renocheck.homes",
    );
    assertClean(FEEDBACK_PRIVACY_NOTICE_ZH);
    assertClean(notice?.textContent ?? "");
  });
});

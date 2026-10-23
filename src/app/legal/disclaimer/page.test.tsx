// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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

afterEach(() => cleanup());

const QUOTE_SELF_CHECK_PRIVACY_ZH =
  "本網站部分工具（例如報價自查）只會將閣下的選擇儲存於閣下裝置的瀏覽器內，不會傳送至本網站伺服器。";

describe("disclaimer page feedback notice", () => {
  it("publishes the approved §七 notice at 1.2.2 without changing the report version", () => {
    expect(DISCLAIMER_VERSION).toBe("1.2.2");
    expect(REPORT_VERSION).toBe("2.7.0");
    render(<DisclaimerPage />);
    expect(screen.getByText("版本 1.2.2")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "七、個人資料（私隱）" })).toBeTruthy();
    const notice = document.getElementById("feedback-privacy");
    expect(notice?.textContent).toBe(FEEDBACK_PRIVACY_NOTICE_ZH);
    expect(notice?.querySelector("a")?.getAttribute("href")).toBe(
      "mailto:hello@renocheck.homes",
    );
    assertClean(FEEDBACK_PRIVACY_NOTICE_ZH);
    assertClean(notice?.textContent ?? "");
  });

  it("places the approved quote-tool sentence in §七 after the privacy list", () => {
    render(<DisclaimerPage />);
    const heading = screen.getByRole("heading", { name: "七、個人資料（私隱）" });
    const section = heading.closest("section");
    const text = section?.textContent ?? "";
    const sentenceAt = text.indexOf(QUOTE_SELF_CHECK_PRIVACY_ZH);
    expect(sentenceAt).toBeGreaterThan(text.indexOf("你的權利"));
    expect(text.indexOf("資料保護主任")).toBeGreaterThan(sentenceAt);
    expect(text.indexOf("閣下於報告頁提交的評分")).toBeGreaterThan(sentenceAt);
    expect(document.getElementById("feedback-privacy")?.textContent ?? "").not.toContain(
      QUOTE_SELF_CHECK_PRIVACY_ZH,
    );
    assertClean(QUOTE_SELF_CHECK_PRIVACY_ZH);
  });
});

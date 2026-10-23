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

const ANON_ID_PRIVACY_ZH =
  "本網站會於閣下瀏覽器內儲存一個隨機識別碼，並連同使用紀錄傳送至本網站伺服器，僅用於統計重複使用情況。伺服器紀錄中的識別碼會於 90 日後清除（相關使用次數紀錄會以不含識別碼的形式保留）；閣下可隨時清除瀏覽器資料以刪除瀏覽器內的識別碼。該識別碼不會與閣下的姓名、聯絡資料或 IP 地址連結。";

describe("disclaimer page feedback notice", () => {
  it("publishes the approved §七 notice at 1.2.3 without changing the report version", () => {
    expect(DISCLAIMER_VERSION).toBe("1.2.3");
    expect(REPORT_VERSION).toBe("2.7.0");
    render(<DisclaimerPage />);
    expect(screen.getByText("版本 1.2.3")).toBeTruthy();
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
    const anonAt = text.indexOf(ANON_ID_PRIVACY_ZH);
    expect(anonAt).toBeGreaterThan(sentenceAt);
    expect(text.indexOf("資料保護主任")).toBeGreaterThan(anonAt);
    expect(text.split(ANON_ID_PRIVACY_ZH)).toHaveLength(2);
    assertClean(ANON_ID_PRIVACY_ZH);
    expect(text.indexOf("閣下於報告頁提交的評分")).toBeGreaterThan(sentenceAt);
    expect(document.getElementById("feedback-privacy")?.textContent ?? "").not.toContain(
      QUOTE_SELF_CHECK_PRIVACY_ZH,
    );
    expect(document.getElementById("feedback-privacy")?.textContent ?? "").not.toContain(
      ANON_ID_PRIVACY_ZH,
    );
    assertClean(QUOTE_SELF_CHECK_PRIVACY_ZH);
  });
});

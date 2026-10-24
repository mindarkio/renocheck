// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import DisclaimerPage from "./page";
import { DISCLAIMER_VERSION, REPORT_VERSION } from "@/lib/constants";
import { FEEDBACK_PRIVACY_NOTICE_ZH } from "@/lib/feedback-copy-zh";
import {
  QUOTE_ANALYSIS_DISCLAIMER_CLOSED_ZH,
  QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH,
} from "@/lib/quote-analysis/copy";

vi.mock("next/server", () => ({
  connection: vi.fn(async () => {}),
}));
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

afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

beforeEach(() => {
  vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "1");
});

async function renderDisclaimer() {
  const ui = await DisclaimerPage();
  return render(ui);
}

const QUOTE_SELF_CHECK_PRIVACY_ZH =
  "本網站部分工具（例如報價自查）只會將閣下的選擇儲存於閣下裝置的瀏覽器內，不會傳送至本網站伺服器。";

const ANON_ID_PRIVACY_ZH =
  "本網站會於閣下瀏覽器內儲存一個隨機識別碼，並連同使用紀錄傳送至本網站伺服器，僅用於統計重複使用情況。伺服器紀錄中的識別碼會於 90 日後清除（相關使用次數紀錄會以不含識別碼的形式保留）；閣下可隨時清除瀏覽器資料以刪除瀏覽器內的識別碼。該識別碼不會與閣下的姓名、聯絡資料或 IP 地址連結。";

const THIRD_PARTY_REDACTION_DISCLAIMER_ZH =
  "本網站於顯示報告前，會以自動規則遮蔽報告文字中第三者的個人資料，惟或有遺漏或誤遮之處。";

describe("disclaimer page feedback notice", () => {
  it("publishes the approved §七 notice at 1.2.5 without changing the report version", async () => {
    expect(DISCLAIMER_VERSION).toBe("1.2.5");
    expect(REPORT_VERSION).toBe("2.7.0");
    await renderDisclaimer();
    expect(screen.getByText("版本 1.2.5")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "七、個人資料（私隱）" })).toBeTruthy();
    const notice = document.getElementById("feedback-privacy");
    expect(notice?.textContent).toBe(FEEDBACK_PRIVACY_NOTICE_ZH);
    expect(notice?.querySelector("a")?.getAttribute("href")).toBe(
      "mailto:hello@renocheck.homes",
    );
    assertClean(FEEDBACK_PRIVACY_NOTICE_ZH);
    assertClean(notice?.textContent ?? "");
  });

  it("places the approved quote-tool sentence in §七 after the privacy list", async () => {
    await renderDisclaimer();
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

  it("adds the quote-analysis paragraph after the approved feedback notice", async () => {
    await renderDisclaimer();
    const heading = screen.getByRole("heading", { name: "七、個人資料（私隱）" });
    const text = heading.closest("section")?.textContent ?? "";
    expect(document.getElementById("quote-analysis-closed")).toBeNull();
    const quote = document.getElementById("quote-analysis-privacy");
    expect(quote?.textContent).toBe(QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH);
    expect(text.indexOf(QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH)).toBeGreaterThan(
      text.indexOf("閣下於報告頁提交的評分"),
    );
    expect(text.split(QUOTE_SELF_CHECK_PRIVACY_ZH)).toHaveLength(2);
    expect(text.split(ANON_ID_PRIVACY_ZH)).toHaveLength(2);
    assertClean(QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH);
  });

  it("hides the quote-analysis paragraph when the flag is off and keeps version 1.2.5", async () => {
    vi.stubEnv("QUOTE_ANALYSIS_ENABLED", "0");
    await renderDisclaimer();
    expect(screen.getByText("版本 1.2.5")).toBeTruthy();
    expect(DISCLAIMER_VERSION).toBe("1.2.5");
    expect(document.getElementById("quote-analysis-privacy")).toBeNull();
    expect(document.body.textContent ?? "").not.toContain("Microsoft Azure");
    const closed = document.getElementById("quote-analysis-closed");
    expect(closed?.textContent).toBe(QUOTE_ANALYSIS_DISCLAIMER_CLOSED_ZH);
    expect(closed?.querySelector("a")?.getAttribute("href")).toBe("mailto:hello@renocheck.homes");
    expect(document.getElementById("feedback-privacy")).toBeTruthy();
    const closedSection = screen
      .getByRole("heading", { name: "七、個人資料（私隱）" })
      .closest("section");
    const closedText = closedSection?.textContent ?? "";
    expect(closedText.endsWith(THIRD_PARTY_REDACTION_DISCLAIMER_ZH)).toBe(true);
  });

  it("appends the approved third-party redaction sentence at the end of §七", async () => {
    expect(DISCLAIMER_VERSION).toBe("1.2.5");
    expect(REPORT_VERSION).toBe("2.7.0");
    await renderDisclaimer();
    expect(screen.getByText("版本 1.2.5")).toBeTruthy();
    expect(screen.getByText(THIRD_PARTY_REDACTION_DISCLAIMER_ZH)).toBeTruthy();
    const heading = screen.getByRole("heading", { name: "七、個人資料（私隱）" });
    const section = heading.closest("section");
    const text = section?.textContent ?? "";
    expect(text.endsWith(THIRD_PARTY_REDACTION_DISCLAIMER_ZH)).toBe(true);
    expect(text.indexOf(THIRD_PARTY_REDACTION_DISCLAIMER_ZH)).toBeGreaterThan(
      text.indexOf(QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH),
    );
    expect(text.split(THIRD_PARTY_REDACTION_DISCLAIMER_ZH)).toHaveLength(2);
    const limits = screen.getByRole("heading", { name: "八、責任限制" });
    expect(
      (section?.compareDocumentPosition(limits) ?? 0) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    assertClean(THIRD_PARTY_REDACTION_DISCLAIMER_ZH);
  });
});

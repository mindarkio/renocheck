import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import FaqPage from "./page";
import HowItWorksPage from "@/app/how-it-works/page";
import { DISCLAIMER_VERSION, REPORT_VERSION } from "@/lib/constants";
import { FAQ_ITEMS } from "@/lib/faq-content";

/** Aaron-approved register-name picker copy (A3 brand spelling matched to existing FAQ: Renocheck). */
const HOW_IT_WORKS_PICKER_PARAGRAPH = "如果公司名太短或者太常見，系統會請你輸入報價單上嘅公司全名先開始查。如果屋宇署名冊有 2 至 8 間名稱包含你輸入嘅字（就算其中一間同你輸入一樣），會先顯示「名冊有多過一間相符」，你揀啱嗰間撳「查呢間」，報告先會開始；多過 8 間就會請你輸入更完整嘅名稱。如果輸入啱啱好係 3 個中文字，而最後一個字唔係「記」或「號」，系統會當可能係人名，請你改輸入公司全名、商號或商業登記號碼。";

const REGISTER_PICKER_FAQ = [
  {
    question: "點解輸入公司名之後要我揀一間？",
    answer: "屋宇署小型工程承建商名冊有時有幾間公司嘅名稱都包含你輸入嘅字，就算有一間同你輸入一模一樣都會咁。2 至 8 間相符時會顯示「名冊有多過一間相符」，你對吓報價單上嘅全名同註冊編號，揀啱嗰間撳「查呢間」，報告先會開始。如果係以個人名義註冊嘅小型工程承建商，選擇框只會顯示名稱同註冊編號。",
  },
  {
    question: "點解系統叫我輸入公司全名？",
    answer: "如果你輸入嘅名太短或者太常見，或者名冊入面有 9 間或以上公司都包含呢幾個字，系統唔會估你想查邊間，會請你輸入報價單或合約上嘅公司全名，先至開始查。",
  },
  {
    question: "點解輸入三個字會話好似人名？",
    answer: "如果輸入啱啱好係 3 個中文字，而最後一個字唔係「記」或「號」，好容易係一個人名。Renocheck 只查公司同商號，唔會用個人姓名對公司，避免同名嘅人被對上另一間舖。請改輸入公司全名、商號或者商業登記號碼；如果你輸入嘅真係公司全名，可以撳「呢個係公司全名，繼續查」。英文人名或者帶稱呼嘅人名就冇呢個選項。",
  },
  {
    question: "報告頂嘅「本次查證範圍」點睇？",
    answer: "報告頂會寫「你輸入「…」／名冊名稱「…」」，等你核對系統係用名冊上邊個名出報告。用電話或商業登記號碼查都會顯示。",
  },
] as const;

const PRIOR_QUESTION = "可以點樣查一間裝修公司？";
const NEXT_QUESTION = "風險參考分檔有咩意思？";

function faqJsonLd(html: string): {
  "@context": string;
  "@type": string;
  mainEntity: Array<{
    "@type": string;
    name: string;
    acceptedAnswer: { "@type": string; text: string };
  }>;
} {
  const raw = html.match(
    /<script type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/,
  )?.[1];
  expect(raw, "FAQ JSON-LD script").toBeTruthy();
  return JSON.parse(raw ?? "") as ReturnType<typeof faqJsonLd>;
}

describe("register name picker FAQ copy", () => {
  it("inserts the four approved Q&As between the search question and the grade question", () => {
    const index = FAQ_ITEMS.findIndex((item) => item.question === PRIOR_QUESTION);
    expect(index).toBeGreaterThanOrEqual(0);
    expect(FAQ_ITEMS.slice(index + 1, index + 1 + REGISTER_PICKER_FAQ.length)).toEqual(
      REGISTER_PICKER_FAQ.map((item) => ({ ...item })),
    );
    expect(FAQ_ITEMS[index + 1 + REGISTER_PICKER_FAQ.length]?.question).toBe(NEXT_QUESTION);
    expect(new Set(FAQ_ITEMS.map((item) => item.question)).size).toBe(FAQ_ITEMS.length);
    expect(REGISTER_PICKER_FAQ[2]?.answer.startsWith("如果輸入啱啱好係 3 個中文字")).toBe(true);
    expect(REGISTER_PICKER_FAQ[2]?.answer).toContain("Renocheck 只查公司同商號");
    expect(REGISTER_PICKER_FAQ[2]?.answer).not.toContain("RenoCheck");
  });

  it("renders the new questions and a parseable FAQPage JSON-LD graph", () => {
    const html = renderToStaticMarkup(<FaqPage />);
    const data = faqJsonLd(html);
    expect(data["@context"]).toBe("https://schema.org");
    expect(data["@type"]).toBe("FAQPage");
    expect(data.mainEntity).toHaveLength(FAQ_ITEMS.length);
    expect(
      data.mainEntity.map((item) => ({
        question: item.name,
        answer: item.acceptedAnswer.text,
      })),
    ).toEqual(FAQ_ITEMS);
    for (const item of data.mainEntity) {
      expect(item["@type"]).toBe("Question");
      expect(item.acceptedAnswer["@type"]).toBe("Answer");
      expect(html).toContain(item.name);
      expect(html).toContain(item.acceptedAnswer.text);
    }
    for (const item of REGISTER_PICKER_FAQ) {
      expect(data.mainEntity.some((row) => row.name === item.question && row.acceptedAnswer.text === item.answer)).toBe(true);
    }
  });
});

describe("how it works register picker paragraph", () => {
  it("adds one paragraph under section 1 and leaves the other sections in place", () => {
    const html = renderToStaticMarkup(<HowItWorksPage />);
    const titles = ["1. 你輸入查詢", "2. 公開資料來源", "3. 對照與風險參考分檔", "4. 快取（約 7 日）"];
    let cursor = -1;
    for (const title of titles) {
      const at = html.indexOf(title);
      expect(at).toBeGreaterThan(cursor);
      cursor = at;
    }
    const section1 = html.slice(html.indexOf(titles[0]), html.indexOf(titles[1]));
    const existing = "公司名稱、香港電話或商業登記號碼（至少一項）。系統會標示「本次查證範圍」（你的查詢、搜尋用名稱、公開搜尋對照結果等）。";
    expect(section1.indexOf(existing)).toBeGreaterThanOrEqual(0);
    expect(section1.indexOf(HOW_IT_WORKS_PICKER_PARAGRAPH)).toBeGreaterThan(section1.indexOf(existing));
    expect(section1.split(HOW_IT_WORKS_PICKER_PARAGRAPH)).toHaveLength(2);
    expect(DISCLAIMER_VERSION).toBe("1.2.5");
    expect(REPORT_VERSION).toBe("2.7.0");
  });
});


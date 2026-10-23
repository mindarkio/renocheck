import { describe, expect, it } from "vitest";
import { REPORT_TRUST_FORBIDDEN_ZH } from "./report-trust-copy-zh";
import {
  QUOTE_CHECK_ITEMS,
  QUOTE_PAGE_LEAD_ZH,
  QUOTE_PAGE_TITLE_ZH,
  QUOTE_REPLY_CLOSING_ZH,
  QUOTE_REPLY_GREETING_ZH,
  QUOTE_REPLY_ITEM_LIMIT,
  QUOTE_REPLY_OVERFLOW_ZH,
  QUOTE_SELF_CHECK_MAX_RAW_LENGTH,
  QUOTE_SELF_CHECK_STORAGE_KEY,
  buildQuotePageJsonLd,
  buildQuoteReplyMessage,
  parseQuoteCheckSelections,
  quoteSelfCheckUserFacingCopy,
  readQuoteCheckSelections,
  writeQuoteCheckSelections,
  type QuoteCheckItemId,
  type QuoteCheckSelections,
} from "./quote-selfcheck";

const IDS: readonly QuoteCheckItemId[] = [
  "demolition",
  "debris_disposal",
  "electrical",
  "plumbing",
  "waterproofing",
  "gas",
  "materials_spec",
  "quantities_units",
  "provisional_items",
  "exclusions",
  "timeline",
  "payment_schedule",
  "variations",
  "warranty",
  "defects_handover",
  "licence_registration",
  "insurance",
  "site_protection_cleanup",
  "building_mgmt",
  "quote_identity",
];

function selections(
  entries: Array<[QuoteCheckItemId, "clear" | "vague" | "missing" | "na"]>,
): QuoteCheckSelections {
  return Object.fromEntries(entries);
}

describe("quote self-check checklist", () => {
  it("has the 20 §8.1 items in order and omits arithmetic", () => {
    expect(QUOTE_CHECK_ITEMS.map((item) => item.id)).toEqual(IDS);
    expect(QUOTE_CHECK_ITEMS).toHaveLength(20);
    expect(IDS).not.toContain("arithmetic" as QuoteCheckItemId);
    const corpus = quoteSelfCheckUserFacingCopy().join("\n");
    expect(corpus).not.toContain("加總唔一致");
  });

  it("marks only gas and licence_registration as conditional", () => {
    expect(
      QUOTE_CHECK_ITEMS.filter((item) => item.conditional).map((item) => item.id),
    ).toEqual(["gas", "licence_registration"]);
  });

  it("states the tool does not judge price and is not professional advice", () => {
    expect(QUOTE_PAGE_LEAD_ZH).toContain("唔會評價格係咪合理");
    expect(QUOTE_PAGE_LEAD_ZH).toContain("唔係專業意見");
  });

  it("keeps new copy free of review claims, UK disambiguation, and consultation", () => {
    const corpus = quoteSelfCheckUserFacingCopy().join("\n");
    expect(corpus).not.toContain("報價審核");
    expect(corpus).not.toContain("唔提供報價");
    expect(corpus).not.toContain("renocheck.co.uk");
    expect(corpus).not.toContain("專家諮詢");
    expect(corpus).not.toMatch(/人工智能|AI 分析|\bAI\b/);
    expect(corpus).not.toContain("wa.me");
  });
});

describe("buildQuoteReplyMessage", () => {
  it("returns null when nothing is missing or vague", () => {
    expect(buildQuoteReplyMessage({})).toBeNull();
    expect(
      buildQuoteReplyMessage(
        selections(IDS.map((id) => [id, id === "demolition" ? "clear" : "na"])),
      ),
    ).toBeNull();
  });

  it("ignores an arithmetic key and unknown statuses", () => {
    expect(
      parseQuoteCheckSelections({
        arithmetic: "missing",
        demolition: "missing",
        debris_disposal: "maybe",
        not_an_item: "vague",
      }),
    ).toEqual({ demolition: "missing" });
    expect(
      buildQuoteReplyMessage(
        parseQuoteCheckSelections({ arithmetic: "missing", demolition: "vague" }),
      ),
    ).toBe(
      [
        QUOTE_REPLY_GREETING_ZH,
        `1. ${QUOTE_CHECK_ITEMS[0].question}`,
        QUOTE_REPLY_CLOSING_ZH,
      ].join("\n"),
    );
  });

  it("lists missing items before vague items, both in checklist order", () => {
    const message = buildQuoteReplyMessage({
      demolition: "vague",
      electrical: "missing",
      plumbing: "clear",
      gas: "na",
      waterproofing: "missing",
    });
    expect(message).toBe(
      [
        QUOTE_REPLY_GREETING_ZH,
        "1. 電力工程有幾多個點？係咪全換新線？完工會唔會由註冊電業承辦商發 WR1？",
        "2. 浴室／廚房有冇做防水？做完會唔會試水？試幾耐？",
        "3. 拆舊包邊啲範圍？（例如舊地磚、櫃、門）",
        QUOTE_REPLY_CLOSING_ZH,
      ].join("\n"),
    );
  });

  it("caps the message at 6 items and adds the overflow line only past that", () => {
    const six = buildQuoteReplyMessage(
      selections(IDS.slice(0, QUOTE_REPLY_ITEM_LIMIT).map((id) => [id, "missing"])),
    );
    expect(six?.match(/^\d+\. /gm)).toHaveLength(6);
    expect(six).not.toContain(QUOTE_REPLY_OVERFLOW_ZH);
    expect(six?.endsWith(QUOTE_REPLY_CLOSING_ZH)).toBe(true);

    const seven = buildQuoteReplyMessage(
      selections(IDS.slice(0, 7).map((id) => [id, "vague"])),
    );
    expect(seven?.match(/^\d+\. /gm)).toHaveLength(6);
    expect(seven).toContain(QUOTE_REPLY_OVERFLOW_ZH);
    expect(seven).not.toContain(QUOTE_CHECK_ITEMS[6].question);
    const lines = seven?.split("\n") ?? [];
    expect(lines.at(-2)).toBe(QUOTE_REPLY_OVERFLOW_ZH);
    expect(lines.at(-1)).toBe(QUOTE_REPLY_CLOSING_ZH);
  });

  it("keeps missing items ahead of vague items when the cap cuts the list", () => {
    const message = buildQuoteReplyMessage({
      demolition: "vague",
      debris_disposal: "missing",
      electrical: "missing",
      plumbing: "missing",
      waterproofing: "missing",
      gas: "missing",
      materials_spec: "missing",
      quantities_units: "vague",
    });
    expect(message).toContain("1. 拆出嚟嘅廢料係咪你哋負責運走？相關費用有冇計埋？");
    expect(message).not.toContain("拆舊包邊啲範圍");
    expect(message).toContain(QUOTE_REPLY_OVERFLOW_ZH);
  });
});

describe("quote page JSON-LD", () => {
  it("is a WebPage with a HowTo and does not claim automated quote review", () => {
    const data = buildQuotePageJsonLd("https://renocheck.homes");
    expect(data["@type"]).toBe("WebPage");
    expect(data.url).toBe("https://renocheck.homes/quote");
    expect(data.name).toBe(QUOTE_PAGE_TITLE_ZH);
    expect(data.description).toContain("報價單");
    expect(data.description).toContain("報價陷阱");
    const mainEntity = data.mainEntity as { "@type": string; step: unknown[] };
    expect(mainEntity["@type"]).toBe("HowTo");
    expect(mainEntity.step).toHaveLength(3);
    const serialised = JSON.stringify(data);
    expect(serialised).not.toMatch(/人工智能|報價審核|renocheck\.co\.uk|專家諮詢|\bAI\b/);
  });
});

describe("quote self-check copy accuracy", () => {
  it("uses none of the report forbidden words", () => {
    const corpus = quoteSelfCheckUserFacingCopy().join("\n");
    expect(REPORT_TRUST_FORBIDDEN_ZH.filter((word) => corpus.includes(word))).toEqual([]);
  });

  it("does not call removing a non-structural wall minor works", () => {
    const corpus = quoteSelfCheckUserFacingCopy().join("\n");
    expect(corpus).not.toContain("拆非結構牆");
    expect(corpus).toContain("加建間隔牆");
  });

  it("names employees' compensation insurance consistently", () => {
    const insurance = QUOTE_CHECK_ITEMS.find((item) => item.id === "insurance");
    expect(insurance?.clearExample).toContain("僱員補償保險");
    expect(insurance?.question).toContain("僱員補償保險");
  });
});

describe("quote self-check storage", () => {
  function fakeStorage(initial: string | null = null) {
    let value = initial;
    const calls: string[] = [];
    return {
      calls,
      get value() {
        return value;
      },
      getItem: (key: string) => (key === QUOTE_SELF_CHECK_STORAGE_KEY ? value : null),
      setItem: (key: string, next: string) => {
        calls.push(`set:${key}`);
        value = next;
      },
      removeItem: (key: string) => {
        calls.push(`remove:${key}`);
        value = null;
      },
    };
  }

  it("returns empty selections for corrupt, oversized or non-object JSON", () => {
    expect(readQuoteCheckSelections(fakeStorage("{not json"))).toEqual({});
    expect(readQuoteCheckSelections(fakeStorage('["missing"]'))).toEqual({});
    expect(readQuoteCheckSelections(fakeStorage("null"))).toEqual({});
    const oversized = JSON.stringify({
      demolition: "missing",
      pad: "x".repeat(QUOTE_SELF_CHECK_MAX_RAW_LENGTH),
    });
    expect(readQuoteCheckSelections(fakeStorage(oversized))).toEqual({});
    expect(
      readQuoteCheckSelections(fakeStorage(JSON.stringify({ demolition: "missing" }))),
    ).toEqual({ demolition: "missing" });
  });

  it("ignores __proto__ and constructor keys without polluting Object.prototype", () => {
    const parsed = readQuoteCheckSelections(
      fakeStorage(
        '{"__proto__":{"demolition":"missing","polluted":"yes"},"constructor":{"prototype":{"x":1}},"electrical":"vague"}',
      ),
    );
    expect(parsed).toEqual({ electrical: "vague" });
    expect(Object.getPrototypeOf(parsed)).toBe(Object.prototype);
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(({} as Record<string, unknown>).demolition).toBeUndefined();
  });

  it("writes only known ids and statuses, and removes the key when empty", () => {
    const storage = fakeStorage();
    const raw = writeQuoteCheckSelections(storage, {
      demolition: "missing",
      arithmetic: "missing",
      electrical: "maybe",
    } as unknown as QuoteCheckSelections);
    expect(raw).toBe('{"demolition":"missing"}');
    expect(storage.value).toBe('{"demolition":"missing"}');

    expect(writeQuoteCheckSelections(storage, {})).toBeNull();
    expect(storage.value).toBeNull();
    expect(storage.calls).toEqual([
      `set:${QUOTE_SELF_CHECK_STORAGE_KEY}`,
      `remove:${QUOTE_SELF_CHECK_STORAGE_KEY}`,
    ]);
  });
});

describe("quote page JSON-LD graph", () => {
  it("points isPartOf at the site WebSite node", () => {
    const data = buildQuotePageJsonLd("https://renocheck.homes");
    expect((data.isPartOf as { "@id": string })["@id"]).toBe(
      "https://renocheck.homes/#website",
    );
  });
});

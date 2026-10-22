/**
 * Q0 quotation self-check (no AI, no upload, no server state).
 * Checklist ids and reply questions follow docs/plans/PRF-quote-analysis-plan.md §8.1–§8.2.
 * `arithmetic` is intentionally absent.
 */

export const QUOTE_PAGE_TITLE_ZH = "報價自查清單";

export const QUOTE_PAGE_DESCRIPTION_ZH =
  "香港裝修報價自查清單：自己對住報價單逐項睇有冇寫齊、寫清楚。唔會評價格係咪合理，亦唔係專業意見。";

/** Single on-page explanation. Not a legal disclaimer. */
export const QUOTE_PAGE_LEAD_ZH =
  "呢個工具只幫你對住報價單，睇吓有冇寫齊、寫清楚，唔會評價格係咪合理，亦唔係專業意見。";

export const QUOTE_CHECKLIST_HEADING_ZH = "逐項自查";
export const QUOTE_REPLY_HEADING_ZH = "回覆訊息";
export const QUOTE_CONDITIONAL_NOTE_ZH = "如果報價有做呢類工程";
export const QUOTE_CLEAR_HEADING_ZH = "點樣先算寫清楚";
export const QUOTE_VAGUE_HEADING_ZH = "含糊例子";
export const QUOTE_REPLY_EMPTY_ZH =
  "揀咗「冇提及」或者「寫得含糊」之後，呢度會砌一段你可以複製去問對方嘅訊息。";
export const QUOTE_COPY_BUTTON_ZH = "複製訊息";
export const QUOTE_COPIED_STATUS_ZH = "已複製";
export const QUOTE_COPY_FAILED_STATUS_ZH =
  "複製唔到，已經幫你揀好上面成段文字，請自己複製。";
export const QUOTE_CLEARED_STATUS_ZH = "已清除選擇";
export const QUOTE_REPLY_NOTE_ZH = "發送前可以按自己情況改";
export const QUOTE_CLEAR_BUTTON_ZH = "清除選擇";

export const QUOTE_REPLY_GREETING_ZH =
  "你好，多謝你哋嘅報價。落實之前，想你哋幫手喺報價單寫清楚以下幾樣：";
export const QUOTE_REPLY_OVERFLOW_ZH = "另外仲有幾項細節，方便約個時間一齊過一次？";
export const QUOTE_REPLY_CLOSING_ZH =
  "麻煩改好之後再發一份更新報價俾我，我好對比清楚。唔該晒！";

export const QUOTE_REPLY_ITEM_LIMIT = 6;

export const QUOTE_HOWTO_NAME_ZH = "點樣自己對住報價單逐項檢查";

export const QUOTE_HOWTO_STEPS_ZH = [
  {
    name: "打開報價單",
    text: "準備好份報價單，逐項對住清單睇。",
  },
  {
    name: "為每項揀狀態",
    text: "每項揀有寫清楚、寫得含糊、冇提及，或者唔適用。",
  },
  {
    name: "複製回覆訊息",
    text: "如果有寫得含糊或者冇提及嘅項目，可以複製砌好嘅訊息，發送前按自己情況改。",
  },
] as const;

export const QUOTE_PAGE_NAV = [
  { href: "/", label: "返回搜尋" },
  { href: "/faq", label: "常見問題" },
  {
    href: "/guides/how-to-read-renovation-quotation",
    label: "裝修報價點睇",
  },
] as const;

/** Browser-only persistence. Not sent to the server. */
export const QUOTE_SELF_CHECK_STORAGE_KEY = "renocheck-quote-selfcheck-v1";

/** 20 ids x 4 statuses fit in well under 1 KB; anything larger is ignored. */
export const QUOTE_SELF_CHECK_MAX_RAW_LENGTH = 2048;

export const QUOTE_STATUS_OPTIONS = [
  { id: "clear", label: "有寫清楚", mark: "✅" },
  { id: "vague", label: "寫得含糊", mark: "⚠️" },
  { id: "missing", label: "冇提及", mark: "❌" },
  { id: "na", label: "唔適用", mark: "—" },
] as const;

export type QuoteCheckStatus = (typeof QUOTE_STATUS_OPTIONS)[number]["id"];

export const QUOTE_CHECK_ITEMS = [
  {
    id: "demolition",
    label: "拆舊範圍",
    conditional: false,
    clearExample: "列出拆走邊啲，例如舊地磚、櫃、牆身批盪、門。",
    vagueExample: "只寫「拆舊一式」，冇講拆邊度。",
    question: "拆舊包邊啲範圍？（例如舊地磚、櫃、門）",
  },
  {
    id: "debris_disposal",
    label: "運走廢料／泥頭",
    conditional: false,
    clearExample: "寫明廢料係咪你哋運走，同埋堆填或者運走費用邊個負責。",
    vagueExample: "冇提，或者只寫「另計」但冇單價。",
    question: "拆出嚟嘅廢料係咪你哋負責運走？相關費用有冇計埋？",
  },
  {
    id: "electrical",
    label: "電力工程細節",
    conditional: false,
    clearExample:
      "寫明有幾多個點、邊啲換新線、電箱同斷路器點安排，以及完工會唔會由註冊電業承辦商出 WR1。",
    vagueExample: "只寫「全屋電線翻新」。",
    question: "電力工程有幾多個點？係咪全換新線？完工會唔會由註冊電業承辦商發 WR1？",
  },
  {
    id: "plumbing",
    label: "水喉／去水",
    conditional: false,
    clearExample: "寫明喉管用咩物料、做幾多個位或者幾長，同埋會唔會試水壓。",
    vagueExample: "只寫「水喉工程一式」。",
    question: "水喉用咩物料、做幾多個位？完工會唔會試水壓？",
  },
  {
    id: "waterproofing",
    label: "防水",
    conditional: false,
    clearExample: "寫明邊度做防水層，同埋試水幾耐（例如 24 或者 48 小時）。",
    vagueExample: "有浴室或者廚房，但冇提防水。",
    question: "浴室／廚房有冇做防水？做完會唔會試水？試幾耐？",
  },
  {
    id: "gas",
    label: "煤氣工程",
    conditional: true,
    clearExample: "寫明由註冊氣體工程承辦商做。",
    vagueExample: "有列煤氣工程，但冇提邊個做。",
    question: "煤氣部分係咪由註冊氣體工程承辦商做？",
  },
  {
    id: "materials_spec",
    label: "物料品牌／型號／規格",
    conditional: false,
    clearExample: "寫明品牌、型號、尺寸、顏色同等級，例如磚、油漆同塗幾多層、板材、五金。",
    vagueExample: "只寫「優質瓷磚」或者「進口五金」。",
    question: "主要物料可唔可以列明品牌、型號、尺寸同顏色？",
  },
  {
    id: "quantities_units",
    label: "面積／數量／單位",
    conditional: false,
    clearExample: "每一行都有數量同單位，例如呎、平方呎、米、件、點。",
    vagueExample: "大項目只寫「一式」，冇分項數量。",
    question: "「一式」嘅項目可唔可以寫返數量同單位（例如幾多呎、幾多件）？",
  },
  {
    id: "provisional_items",
    label: "暫定／按實際計算項目",
    conditional: false,
    clearExample: "標明暫定或者按實際計嘅項目，有單價同埋上限。",
    vagueExample: "只寫「按實際情況收費」，冇單價。",
    question: "「按實際計」嘅項目單價係幾多？有冇上限？",
  },
  {
    id: "exclusions",
    label: "不包項目",
    conditional: false,
    clearExample: "有一份清楚列出唔包嘅項目。",
    vagueExample: "冇「唔包」呢一欄。",
    question: "有啲咩係唔包嘅？可唔可以列出嚟？",
  },
  {
    id: "timeline",
    label: "工期",
    conditional: false,
    clearExample: "有開工日期、做幾耐或者完工日期，同埋延誤點安排。",
    vagueExample: "只寫「約一個月」。",
    question: "幾時開工、幾時完工？如果延誤會點安排？",
  },
  {
    id: "payment_schedule",
    label: "付款階段",
    conditional: false,
    clearExample: "寫明訂金百分比、每期對應完成咗嘅工序，同埋尾數留到驗收執漏之後。",
    vagueExample: "只寫「訂金 50%」就冇下文，或者分期只跟日期、唔跟工序。",
    question: "可唔可以按完成嘅工序分期俾錢，並保留尾數到驗收執漏之後？",
  },
  {
    id: "variations",
    label: "加單／變更機制",
    conditional: false,
    clearExample: "加做或者改動要先書面確認同埋講好價錢，先至開工。",
    vagueExample: "冇提加單點處理。",
    question: "如果要加單或者改設計，係咪會先書面報價、我確認咗先做？",
  },
  {
    id: "warranty",
    label: "保養期",
    conditional: false,
    clearExample: "寫明保養幾耐、包啲乜、唔包啲乜。",
    vagueExample: "只寫「有保養」。",
    question: "保養期幾耐？保養包啲乜、唔包啲乜？",
  },
  {
    id: "defects_handover",
    label: "驗收及執漏",
    conditional: false,
    clearExample: "寫明完工會一齊驗收，同埋執漏有限期。",
    vagueExample: "冇提驗收同執漏。",
    question: "完工會唔會一齊驗收？執漏有冇期限？",
  },
  {
    id: "licence_registration",
    label: "牌照／註冊",
    conditional: true,
    clearExample:
      "如果有小型工程（例如加建間隔牆、冷氣機支架、簷篷），寫明註冊編號或者級別；如果涉及結構，寫明邊個處理屋宇署申請。",
    vagueExample: "有列呢類工程，但冇提註冊資料。",
    question: "呢類小型工程由邊個註冊承建商做？註冊編號係？",
  },
  {
    id: "insurance",
    label: "保險",
    conditional: false,
    clearExample: "寫明有冇第三者責任保險同僱員補償保險。",
    vagueExample: "冇提保險。",
    question: "工程有冇買第三者責任保險同僱員補償保險（勞保）？",
  },
  {
    id: "site_protection_cleanup",
    label: "保護及清潔",
    conditional: false,
    clearExample: "寫明點保護地台、電梯同公眾地方，同埋完工有冇清潔。",
    vagueExample: "冇提保護同清潔。",
    question: "施工期間會點保護地台同公眾地方？完工有冇清潔？",
  },
  {
    id: "building_mgmt",
    label: "管理處手續",
    conditional: false,
    clearExample: "寫明邊個去申請、按金邊個出、開工時間。",
    vagueExample: "冇提管理處手續。",
    question: "管理處申請同裝修按金由邊個負責？",
  },
  {
    id: "quote_identity",
    label: "報價資料齊全",
    conditional: false,
    clearExample: "有公司全名、商業登記號碼、地址、聯絡方法、報價日期同有效期。",
    vagueExample: "冇商業登記號碼，或者冇報價日期。",
    question: "可唔可以喺報價單加返公司全名、商業登記號碼同報價日期？",
  },
] as const;

export type QuoteCheckItemId = (typeof QUOTE_CHECK_ITEMS)[number]["id"];

export type QuoteCheckSelections = Partial<
  Record<QuoteCheckItemId, QuoteCheckStatus>
>;

const STATUS_IDS = new Set<string>(QUOTE_STATUS_OPTIONS.map((option) => option.id));

export function quoteCheckProgressLabel(selectedCount: number): string {
  return `已揀 ${selectedCount}／${QUOTE_CHECK_ITEMS.length} 項`;
}

export function parseQuoteCheckSelections(value: unknown): QuoteCheckSelections {
  if (!value || typeof value !== "object") return {};
  const record = value as Record<string, unknown>;
  const selections: QuoteCheckSelections = {};
  for (const item of QUOTE_CHECK_ITEMS) {
    const status = record[item.id];
    if (typeof status === "string" && STATUS_IDS.has(status)) {
      selections[item.id] = status as QuoteCheckStatus;
    }
  }
  return selections;
}

export function readQuoteCheckSelections(
  storage: Pick<Storage, "getItem">,
): QuoteCheckSelections {
  try {
    const raw = storage.getItem(QUOTE_SELF_CHECK_STORAGE_KEY);
    if (!raw || raw.length > QUOTE_SELF_CHECK_MAX_RAW_LENGTH) return {};
    return parseQuoteCheckSelections(JSON.parse(raw));
  } catch {
    return {};
  }
}

export function writeQuoteCheckSelections(
  storage: Pick<Storage, "setItem" | "removeItem">,
  selections: QuoteCheckSelections,
): string | null {
  const normalized = parseQuoteCheckSelections(selections);
  if (Object.keys(normalized).length === 0) {
    storage.removeItem(QUOTE_SELF_CHECK_STORAGE_KEY);
    return null;
  }
  const raw = JSON.stringify(normalized);
  storage.setItem(QUOTE_SELF_CHECK_STORAGE_KEY, raw);
  return raw;
}

const EMPTY_SELECTIONS: QuoteCheckSelections = {};
const UNREAD = Symbol("unread");
const listeners = new Set<() => void>();
let cachedRaw: string | null | typeof UNREAD = UNREAD;
let cachedSelections: QuoteCheckSelections = EMPTY_SELECTIONS;
let memoryOnly = false;

function notifyQuoteCheckListeners(): void {
  for (const listener of listeners) listener();
}

export function subscribeQuoteCheckSelections(listener: () => void): () => void {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function getQuoteCheckSelectionsServerSnapshot(): QuoteCheckSelections {
  return EMPTY_SELECTIONS;
}

export function getQuoteCheckSelectionsSnapshot(): QuoteCheckSelections {
  if (memoryOnly || typeof window === "undefined") return cachedSelections;
  let raw: string | null;
  try {
    raw = localStorage.getItem(QUOTE_SELF_CHECK_STORAGE_KEY);
  } catch {
    return cachedSelections;
  }
  if (raw === cachedRaw) return cachedSelections;
  cachedRaw = raw;
  cachedSelections = raw ? readQuoteCheckSelections(localStorage) : EMPTY_SELECTIONS;
  return cachedSelections;
}

function replaceQuoteCheckSelections(next: QuoteCheckSelections): void {
  const normalized = parseQuoteCheckSelections(next);
  try {
    cachedRaw = writeQuoteCheckSelections(localStorage, normalized);
    memoryOnly = false;
  } catch {
    memoryOnly = true;
  }
  cachedSelections = normalized;
  notifyQuoteCheckListeners();
}

export function updateQuoteCheckSelection(
  id: QuoteCheckItemId,
  status: QuoteCheckStatus,
): void {
  replaceQuoteCheckSelections({
    ...getQuoteCheckSelectionsSnapshot(),
    [id]: status,
  });
}

export function clearQuoteCheckSelections(): void {
  replaceQuoteCheckSelections({});
}

/**
 * ❌ first, then ⚠️, each group in checklist order. At most 6 questions.
 * Returns null when nothing is missing or vague.
 */
export function buildQuoteReplyMessage(
  selections: QuoteCheckSelections,
): string | null {
  const missing = QUOTE_CHECK_ITEMS.filter(
    (item) => selections[item.id] === "missing",
  );
  const vague = QUOTE_CHECK_ITEMS.filter(
    (item) => selections[item.id] === "vague",
  );
  const flagged = [...missing, ...vague];
  if (flagged.length === 0) return null;

  const shown = flagged.slice(0, QUOTE_REPLY_ITEM_LIMIT);
  const lines = [
    QUOTE_REPLY_GREETING_ZH,
    ...shown.map((item, index) => `${index + 1}. ${item.question}`),
  ];
  if (flagged.length > QUOTE_REPLY_ITEM_LIMIT) {
    lines.push(QUOTE_REPLY_OVERFLOW_ZH);
  }
  lines.push(QUOTE_REPLY_CLOSING_ZH);
  return lines.join("\n");
}

export function quoteSelfCheckUserFacingCopy(): readonly string[] {
  return [
    QUOTE_PAGE_TITLE_ZH,
    QUOTE_PAGE_DESCRIPTION_ZH,
    QUOTE_PAGE_LEAD_ZH,
    QUOTE_CHECKLIST_HEADING_ZH,
    QUOTE_REPLY_HEADING_ZH,
    QUOTE_CONDITIONAL_NOTE_ZH,
    QUOTE_CLEAR_HEADING_ZH,
    QUOTE_VAGUE_HEADING_ZH,
    QUOTE_REPLY_EMPTY_ZH,
    QUOTE_COPY_BUTTON_ZH,
    QUOTE_COPIED_STATUS_ZH,
    QUOTE_COPY_FAILED_STATUS_ZH,
    QUOTE_CLEARED_STATUS_ZH,
    QUOTE_REPLY_NOTE_ZH,
    QUOTE_CLEAR_BUTTON_ZH,
    QUOTE_REPLY_GREETING_ZH,
    QUOTE_REPLY_OVERFLOW_ZH,
    QUOTE_REPLY_CLOSING_ZH,
    QUOTE_HOWTO_NAME_ZH,
    quoteCheckProgressLabel(0),
    ...QUOTE_STATUS_OPTIONS.flatMap((option) => [option.label, option.mark]),
    ...QUOTE_PAGE_NAV.map((link) => link.label),
    ...QUOTE_HOWTO_STEPS_ZH.flatMap((step) => [step.name, step.text]),
    ...QUOTE_CHECK_ITEMS.flatMap((item) => [
      item.label,
      item.clearExample,
      item.vagueExample,
      item.question,
    ]),
  ];
}

export function buildQuotePageJsonLd(siteUrl: string): Record<string, unknown> {
  const pageUrl = `${siteUrl}/quote`;
  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${pageUrl}#webpage`,
    url: pageUrl,
    name: QUOTE_PAGE_TITLE_ZH,
    description: QUOTE_PAGE_DESCRIPTION_ZH,
    inLanguage: "zh-HK",
    isPartOf: {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "Renocheck 裝修點評",
      url: siteUrl,
    },
    mainEntity: {
      "@type": "HowTo",
      "@id": `${pageUrl}#howto`,
      name: QUOTE_HOWTO_NAME_ZH,
      description: QUOTE_PAGE_LEAD_ZH,
      inLanguage: "zh-HK",
      step: QUOTE_HOWTO_STEPS_ZH.map((step, index) => ({
        "@type": "HowToStep",
        position: index + 1,
        name: step.name,
        text: step.text,
      })),
    },
  };
}

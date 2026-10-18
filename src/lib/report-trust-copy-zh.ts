/**
 * PR-BC report trust UI copy + official URLs (Aaron review).
 * UI-only constants — not written to RiskReport; no REPORT_VERSION bump.
 */

/** Verified HTTP 200 on 2026-10-18 (RenoCheck smoke). See docs/bd-register/sources.md */
export const CR_ESERVICES_URL = "https://www.e-services.cr.gov.hk/";
export const ICRIS_HOME_URL = CR_ESERVICES_URL;

export const ORO_INFO_HOME_URL =
  "https://www.oro.gov.hk/cht/our_services/electronic_services/compulsory.html";

export const GOV_HK_BR_ENQUIRY_URL =
  "https://www.gov.hk/tc/residents/taxes/etax/services/brn_enquiry.htm";

export const BD_MWC_REGISTER_SEARCH_URL =
  "https://www.bd.gov.hk/tc/resources/online-tools/registers-search/registrationsearch.html";

export const BD_MINOR_WORKS_OFFICIAL_URL =
  "https://www.bd.gov.hk/tc/building-works/minor-works/minor-works-items/who-can-carry-out-minor-works/index.html";

export const BD_EXEMPTED_WORKS_URL =
  "https://www.bd.gov.hk/tc/building-works/minor-works/designated-exempted-works/index.html";

export const BD_BRAVO_BUILDING_RECORDS_URL =
  "https://www.bd.gov.hk/tc/resources/online-tools/BRAVO-online-building-records/index.html";

export const JUDICIARY_DAILY_CAUSE_LIST_URL =
  "https://e-services.judiciary.hk/dcl/index.jsp?lang=tc";

export const REPORT_TRUST_FORBIDDEN_ZH = [
  "高風險",
  "小心",
  "騙子",
  "黑店",
  "黑名單",
  "違法",
  "犯法",
  "觸犯法例",
  "違規",
  "詐騙",
  "欺詐",
  "呃錢",
  "走佬",
  "不可信",
  "唔可信",
  "無風險",
  "零風險",
  "安全",
  "保證",
  "可靠",
  "推薦",
  "放心",
  "有問題",
] as const;

/** 只准以下整句否定用法出現；測試會先扣走呢啲句子先至檢查禁用詞 */
export const REPORT_TRUST_NEGATED_ALLOWLIST_ZH = [
  "唔代表對方有問題",
  "唔代表查詢對象一定有問題",
  "並不構成品質保證或聘用建議",
  "非對承辦商的推薦",
] as const;

export const CONTRACT_CHECKLIST_HEADING_ZH = "簽約前可參考提問";
export const CONTRACT_CHECKLIST_HEADING_WITH_ACTIONABLE_ZH = "通用簽約提問";

export const DEFAULT_CONTRACT_CHECKLIST_ZH: readonly string[] = [
  "訂金佔總價幾多？俾錢之前有冇睇過正式合約同圖則？",
  "每期付款係咪同實際完成嘅工序掛鈎？有冇保留尾期款項，等執漏或者保養期完咗先俾？",
  "保養期幾耐、包邊啲項目？手工同物料係咪分開計保養？",
  "對方有冇工程全保、第三者責任保險同僱員補償保險（勞保）？可唔可以出示保單？由邊方負責買？",
  "物料品牌、型號同單價有冇寫清楚？如果要改用代替品，係咪要事先書面同意？",
  "如果延誤或者做唔完，合約有冇寫明終止、退款或者交俾第三方接手嘅安排？",
];

export const NEXT_STEPS_HEADING_ZH = "下一步點做";
export const NEXT_STEPS_INTRO_ZH =
  "以下係簽約前常見嘅核實步驟，唔係本次查證結果。";

export type NextStepItem = {
  text: string;
  link?: { href: string; label: string };
};

export const NEXT_STEPS_MINOR_WORKS_LINK_LABEL_ZH = "屋宇署「誰可進行小型工程？」";

export const NEXT_STEPS_ITEMS: readonly NextStepItem[] = [
  {
    text:
      "要對方出示有效嘅商業登記證，核對合約上嘅商號名稱同商業登記號碼係咪一致",
  },
  { text: "合約要寫明工程範圍、物料規格、完工日期、保養期同執漏安排" },
  { text: "按工程進度分期付款，避免一次過俾大額訂金" },
  {
    text:
      "如果涉及小型工程（例如拆改單位間隔牆、開鑿樓板洞口），確認對方係屋宇署註冊承建商，並且已經就相關級別同類型註冊",
    link: {
      href: BD_MINOR_WORKS_OFFICIAL_URL,
      label: NEXT_STEPS_MINOR_WORKS_LINK_LABEL_ZH,
    },
  },
  { text: "保留報價單、合約、收據同對話紀錄" },
];

export const NEXT_STEPS_ITEMS_ZH: readonly string[] = NEXT_STEPS_ITEMS.map(
  (i) => i.text,
);

export const REPORT_SCOPE_LIMITS_HEADING_ZH = "呢份報告查唔到乜";

export const REPORT_SCOPE_LIMITS_BULLETS_ZH: readonly string[] = [
  "獨資或合夥經營、個人師傅：如果冇公司名稱，或者對唔到公開名冊，報告可能只得好少資料；就算判詞或者其他來源寫住「獨資經營」，都唔等於已經核實對方身份。",
  "法庭審訊案件表：本報告唔顯示審訊案件表資料，你可以自行查閱官方頁面（連結喺下面）。",
  "冇公開判詞嘅糾紛：私下協商、律師信，以及大部分小額錢債申索（一般唔會發布判詞），未必會出現喺本報告已匯入嘅司法機構判詞或者公開討論摘要入面。",
  "本報告唔涵蓋消費者委員會投訴紀錄。",
  "公司內部紀錄、私人訊息同已刪除嘅帖文，唔喺網上搜尋同本系統摘錄範圍內。",
  "工程質素同造工水準：公開討論摘要未必反映現場實際情況，亦唔構成工程驗收或者專業監理意見。",
  "非裝修業務：同名商號喺其他業務嘅評論，未必同今次裝修委聘有關。",
  "海外公司，或者只喺內地營運嘅公司：香港公開名冊同本地網上搜尋未必覆蓋到。",
];

export const REPORT_SCOPE_LIMITS_CLOSING_ZH =
  "以上限制唔代表查詢對象一定有問題，只係說明本報告嘅資料範圍。";

export const DAILY_CAUSE_LIST_SELF_SERVICE_HEADING_ZH =
  "想睇吓有冇小額錢債審裁處或者其他法院嘅聆訊排期？";

export const DAILY_CAUSE_LIST_SELF_SERVICE_BODY_ZH: readonly string[] = [
  "可以喺司法機構官方「審訊案件表」自行查閱（連結喺下面）。",
  "審訊案件表一般喺審訊日對上一個工作天下午6:30刊出，只列出當日同下一個工作天嘅聆訊，唔包括判決或者案件結果。",
  "有聆訊排期只代表有聆訊安排，唔代表任何一方有錯、勝訴或者敗訴。",
  "揀咗法院之後，可以用瀏覽器搜尋（例如 Ctrl+F 或 ⌘+F）輸入公司名稱自行對照；本站唔會代你預填或者查詢。",
];

export const DAILY_CAUSE_LIST_LINK_LABEL_ZH = "司法機構審訊案件表（官方）";

export const DAILY_CAUSE_LIST_HERO_NOTE_ZH =
  "審訊案件表請喺司法機構網站自行查閱；小額錢債審裁處案件一般冇公開判詞。";

export const NON_LIMITED_NOTICE_HEADING_ZH = "非有限公司提示";

export const NON_LIMITED_CONTRACTOR_NOTICE_ZH =
  "根據你輸入或者名冊顯示嘅名稱，對方未必係有限公司（名稱冇「有限公司」或「Limited」）。如果對方係獨資或合夥經營，東主或合夥人一般要對業務債務負無限責任。簽約前請核對商業登記證上嘅商號名稱、號碼同東主／合夥人資料同合約一致，並以書面寫明付款、保養同終止安排。";

export const UNVERIFIED_COMPANY_REGISTRATION_ALERT_HEADING_ZH =
  "公司註冊處同屋宇署名冊都未有對應紀錄";

export const UNVERIFIED_COMPANY_REGISTRATION_ALERT_BODY_PARAGRAPHS_ZH: readonly string[] =
  [
    "今次喺公司註冊處存續本地公司開放數據同屋宇署註冊小型工程承建商名冊，都搵唔到同呢個名稱對應嘅紀錄。",
    "搵唔到紀錄唔代表對方有問題，可能係名稱寫法唔同，或者用咗另一個登記名稱。建議要對方出示商業登記證同公司註冊證明書核對。",
  ];

/** C.2c note：MWC miss + CR matched */
export const MWC_MISS_NOTE_HEADING_ZH =
  "屋宇署小型工程承建商名冊未有對應紀錄";

export const MWC_MISS_EXEMPT_ENGINEERING_PARAGRAPH_ZH =
  "一般室內裝修（小型工程除外），例如油漆、室內批灰、貼牆紙，或者維修、更換衞生設備，屬《建築物條例》訂明嘅豁免工程，一般唔需要由註冊承建商進行；但部分室內工程，例如拆改單位間隔牆、開鑿樓板洞口、加厚樓板，可能屬小型工程，要由合資格嘅屋宇署註冊承建商進行。詳情以屋宇署官方說明為準。";

export const MWC_MISS_NOTE_BODY_PARAGRAPHS_ZH: readonly string[] = [
  "未有對應紀錄唔代表對方有問題：可能係名稱寫法唔同、用咗另一個登記名稱，或者今次工程本身唔需要註冊承建商。",
  "公司註冊處有呢間公司嘅紀錄，但屋宇署註冊小型工程承建商名冊未有對應紀錄。",
  MWC_MISS_EXEMPT_ENGINEERING_PARAGRAPH_ZH,
];

export const MWC_MISS_NOTE_CR_SIMILAR_ZH =
  "公司註冊處有名稱相近嘅公司紀錄，請核對完整名稱同公司編號。";

/** PR #13 fallback when CR inconclusive + MWC miss */
export const MWC_MISS_FALLBACK_BODY_PARAGRAPHS_ZH: readonly string[] = [
  "未有對應紀錄唔代表對方有問題：可能係名稱寫法唔同、用咗另一個登記名稱，或者今次工程本身唔需要註冊承建商。",
  "今次只對照咗本站匯入嘅屋宇署註冊小型工程承建商名冊，冇對照公司註冊處或者稅務局商業登記署嘅即時紀錄。",
  MWC_MISS_EXEMPT_ENGINEERING_PARAGRAPH_ZH,
];

export const MWC_MISS_FALLBACK_CR_INCONCLUSIVE_ZH =
  "今次查過公司註冊處存續本地公司開放數據，但未能確定對應嘅公司紀錄；屋宇署註冊小型工程承建商名冊亦未有對應紀錄。";

export function mwcMissFallbackBodyParagraphsZh(
  lookupStatus?: string,
): readonly string[] {
  if (lookupStatus === "ok") {
    return [
      MWC_MISS_FALLBACK_BODY_PARAGRAPHS_ZH[0],
      MWC_MISS_FALLBACK_CR_INCONCLUSIVE_ZH,
      MWC_MISS_EXEMPT_ENGINEERING_PARAGRAPH_ZH,
    ];
  }
  return MWC_MISS_FALLBACK_BODY_PARAGRAPHS_ZH;
}

export function mwcMissNoteBodyParagraphsZh(
  matchTier?: "A" | "B" | "C",
): readonly string[] {
  if (matchTier === "C") {
    return [
      MWC_MISS_NOTE_BODY_PARAGRAPHS_ZH[0],
      MWC_MISS_NOTE_CR_SIMILAR_ZH,
      MWC_MISS_EXEMPT_ENGINEERING_PARAGRAPH_ZH,
    ];
  }
  return MWC_MISS_NOTE_BODY_PARAGRAPHS_ZH;
}

/** @deprecated use alert/note headings */
export const UNVERIFIED_COMPANY_REGISTRATION_HEADING_ZH =
  MWC_MISS_NOTE_HEADING_ZH;

export const UNVERIFIED_COMPANY_REGISTRATION_BODY_PARAGRAPHS_ZH =
  MWC_MISS_NOTE_BODY_PARAGRAPHS_ZH;

export const CR_DATA_ATTRIBUTION_ZH =
  "資料來源：香港特別行政區政府公司註冊處，經 DATA.GOV.HK 提供";

export const CR_LOOKUP_DEGRADED_ZH =
  "公司註冊處開放數據暫時未能查詢；請稍後再試或自行查閱公司註冊處電子服務。";

export function crHintIncorporationUnderOneYearZh(incorporationDateIso: string): string {
  return `公司註冊處紀錄顯示成立日期為 ${incorporationDateIso}（查詢時成立未滿一年）。`;
}

export const UNVERIFIED_COMPANY_REGISTRATION_EXEMPTED_LINK_LABEL_ZH =
  "屋宇署「指定豁免工程」";

export const UNVERIFIED_COMPANY_REGISTRATION_SEE_NEXT_STEPS_ZH =
  "你可以參考下面「下一步點做」清單。";

export const LEGAL_EVENT_SOURCE_LINK_LABEL_ZH = "司法機構判詞（官方）";

export const OFFICIAL_VERIFY_SECTION_HEADING_ZH = "官方查證連結";

export const OFFICIAL_VERIFY_LINK_LABELS = {
  icris: "公司註冊處電子服務網站（公司查冊）",
  oro: "破產管理署：破產及強制性清盤紀錄查冊（收費）",
  brEnquiry: "政府一站通：查詢商業登記號碼（稅務局商業登記署）",
  bdRegister: "屋宇署：搜尋註冊專業人士或承建商",
  bravo: "屋宇署百樓圖網（網上樓宇記錄）",
} as const;

export const OFFICIAL_VERIFY_LINK_NOTES = {
  brEnquiry: "輸入業務全名同所在地區，就可以查到商業登記號碼。",
  bdRegister:
    "搜尋結果如有「%」標記，表示該人士或承建商喺最近三年（或者紀律委員會命令嘅期限內）曾經受紀律處分；本報告唔會自動查閱呢個標記。",
  bravo:
    "百樓圖網提供樓宇圖則同相關紀錄（要登記同收費），同承建商名冊無關；本報告唔會自動讀取。",
} as const;

/** All user-facing strings from this module (for compliance grep tests). */
export function collectReportTrustCopyStrings(): string[] {
  const parts: string[] = [
    CONTRACT_CHECKLIST_HEADING_ZH,
    CONTRACT_CHECKLIST_HEADING_WITH_ACTIONABLE_ZH,
    NEXT_STEPS_HEADING_ZH,
    NEXT_STEPS_INTRO_ZH,
    ...NEXT_STEPS_ITEMS_ZH,
    ...NEXT_STEPS_ITEMS.flatMap((i) =>
      i.link ? [i.link.label] : [],
    ),
    NEXT_STEPS_MINOR_WORKS_LINK_LABEL_ZH,
    REPORT_SCOPE_LIMITS_HEADING_ZH,
    ...REPORT_SCOPE_LIMITS_BULLETS_ZH,
    REPORT_SCOPE_LIMITS_CLOSING_ZH,
    DAILY_CAUSE_LIST_SELF_SERVICE_HEADING_ZH,
    ...DAILY_CAUSE_LIST_SELF_SERVICE_BODY_ZH,
    DAILY_CAUSE_LIST_LINK_LABEL_ZH,
    DAILY_CAUSE_LIST_HERO_NOTE_ZH,
    NON_LIMITED_NOTICE_HEADING_ZH,
    NON_LIMITED_CONTRACTOR_NOTICE_ZH,
    UNVERIFIED_COMPANY_REGISTRATION_ALERT_HEADING_ZH,
    ...UNVERIFIED_COMPANY_REGISTRATION_ALERT_BODY_PARAGRAPHS_ZH,
    MWC_MISS_NOTE_HEADING_ZH,
    ...MWC_MISS_NOTE_BODY_PARAGRAPHS_ZH,
    MWC_MISS_NOTE_CR_SIMILAR_ZH,
    ...MWC_MISS_FALLBACK_BODY_PARAGRAPHS_ZH,
    MWC_MISS_FALLBACK_CR_INCONCLUSIVE_ZH,
    CR_DATA_ATTRIBUTION_ZH,
    crHintIncorporationUnderOneYearZh("2026-01-01"),
    CR_LOOKUP_DEGRADED_ZH,
    UNVERIFIED_COMPANY_REGISTRATION_EXEMPTED_LINK_LABEL_ZH,
    UNVERIFIED_COMPANY_REGISTRATION_SEE_NEXT_STEPS_ZH,
    LEGAL_EVENT_SOURCE_LINK_LABEL_ZH,
    OFFICIAL_VERIFY_SECTION_HEADING_ZH,
    ...Object.values(OFFICIAL_VERIFY_LINK_LABELS),
    ...Object.values(OFFICIAL_VERIFY_LINK_NOTES),
    ...DEFAULT_CONTRACT_CHECKLIST_ZH,
  ];
  return parts;
}

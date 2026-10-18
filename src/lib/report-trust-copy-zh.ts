/**
 * PR-BC report trust UI copy + official URLs (Aaron review).
 * UI-only constants — not written to RiskReport; no REPORT_VERSION bump.
 */

/** Verified HTTP 200 on 2026-10-18 (RenoCheck smoke). See docs/bd-register/sources.md */
export const ICRIS_HOME_URL = "https://www.icris.cr.gov.hk/csci/";

export const ORO_INFO_HOME_URL = "https://www.oro.gov.hk/eng/home/home.html";

export const GOV_HK_BR_ENQUIRY_URL =
  "https://www.gov.hk/tc/residents/taxes/etax/services/brn_enquiry.htm";

export const BD_MWC_REGISTER_SEARCH_URL =
  "https://www.bd.gov.hk/tc/resources/online-tools/registers-search/registrationsearch.html";

export const BD_DISCIPLINE_REGISTER_SEARCH_URL = BD_MWC_REGISTER_SEARCH_URL;

export const BD_MINOR_WORKS_OFFICIAL_URL =
  "https://www.bd.gov.hk/tc/building-works/minor-works/minor-works-items/who-can-carry-out-minor-works/index.html";

export const BD_BRAVO_BUILDING_RECORDS_URL =
  "https://www.bd.gov.hk/tc/resources/online-tools/BRAVO-online-building-records/index.html";

/** Judicial daily cause list (e-services; legacy judiciary.hk path 404 as of 2026-10-18). */
export const JUDICIARY_DAILY_CAUSE_LIST_URL =
  "https://e-services.judiciary.hk/dcl/index.jsp?lang=tc";

export const REPORT_TRUST_FORBIDDEN_ZH = [
  "高風險",
  "小心",
  "騙子",
  "黑店",
  "違法",
  "無風險",
] as const;

export const CONTRACT_CHECKLIST_HEADING_ZH = "簽約前可參考提問";
export const CONTRACT_CHECKLIST_HEADING_WITH_ACTIONABLE_ZH = "通用簽約提問";

export const DEFAULT_CONTRACT_CHECKLIST_ZH: readonly string[] = [
  "訂金佔總價幾多？付款前有冇睇過正式合約同圖則？",
  "每期付款是否與實際完成工序掛鈎？有無保留最後一期作保養期保證？",
  "保養期多久、涵蓋咩項目？手工與物料是否分開保養？",
  "承建商是否提供工程全險或第三者責任保險證明？邊方負責投購？",
  "物料品牌、型號與單價是否列明？改用替代品要否書面確認？",
  "若延誤或工程未能完成，合約有無明確終止、退款或接手安排？",
];

export const NEXT_STEPS_HEADING_ZH = "下一步點做";
export const NEXT_STEPS_INTRO_ZH =
  "以下為簽約前常見核實步驟，唔代表本次查證結果。";

export const NEXT_STEPS_ITEMS_ZH: readonly string[] = [
  "要對方出示商業登記證，核對合約上嘅公司名同 BR 號",
  "合約要寫明工程範圍、物料規格、完工日期、保養期、執漏安排",
  "按工程進度分期付款，避免一次過俾大額訂金",
  "小型工程確認係註冊承建商",
  "保留報價單、單據、對話紀錄",
];

export const NEXT_STEPS_MINOR_WORKS_LINK_LABEL_ZH =
  "屋宇署：誰可進行小型工程";

export const REPORT_SCOPE_LIMITS_HEADING_ZH = "呢份報告查唔到乜";

export const REPORT_SCOPE_LIMITS_BULLETS_ZH: readonly string[] = [
  "獨資經營／個人師傅：若無公司登記名稱或無法與公開名冊對照，可能只顯示有限資料；判詞紀錄或標示「獨資經營」，不等同已核實身份。（專用提示見上方區塊。）",
  "法庭每日審訊排期表：本報告唔顯示排期表數據（含匿名條數）；直至司法機構授權前維持如此。可自行查閱官方排期頁（見下方連結）。",
  "未進入法院／未刊憲的糾紛：私下協商、律師信、小型申索等，未必出現於已匯入 LRS 判詞或公開討論摘要。",
  "消費者委員會投訴：除非有公開新聞稿或譴責名單連結，本報告唔自動涵蓋 CC 個案資料庫。",
  "公司內部紀錄、即時通訊私訊、已刪帖：不在網搜與本系統摘錄範圍內。",
  "工程質素、造工水準：公開討論摘要未必反映現場狀況；唔構成工程驗收或專業監理意見。",
  "非裝修業務：同名商號其他業務之負面評論未必與本次委聘相關。",
  "海外公司或僅內地營運主體：香港公開名冊與本港網搜可能無覆蓋。",
];

export const REPORT_SCOPE_LIMITS_CLOSING_ZH =
  "以上限制不代表查詢對象一定有問題，只說明本報告的資料邊界。";

export const DAILY_CAUSE_LIST_SELF_SERVICE_HEADING_ZH =
  "想睇有冇小額錢債或其他法庭排期？";

export const DAILY_CAUSE_LIST_SELF_SERVICE_BODY_ZH: readonly string[] = [
  "可於司法機構官方「審訊案件表」自行查閱（連結如下）。",
  "該服務一般只顯示近期及未來數日嘅聆訊排期，唔包括判決結果或案件結果摘要。",
  "排期僅表示聆訊安排，唔代表任何一方敗訴或勝訴。",
  "建議在官方頁面用瀏覽器搜尋（例如 Ctrl+F 或 ⌘+F）輸入公司名稱自行對照；本站唔會預填查詢。",
];

export const DAILY_CAUSE_LIST_LINK_LABEL_ZH = "司法機構審訊案件表（官方）";

export const NON_LIMITED_CONTRACTOR_NOTICE_ZH =
  "呢個承建商以獨資或合夥形式登記，唔係有限公司。獨資／合夥經營者須對業務債務負無限責任，但如有糾紛，追討程序可能較複雜。建議簽訂書面合約，列明付款、保養及終止安排。";

export const NON_LIMITED_CAUSE_LIST_SCOPE_ZH =
  "本報告唔會顯示非有限公司嘅法院排期資料。";

export const UNVERIFIED_COMPANY_REGISTRATION_HEADING_ZH =
  "未能核實此公司註冊";

export const UNVERIFIED_COMPANY_REGISTRATION_BODY_PARAGRAPHS_ZH: readonly string[] =
  [
    "「未能核實」唔代表對方一定觸犯法例，亦唔代表一定可靠；只表示本次對照範圍內冇搵到對應官方登記紀錄。",
    "本次對照範圍包括屋宇署承建商名冊及 LRS 判詞（如有）；未包括公司註冊處即時查冊。",
    "純室內工程（例如油漆、地板、傢俬）毋須屋宇署註冊；涉及小型工程應使用註冊承建商（見屋宇署官方說明）。",
  ];

export const UNVERIFIED_COMPANY_REGISTRATION_SEE_NEXT_STEPS_ZH =
  "你可參考下方「下一步點做」清單。";

export const OFFICIAL_VERIFY_LINK_LABELS = {
  icris: "公司註冊處綜合資訊系統（ICRIS）查冊首頁",
  oro: "破產管理署（一般資訊）",
  brEnquiry: "政府一站通：商業登記號查詢",
  bdRegister: "屋宇署註冊承建商搜尋",
  bdDiscipline: "屋宇署名冊搜尋（紀律處分標記須於官方頁自行查閱）",
  bravo: "屋宇署網上樓宇紀錄（BRAVO）",
} as const;

export const OFFICIAL_VERIFY_LINK_NOTES = {
  bravo:
    "工程紀錄與屋宇署 MWC 名冊不同；本報告唔自動拉取 BRAVO 資料。",
  bdDiscipline:
    "本報告唔自動查閱紀律處分標記；請於官方名冊搜尋自行核實。",
} as const;

/** All user-facing strings from this module (for compliance grep tests). */
export function collectReportTrustCopyStrings(): string[] {
  const parts: string[] = [
    CONTRACT_CHECKLIST_HEADING_ZH,
    CONTRACT_CHECKLIST_HEADING_WITH_ACTIONABLE_ZH,
    NEXT_STEPS_HEADING_ZH,
    NEXT_STEPS_INTRO_ZH,
    ...NEXT_STEPS_ITEMS_ZH,
    NEXT_STEPS_MINOR_WORKS_LINK_LABEL_ZH,
    REPORT_SCOPE_LIMITS_HEADING_ZH,
    ...REPORT_SCOPE_LIMITS_BULLETS_ZH,
    REPORT_SCOPE_LIMITS_CLOSING_ZH,
    DAILY_CAUSE_LIST_SELF_SERVICE_HEADING_ZH,
    ...DAILY_CAUSE_LIST_SELF_SERVICE_BODY_ZH,
    DAILY_CAUSE_LIST_LINK_LABEL_ZH,
    NON_LIMITED_CONTRACTOR_NOTICE_ZH,
    NON_LIMITED_CAUSE_LIST_SCOPE_ZH,
    UNVERIFIED_COMPANY_REGISTRATION_HEADING_ZH,
    ...UNVERIFIED_COMPANY_REGISTRATION_BODY_PARAGRAPHS_ZH,
    UNVERIFIED_COMPANY_REGISTRATION_SEE_NEXT_STEPS_ZH,
    ...Object.values(OFFICIAL_VERIFY_LINK_LABELS),
    ...Object.values(OFFICIAL_VERIFY_LINK_NOTES),
    ...DEFAULT_CONTRACT_CHECKLIST_ZH,
  ];
  return parts;
}

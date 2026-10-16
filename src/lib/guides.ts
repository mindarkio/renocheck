/**
 * Homeowner guides (/guides/*). Every fact here must trace to an official source in `sources`.
 * Last fact-check: 2026-10-16.
 */

export type GuideSection = {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
};

export type GuideSource = { label: string; url: string };

export type Guide = {
  slug: string;
  title: string;
  /** Short card tag. */
  category: string;
  /** Meta description (≈ 80–120 字). */
  description: string;
  /** Answer-first lead paragraph (AEO). */
  answer: string;
  sections: GuideSection[];
  sources: GuideSource[];
  datePublished: string;
  dateModified: string;
};

const BD_REGISTER_SEARCH: GuideSource = {
  label: "屋宇署：註冊專業人士及承建商名冊搜尋",
  url: "https://www.bd.gov.hk/tc/resources/online-tools/registers-search/registrationsearch.html",
};
const BD_WHO_CAN: GuideSource = {
  label: "屋宇署：誰可進行小型工程？",
  url: "https://www.bd.gov.hk/tc/building-works/minor-works/minor-works-items/who-can-carry-out-minor-works/index.html",
};
const BD_MW_ITEMS: GuideSource = {
  label: "屋宇署：小型工程項目",
  url: "https://www.bd.gov.hk/tc/building-works/minor-works/minor-works-items/index.html",
};
const BD_MW_TYPES: GuideSource = {
  label: "屋宇署：小型工程類型",
  url: "https://www.bd.gov.hk/tc/building-works/minor-works/minor-works-items/types-of-minor-works/index.html",
};
const BD_MW_PROCEDURES: GuideSource = {
  label: "屋宇署：小型工程程序",
  url: "https://www.bd.gov.hk/tc/building-works/minor-works/procedures/index.html",
};
const BD_OWNER_PAMPHLET: GuideSource = {
  label: "屋宇署：小型工程監管制度——樓宇業主／業主立案法團須知（PDF）",
  url: "https://www.bd.gov.hk/doc/tc/resources/pamphlets-and-videos/MWCS_owner_c.pdf",
};
const BD_EXEMPTED_BRACKET: GuideSource = {
  label: "屋宇署：指定豁免工程——用於承托空調機或照明裝置的支架",
  url: "https://www.bd.gov.hk/tc/building-works/minor-works/designated-exempted-works/index_mwcs_works_13.html",
};
const CC_COMPLAINTS: GuideSource = {
  label: "消費者委員會：投訴及服務",
  url: "https://www.consumer.org.hk/tc/complaints-and-services",
};
const CC_RENO_PRESS: GuideSource = {
  label: "消費者委員會：裝修工程質素不符要求釀糾紛 訂立詳細合約定期跟進免爭拗",
  url: "https://www.consumer.org.hk/tc/press-release/530-renovation-complaint",
};
const CC_QUOTATION: GuideSource = {
  label: "消費者委員會：裝修報價單要詳細 12大範疇逐一教你睇",
  url: "https://www.consumer.org.hk/tc/article/529-Renovation/529_renovation_reminders",
};
const SCT: GuideSource = {
  label: "司法機構：小額錢債審裁處",
  url: "https://www.judiciary.hk/zh/court_services_facilities/sc.html",
};
const JURISDICTION_2018: GuideSource = {
  label: "政府新聞公報（2018-07-06）：區域法院及小額錢債審裁處司法管轄權提高",
  url: "https://www.info.gov.hk/gia/general/201807/06/P2018070500771.htm",
};
const BRN_ENQUIRY: GuideSource = {
  label: "GovHK：商業登記號碼查詢（稅務局商業登記署）",
  url: "https://www.gov.hk/tc/residents/taxes/etax/services/brn_enquiry.htm",
};
const CR_ESEARCH: GuideSource = {
  label: "公司註冊處：電子服務網站——電子查冊",
  url: "https://www.cr.gov.hk/tc/electronic/e-servicesportal/e-search.htm",
};

const PUBLISHED = "2026-10-16";

export const GUIDES: Guide[] = [
  {
    slug: "check-renovation-contractor-licence",
    title: "點樣查裝修公司有冇牌？屋宇署承建商名冊查法",
    category: "查牌照",
    description:
      "教你用屋宇署名冊搜尋，查裝修公司係咪註冊小型工程承建商（RMWC）或註冊一般建築承建商（RGBC），睇清登記級別、類型、有效期同紀律處分紀錄。",
    answer:
      "香港冇一個叫「裝修牌」嘅統一牌照；如果工程屬《建築物條例》下嘅小型工程或建築工程，就要由屋宇署名冊上相應級別嘅註冊承建商進行。你可以喺屋宇署「註冊專業人士及承建商名冊搜尋」免費輸入公司名稱，核對登記號碼、登記級別／類型同有效期。",
    sections: [
      {
        heading: "邊啲工程要搵註冊承建商？",
        paragraphs: [
          "屋宇署將小型工程分為第 I、II、III 級，現時共有 187 個小型工程項目。進行小型工程的承建商，必須註冊了相應的級別、類型或項目。純室內裝飾未必屬建築工程，但涉及窗戶、外牆支架、招牌、排水等項目時，就要先確認是否屬小型工程。",
        ],
      },
      {
        heading: "名冊入面有咩可以查？",
        bullets: [
          "註冊小型工程承建商（公司）RMWC(CO)：公司名稱、登記號碼、屆滿日期、獲授權簽署人姓名及已註冊的級別／類型。",
          "註冊小型工程承建商（個人）RMWC(Ind)：只可進行第 III 級工程，名冊列出已註冊的第 III 級項目。",
          "註冊一般建築承建商（RGBC）：可進行第 I 至 III 級小型工程，亦可承接須屋宇署批准的建築工程。",
          "紀律處分：名冊會標示過去一段期間曾被譴責、罰款、除名或禁止進行某些工程的人士或承建商。",
        ],
      },
      {
        heading: "查冊步驟",
        bullets: [
          "打開屋宇署名冊搜尋頁，選擇「小型工程承建商」或「一般建築承建商」。",
          "輸入公司名稱（中文或英文），或按需要篩選級別及項目。",
          "核對報價單／合約上的公司名稱同登記號碼是否與名冊一致，並留意屆滿日期。",
          "確認對方登記的級別／類型涵蓋你要做的工程，例如窗戶或支架屬哪一級。",
        ],
      },
      {
        heading: "有牌唔等於冇風險",
        paragraphs: [
          "名冊只證明登記狀態，不反映工程質素、財務狀況或過往糾紛。委聘前亦可以用 Renocheck 查閱公開網上討論摘要作風險參考，再自行核實。",
        ],
      },
    ],
    sources: [BD_REGISTER_SEARCH, BD_WHO_CAN, BD_MW_ITEMS, BD_OWNER_PAMPHLET],
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
  },
  {
    slug: "minor-works-class-1-2-3",
    title: "小型工程第 I、II、III 級係咩？業主要知嘅程序",
    category: "小型工程",
    description:
      "屋宇署小型工程監管制度簡明解說：三個級別分別由邊類專業人士／承建商負責、開工前 7 日通知、完工後 14 日內提交證明書，同埋指定豁免工程。",
    answer:
      "小型工程按規模、複雜程度同風險分為第 I、II、III 級（第 I 級最複雜）。第 I 級要委任訂明建築專業人士（如認可人士）及訂明註冊承建商；第 II、III 級要委任相應級別嘅訂明註冊承建商。第 I、II 級須喺開工前最少 7 日通知屋宇署；三個級別都要喺完工後 14 日內提交完工證明書。",
    sections: [
      {
        heading: "三個級別由邊個做？",
        bullets: [
          "第 I 級：訂明建築專業人士（認可人士，需要時另加註冊結構／岩土工程師）設計及監督，並由 RGBC 或已註冊第 I 級的 RMWC（公司）施工。",
          "第 II 級：RGBC 或已註冊第 II 級的 RMWC（公司）。",
          "第 III 級：RGBC、已註冊第 III 級的 RMWC（公司），或已註冊相關項目的 RMWC（個人）。",
        ],
      },
      {
        heading: "程序同時限",
        bullets: [
          "第 I、II 級：開工前最少 7 日提交開工通知、訂明圖則及相片；毋須屋宇署事先批准。",
          "第 III 級：毋須開工通知，但承建商須於完工後 14 日內提交通知及完工證明書，連同施工前後相片。",
          "所有級別：完工後 14 日內提交完工證明書。",
        ],
        paragraphs: [
          "業主或其代理人（例如設計公司）須委任訂明人士進行小型工程。你可以要求承建商提供提交屋宇署的文件副本留底。",
        ],
      },
      {
        heading: "指定豁免工程",
        paragraphs: [
          "部分細小工程（例如符合尺寸及位置條件的冷氣機支架、晾衣架）屬「指定豁免工程」，毋須委任註冊承建商或通知屋宇署。條件以屋宇署網頁為準，唔確定就先查清楚。",
        ],
      },
    ],
    sources: [BD_MW_ITEMS, BD_MW_TYPES, BD_WHO_CAN, BD_MW_PROCEDURES, BD_EXEMPTED_BRACKET],
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
  },
  {
    slug: "renovation-abandoned-what-to-do",
    title: "裝修爛尾點算？業主追討步驟（消委會、小額錢債審裁處）",
    category: "糾紛追討",
    description:
      "裝修公司收錢唔做、工程爛尾或質素有問題時可以點做：整理證據、書面要求、向消委會投訴調停，以及 $75,000 或以下申索可到小額錢債審裁處。",
    answer:
      "裝修爛尾時，先整理合約、付款紀錄同相片，書面要求對方限期完成或退款；私人消費糾紛可以向消費者委員會投訴（熱線 2929 2222），由消委會擔任調停人。如要追討金錢而金額不超過 $75,000，可以入稟小額錢債審裁處，審裁處不准律師代表；金額較大就要考慮區域法院等途徑並諮詢律師。",
    sections: [
      {
        heading: "第一步：保存證據",
        bullets: [
          "合約、報價單、設計圖及任何書面改動。",
          "付款收據、轉賬紀錄。",
          "工程進度相片、WhatsApp／電郵往來。",
          "未完成或有問題項目的清單（執漏清單）。",
        ],
      },
      {
        heading: "第二步：書面交涉",
        paragraphs: [
          "以書面列明未完成項目、合約條款及合理限期。消委會提醒，工程改動及額外收費都應書面確認，執漏同尾數安排亦應寫入合約。",
        ],
      },
      {
        heading: "第三步：向消委會投訴",
        paragraphs: [
          "消委會以調停人身份處理消費者投訴，協助商戶與投訴人解決糾紛；可經網上表格或熱線 2929 2222（星期一至五 09:00–17:30）投訴。以公司名義購買或用於業務的服務，可能超出消委會範疇。",
        ],
      },
      {
        heading: "第四步：小額錢債審裁處",
        bullets: [
          "處理不超過 $75,000 的金錢申索（2018 年 12 月 3 日起由 $50,000 提高）。",
          "程序較非正式，不准由律師代表。",
          "申索超過 $75,000 不可拆細；可放棄超出部分以在審裁處申索。",
          "更大金額屬區域法院等法院範圍（區域法院一般民事上限為 $300 萬），建議諮詢律師。",
        ],
      },
    ],
    sources: [CC_COMPLAINTS, CC_RENO_PRESS, SCT, JURISDICTION_2018],
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
  },
  {
    slug: "renovation-contract-checklist",
    title: "裝修合約要寫咩？簽約前清單",
    category: "合約",
    description:
      "根據消委會建議整理的裝修合約清單：工程範圍、用料、連工包料定代買、工期、分階段付款、改動書面確認、執漏與尾數、保養條款。",
    answer:
      "裝修合約要清楚寫明每項工程同價錢、用料（連工包料、代買定客人提供）、工期、分階段付款安排、改動要書面確認、執漏清單同尾數安排，以及保養範圍同條款。消委會建議不論工程大小，都應簽署合約先動工。",
    sections: [
      {
        heading: "必寫項目",
        bullets: [
          "工程範圍：逐項列出工程及價錢，附設計圖。",
          "用料：註明「連工包料」、「代買」或「材料由客人提供」，指定品牌型號就寫入合約。",
          "工期：開工及完工日期，延誤安排。",
          "付款：按工程進度分階段付款，每期付款前核對進度及費用。",
          "改動：任何工程改動或額外收費須書面確認並補充入合約。",
          "執漏與尾數：工程尾聲擬訂執漏清單，尾數按清單完成情況支付。",
          "保養：保養期、範圍及由誰承擔維修費用（訂造傢俬亦要留意）。",
        ],
      },
      {
        heading: "可參考嘅範本",
        paragraphs: [
          "消委會文章提到，香港測量師學會印製的維修及裝修工程標準合同，以及香港樓宇檢驗學會等制訂的《香港裝修指引》，可作參考藍本。",
        ],
      },
      {
        heading: "涉及小型工程時",
        paragraphs: [
          "如工程包括窗戶、外牆支架等小型工程項目，合約應寫明由哪一位註冊承建商負責，並要求提供提交屋宇署的文件副本。",
        ],
      },
    ],
    sources: [CC_RENO_PRESS, CC_QUOTATION, BD_WHO_CAN],
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
  },
  {
    slug: "questions-before-hiring-contractor",
    title: "揀裝修公司前要問嘅 10 條問題",
    category: "揀公司",
    description:
      "委聘裝修公司前必問 10 條：商業登記、屋宇署註冊、報價計法、連工包料、付款期數、改動收費、執漏尾數、保養、分判同工期。",
    answer:
      "揀裝修公司前，至少要問清楚佢嘅商業登記同屋宇署註冊、報價係咪列明數量同單價、係咪連工包料、點樣分期付款、改動點收費、執漏同尾數點安排、保養幾耐，以及邊個實際施工同工期。答案最好全部寫入報價單或合約。",
    sections: [
      {
        heading: "10 條問題",
        bullets: [
          "1. 公司嘅商業登記號碼係咩？（可用稅務局／公司註冊處工具核對）",
          "2. 工程涉及小型工程嗎？貴公司喺屋宇署名冊註冊咗咩級別／類型？",
          "3. 報價有冇列明每項數量、單價、分項合計同總數？",
          "4. 係「連工包料」、「代買」定材料由我提供？",
          "5. 報價係「包生仔」定「實量實度」？",
          "6. 點樣分期付款？每期對應咩進度？",
          "7. 後加或改動工程點收費？會唔會書面確認？",
          "8. 執漏清單同尾數點安排？",
          "9. 保養期幾耐？包括咩？",
          "10. 實際由邊個施工？開工同完工日期係幾時？",
        ],
      },
      {
        heading: "點解要問",
        paragraphs: [
          "消委會指，裝修投訴多涉及工程中後階段嘅質素同用料爭議；事前講清楚並寫入合約，可以減少爭拗。",
        ],
      },
    ],
    sources: [CC_QUOTATION, CC_RENO_PRESS, BD_REGISTER_SEARCH, BRN_ENQUIRY],
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
  },
  {
    slug: "business-registration-number-search",
    title: "商業登記號碼點查？商業登記同公司註冊有咩分別",
    category: "查商業登記",
    description:
      "教你用稅務局商業登記號碼查詢同公司註冊處電子查冊核對裝修公司身份；講解商業登記署與公司註冊處的分別，以及 2023 年起的商業登記號碼統一識別。",
    answer:
      "商業登記由稅務局商業登記署負責，涵蓋所有營業業務；有限公司則另外喺公司註冊處註冊。你可以喺 GovHK「商業登記號碼查詢」輸入完整業務名稱同所在地區（香港、九龍或新界）查商業登記號碼；有限公司亦可喺公司註冊處電子服務網站查冊。自 2023 年 12 月 27 日起，商業登記號碼取代公司註冊編號，成為識別公司嘅主要號碼。",
    sections: [
      {
        heading: "兩個登記有咩分別？",
        bullets: [
          "商業登記署（稅務局）：所有在港經營業務均須商業登記，包括獨資及合夥。",
          "公司註冊處：有限公司等法團的註冊資料，例如公司名稱、狀態及已登記文件。",
        ],
      },
      {
        heading: "點樣查？",
        bullets: [
          "GovHK 商業登記號碼查詢：輸入完整中文或英文業務名稱及地區。",
          "公司註冊處電子查冊：可用公司名稱或商業登記號碼搜尋，亦有舊公司註冊編號與商業登記號碼對照功能。",
          "Renocheck：首頁可直接輸入商業登記號碼，查閱公開資料風險參考。",
        ],
      },
      {
        heading: "核對要點",
        paragraphs: [
          "報價單、合約、收據上的公司名稱應一致。名稱或號碼對唔上，就要先問清楚實際簽約方係邊個。",
        ],
      },
    ],
    sources: [BRN_ENQUIRY, CR_ESEARCH],
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
  },
  {
    slug: "how-to-read-renovation-quotation",
    title: "裝修報價點睇？報價單要列明嘅重點",
    category: "報價",
    description:
      "消委會及專業學會建議的裝修報價單重點：數量、單價、分項合計、連工包料、包生仔定實量實度、後加工程收費、隱藏條款及貨比三家。",
    answer:
      "一份清晰嘅裝修報價單，要列明每個項目嘅數量、單價、分項合計同總數，並註明係咪連工包料；只得分項合計嘅只係估價。亦要留意報價係「包生仔」定「實量實度」、後加工程點收費、有冇隱藏收費或免責條款，並貨比三家。",
    sections: [
      {
        heading: "報價單要有",
        bullets: [
          "每項數量、單價、分項合計及總數。",
          "人工及用料是否包括；「包料」指定供應物料定指定價錢範圍。",
          "每個項目的計算方式。",
          "後加工程項目如何收費。",
          "有否罰款或免責條款、需另外收費的項目。",
        ],
      },
      {
        heading: "「包生仔」定「實量實度」",
        paragraphs: [
          "消委會文章引述香港測量師學會提醒，要分清報價屬「包生仔」還是「實量實度」，並留意數量，否則容易超支。較大型或複雜的工程，可考慮聘請建築測量師等顧問。",
        ],
      },
      {
        heading: "比較報價",
        paragraphs: [
          "先確立工程目標、範圍同預算，再向幾間公司索取同一範圍嘅報價比較。揀定之後，可以查吓該公司嘅屋宇署註冊同公開討論作參考。",
        ],
      },
    ],
    sources: [CC_QUOTATION, CC_RENO_PRESS],
    datePublished: PUBLISHED,
    dateModified: PUBLISHED,
  },
];

export function getGuide(slug: string): Guide | undefined {
  return GUIDES.find((g) => g.slug === slug);
}

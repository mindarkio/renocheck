import type { JudgmentCategory } from "./legal-event-schema";

const CATEGORY_ZH: Record<JudgmentCategory, string> = {
  renovation_engineering_civil: "裝修／工程合約民事",
  building_defect_water_damage: "樓宇滲水／失修民事",
  arbitration_award: "仲裁裁決",
  small_claims_debt: "小額錢債／索償",
  general_contract_debt: "合約欠款民事",
  small_works_regulatory: "小型工程／監管程序",
  criminal_regulatory: "刑事／監管",
  winding_up_insolvency: "清盤／破產",
  employment_labour: "勞資／僱傭",
  personal_injury_site: "工地人身傷害民事",
  landlord_tenant: "租賃",
  intellectual_property: "知識產權",
  defamation: "誹謗",
  other_civil: "其他民事",
  unknown: "未分類",
};

export function judgmentCategoryLabelZh(cat: JudgmentCategory): string {
  return CATEGORY_ZH[cat] ?? cat;
}

export const LEGAL_LOOKUP_DEGRADED_ZH =
  "判詞紀錄暫時未能查詢，本次評級未計入判詞；請稍後再試";

export const LEGAL_LOOKUP_DEGRADED_SUMMARY_PREFIX =
  "判詞紀錄暫時未能查詢，本次評級未計入判詞。";

export const LEGAL_EVENTS_EMPTY_ZH =
  "已檢索本次匯入的公開判詞紀錄；未見與查證對象對照之紀錄。此結果並不表示該方從未涉及司法程序。";

export const LEGAL_EVENTS_SCOPE_ZH =
  "以下為本次已匯入的公開判詞要點摘要，並附官方或刊憲連結；並非完整案情或法律意見。";

export const LEGAL_EVENTS_FACTS_ONLY_ZH =
  "以下列出與查證對象對照之刊憲紀錄（案號、法院、日期、訴訟角色）及官方連結；聆訊要點待人手覆核前不顯示摘要內容。";

/** Shown when hearing points are LLM-derived (DEC-0012). */
export const LEGAL_EVENTS_AUTO_SUMMARY_ZH =
  "自動摘要，以判詞原文為準。";

/** Shown when hearing_points_source is ai_verified. */
export const LEGAL_EVENTS_AI_VERIFIED_ZH = "已核對判詞原文。";

export function partyRoleLabelZh(
  role: "defendant" | "plaintiff" | "third_party" | "unknown",
): string {
  if (role === "defendant") return "被告／答辯人";
  if (role === "plaintiff") return "原告／申索人";
  if (role === "third_party") return "第三方";
  return "訴訟角色未分類";
}

/** Shown under 風險參考分檔 when report has matched legal events. */
export const LEGAL_EVENTS_RISK_BAND_NOTE_ZH =
  "風險參考分檔亦會參考本次已匯入、並與查證對象對照之公開判詞紀錄（見下方）；與公開討論摘要分開計算。";

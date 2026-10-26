/** User-facing copy for the register picker (DEC-0015). Recommended column, verbatim. */

export const PICKER_HEADING_ZH = "名冊有多過一間相符";
export const EXACT_ROW_TAG_ZH = "同你輸入一樣";
export const PICKER_ACTION_ZH = "查呢間";
export const PICKER_HINT_ZH =
  "唔肯定就對吓報價單上嘅全名同註冊編號。揀完先至有風險參考。";
export const PICKER_BACK_ZH = "返回修改";
export const PICKER_GROUP_LABEL_ZH = "揀一間名冊上嘅公司";

export const TOO_MANY_HEADING_ZH = "請輸入公司全名";
export const TOO_MANY_BACK_ZH = "返回修改";

export const CONTINUE_AS_COMPANY_ZH = "呢個係公司全名，繼續查";

export const SCOPE_HEADING_ZH = "本次查證範圍";

export const REGISTER_LOADING_ZH = "正在對照屋宇署名冊…";
export const REGISTER_LOADING_LABEL_ZH = "正在對照屋宇署名冊";
export const REGISTER_ERROR_ZH = "名冊暫時對唔到，請稍後再試。";
export const REGISTER_RETRY_ZH = "再試一次";

export function pickerBodyZh(typed: string): string {
  return `你輸入「${typed}」。屋宇署小型工程承建商名冊有多過一間名稱包含呢幾個字。請揀一間，報告先會開始。`;
}

export function tooManyBodyZh(typed: string): string {
  return `你輸入「${typed}」。名冊入面有好多間都包含呢幾個字，所以未開始查。請輸入報價單或合約上嘅公司全名。`;
}

export function shortCompanyNameMessageZh(typed: string): string {
  return `「${typed}」太短或者太常見。請輸入報價單上嘅公司全名，先至開始查。`;
}

export function personalNameMessageZh(typed: string): string {
  return `「${typed}」好似一個人名。呢度只查公司同商號，唔會用個人姓名對公司，避免同名嘅人被對上另一間舖。請改輸入報價單上嘅公司全名、商號，或者商業登記號碼。`;
}

export function scopeLineZh(typed: string, registerName: string): string {
  return `你輸入「${typed}」／名冊名稱「${registerName}」`;
}

/** Used when either name contains 「／」 or 「/」, so the slash form stays readable. */
export function scopeLineWhenSlashZh(typed: string, registerName: string): string {
  return `你輸入「${typed}」。報告用名冊名稱「${registerName}」。`;
}

export function candidateRadioLabelZh(input: {
  companyName: string;
  companyNameEn: string | null;
  registrationNo: string;
}): string {
  const english = input.companyNameEn?.trim();
  if (english) {
    return `${input.companyName}，英文名稱 ${english}，註冊編號 ${input.registrationNo}`;
  }
  return `${input.companyName}，註冊編號 ${input.registrationNo}`;
}

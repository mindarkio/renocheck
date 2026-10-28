/**
 * User-facing quote-analysis copy.
 * UI strings are colloquial Cantonese. The disclaimer paragraph is formal 書面語.
 * Aaron must approve every string in this file before the draft merges.
 */

const QUOTE_ANALYSIS_DISCLAIMER_OPENING_ZH =
  "如閣下設立帳戶以使用報價單上載分析，本服務會收集閣下的電郵地址，用途限於發送一次性登入驗證碼、識別帳戶，以及處理刪除帳戶的要求。閣下上載的報價單（只限 PDF）僅在分析期間於伺服器記憶體中處理，並會傳送至 Microsoft Azure OpenAI（資源位於南韓中部；個別請求可能在該模型可供使用的任何 Azure 地區處理）作自動分析。本服務不會保留報價單原檔。報價單所載的承辦公司或商號名稱會被抽出，僅供閣下確認後進行公司查冊，本服務不會保留該名稱。分析完成後，本服務保留與該帳戶相連的結構化分析結果（各檢查項目的狀態），直至 180 日屆滿或閣下刪除帳戶（以較早者為準）。閣下可於帳戶頁面要求刪除帳戶；帳戶刪除後，該電郵帳戶及其報價分析結果會一併移除。登入驗證碼經 Supabase 認證服務以電郵發送，電郵傳遞由 Resend 負責。設立帳戶屬自願；不設立帳戶仍可使用公司查冊及報價自查清單。";

/** Aaron's verbatim wording. Do not edit. */
export const QUOTE_ANALYSIS_DISCLAIMER_AZURE_ZH =
  "Microsoft Azure 可能為偵測濫用而暫時保留提交內容及回應；微軟現行公開文件並未列明保留期限，較早版本文件曾列明最多 30 日。本服務亦會保留分析頁數、用量及費用紀錄、所用模型及時間。上述分析結果及紀錄會於 180 日後或閣下刪除帳戶時（以較早者為準）刪除。登入後，本網站會以 cookie 保存閣下的登入狀態。";

export const QUOTE_ANALYSIS_DISCLAIMER_CLOSED_ZH =
  "如報價單上載分析未開放，閣下可電郵至 hello@renocheck.homes 要求刪除帳戶。";

export const QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH =
  QUOTE_ANALYSIS_DISCLAIMER_OPENING_ZH +
  QUOTE_ANALYSIS_DISCLAIMER_AZURE_ZH +
  QUOTE_ANALYSIS_DISCLAIMER_CLOSED_ZH;

export const QUOTE_ANALYSIS_ENTRY_ZH = "用 AI 對住同一張清單睇一份 PDF 報價單";

export const QUOTE_UPLOAD_TITLE_ZH = "上載報價單分析";
export const QUOTE_UPLOAD_LEAD_ZH =
  "上載一份 PDF 報價單。我哋會對住清單睇吓寫得清唔清楚。你確認公司名之後，先至查公司。唔會評價價錢。";
export const QUOTE_UPLOAD_NOTICE_ZH =
  "PDF 會交俾 Microsoft Azure OpenAI 讀一次，RenoCheck 唔會儲存原檔。請先遮好你自己同其他人嘅姓名、電話、地址、簽名同銀行戶口。報價單上嘅公司名會抽出嚟，等你確認之後先查公司，我哋唔會儲存個名。";
export const QUOTE_ACK_LABEL_ZH =
  "我確認已經遮好報價單上面嘅個人資料，包括我自己同其他人嘅姓名、電話、地址、簽名同銀行戶口。";
export const QUOTE_ACK_ERROR_ZH = "請先剔選確認你已經遮好個人資料。";
export const QUOTE_FILE_LABEL_ZH = "PDF 報價單";
export const QUOTE_FILE_HINT_ZH = "只收 PDF，最大 4 MB，最多 6 頁。";
export const QUOTE_SUBMIT_ZH = "開始分析";
export const QUOTE_ANALYSING_ZH = "分析緊，請稍等。";
export const QUOTE_SIGN_IN_PROMPT_ZH =
  "上載分析要先登入。公司查冊同自查清單唔使登入。";
export const QUOTE_SIGN_IN_LINK_ZH = "用電郵驗證碼登入";
export const QUOTE_ACCOUNT_LINK_ZH = "帳戶";
export const QUOTE_BACK_TO_CHECKLIST_ZH = "返回報價自查";
export const QUOTE_UNAVAILABLE_ZH =
  "上載分析暫時未開放。你可以繼續用報價自查清單。";

export const LANDING_CHOICE_HEADING_ZH = "你而家有報價單未？";
export const LANDING_QUOTE_TITLE_ZH = "我有報價單";
export const LANDING_QUOTE_BODY_ZH =
  "上載一份 PDF。我哋會睇吓間公司，同埋張報價寫得清唔清楚。免費，要電郵登入，幾分鐘搞掂。";
export const LANDING_QUOTE_ACTION_ZH = "上載報價單";
export const LANDING_QUOTE_UNAVAILABLE_ZH = "暫時未開放";
export const LANDING_SEARCH_TITLE_ZH = "未有報價，想先查公司";
export const LANDING_SEARCH_BODY_ZH =
  "未有報價都得。用公司名、電話或者 BR，先查公開資料摘要。";
export const LANDING_SEARCH_ACTION_ZH = "去查公司";
export const HEADER_UPLOAD_ZH = "上載報價";

export const ACCOUNT_UPLOAD_BODY_ZH =
  "有報價單？上載 PDF，我哋會睇吓間公司同埋寫得清唔清楚。";
export const ACCOUNT_UPLOAD_ACTION_ZH = "上載報價單";

export const QUOTE_PICK_FIRST_ZH =
  "先揀 PDF。未登入的話，揀完檔先至要電郵驗證碼。檔案留喺呢版，未登入之前唔會送出去。";
export const QUOTE_LOGIN_AFTER_FILE_ZH =
  "檔案揀好咗。登入之後會即刻開始分析，唔使再揀。";
export const QUOTE_FILE_RESELECT_ZH =
  "頁面重新載入之後，之前揀嘅 PDF 冇留低。請再揀一次檔案。";

export const QUOTE_COMPANY_FOUND_PREFIX_ZH = "我哋喺報價單上搵到「";
export const QUOTE_COMPANY_FOUND_SUFFIX_ZH = "」。係咪呢間公司？";
export const QUOTE_COMPANY_MISSING_ZH =
  "報價單上搵唔到公司名。請打返個公司名，確認之後先至查。";
export const QUOTE_COMPANY_LABEL_ZH = "公司名稱";
export const QUOTE_COMPANY_CONFIRM_ZH = "確認，開始查公司";
export const QUOTE_COMPANY_HOLD_ZH =
  "未撳確認之前，唔會開始查。公司名唔會儲存。";
export const QUOTE_COMPANY_NEED_NAME_ZH = "請輸入公司名稱。";
export const QUOTE_COMPANY_RESULT_HEADING_ZH = "公司查冊結果";

export function quoteCompanyFoundZh(name: string): string {
  return `${QUOTE_COMPANY_FOUND_PREFIX_ZH}${name}${QUOTE_COMPANY_FOUND_SUFFIX_ZH}`;
}

export const QUOTE_QUOTA_ZH =
  "今日免費分析次數已用完。聽日（香港時間）先可以再分析。";
export const QUOTE_BUDGET_ZH =
  "今日嘅報價分析名額已滿，聽日（香港時間）先可以再試。公司查冊照常用到。";
export const QUOTE_NOT_QUOTATION_ZH =
  "呢份檔案睇落唔係裝修報價單，今次唔會計入今日次數。";
export const QUOTE_PDF_TYPE_ZH = "只收 PDF 檔。";
export const QUOTE_PDF_MAGIC_ZH = "呢個檔案睇落唔係 PDF。";
export const QUOTE_PDF_SIZE_ZH = "PDF 太大。請用 4 MB 以內嘅檔案。";
export const QUOTE_PDF_PAGES_ZH = "PDF 頁數太多。請用 6 頁以內嘅檔案。";
export const QUOTE_PDF_ENCRYPTED_ZH =
  "呢份 PDF 有密碼，讀唔到。請交一份冇密碼嘅 PDF。";
export const QUOTE_PDF_UNREADABLE_ZH = "讀唔到呢份 PDF 有幾多頁。請換一份再試。";
export const QUOTE_FAILED_ZH = "分析暫時失敗，今次唔會計你次數。請稍後再試。";
export const QUOTE_RATE_LIMIT_ZH = "太頻繁，請稍後再試。";
export const QUOTE_AUTH_REQUIRED_ZH = "請先登入，先可以分析報價單。";
export const QUOTE_UNAVAILABLE_API_ZH = "報價分析暫時未開放。";

export const QUOTE_RESULT_TITLE_ZH = "報價分析結果";
export const QUOTE_RESULT_LEAD_ZH =
  "下面呢個清單由 AI 對住項目整理，只講有冇寫清楚，唔會評價價錢。請自己對返原本報價單。";
export const QUOTE_RESULT_MISSING_ZH =
  "搵唔到呢份分析。可能已經刪除，或者唔係你個帳戶嘅。";
export const QUOTE_RESULT_ROBOTS = { index: false, follow: false } as const;

export const QUOTE_FINDING_CLEAR_ZH = "有寫清楚。";
export const QUOTE_FINDING_VAGUE_PREFIX_ZH = "寫得含糊：";
export const QUOTE_FINDING_MISSING_ZH = "冇提及。";
export const QUOTE_FINDING_NA_ZH = "唔適用。";
export const QUOTE_FINDING_ARITHMETIC_CLEAR_ZH = "加總對得上。";
export const QUOTE_FINDING_ARITHMETIC_MISMATCH_ZH = "加總睇落對唔齊。";

export const LOGIN_TITLE_ZH = "登入";
export const LOGIN_LEAD_ZH = "輸入電郵，我哋會寄一個 6 位數字驗證碼。冇密碼。";
export const LOGIN_EMAIL_LABEL_ZH = "電郵";
export const LOGIN_CODE_LABEL_ZH = "驗證碼";
export const LOGIN_SEND_ZH = "發送驗證碼";
export const LOGIN_SENT_ZH =
  "如果呢個電郵用得，驗證碼會寄到。請睇收件箱同垃圾郵件。";
export const LOGIN_SUBMIT_ZH = "登入";
export const LOGIN_CODE_INVALID_ZH = "驗證碼唔啱或者已經過期，請再試。";
export const LOGIN_EMAIL_INVALID_ZH = "請輸入有效電郵。";
export const LOGIN_UNAVAILABLE_ZH = "登入暫時未開放。";
export const LOGIN_SEND_FAILED_ZH = "暫時寄唔到驗證碼，請稍後再試。";

export const ACCOUNT_TITLE_ZH = "帳戶";
export const ACCOUNT_EMAIL_LABEL_ZH = "電郵";
export const ACCOUNT_SIGN_OUT_ZH = "登出";
export const ACCOUNT_DELETE_HEADING_ZH = "刪除帳戶";
export const ACCOUNT_DELETE_BODY_ZH =
  "刪除之後，呢個帳戶同你嘅報價分析結果會一併刪走，而且唔可以還原。";
export const ACCOUNT_DELETE_CONFIRM_WORD_ZH = "刪除";
export const ACCOUNT_DELETE_CONFIRM_LABEL_ZH = "請輸入「刪除」確認。";
/** Display only. Not a checkbox and not a requirement. */
export const ACCOUNT_DELETE_HINT_ZH =
  "我明白刪除帳戶後，登入資料同報價分析結果會一併刪走，而且唔可以還原。";
export const ACCOUNT_DELETE_BUTTON_ZH = "刪除我個帳戶";
export const ACCOUNT_DELETE_ERROR_ZH =
  "暫時刪除唔到帳戶，請稍後再試，或者電郵 hello@renocheck.homes。";
export const ACCOUNT_DELETE_ACK_ZH = "請先輸入「刪除」，確認你想刪除帳戶。";
export const ACCOUNT_DELETE_CLOSED_ZH =
  "而家未開放登入。如果要刪除帳戶，可以電郵 hello@renocheck.homes。";
export const ACCOUNT_SIGNED_OUT_PROMPT_ZH = "你未登入。";
export const ACCOUNT_SIGN_IN_LINK_ZH = "去登入";

export function quoteAnalysisUserFacingCopy(): readonly string[] {
  return [
    QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH,
    QUOTE_ANALYSIS_ENTRY_ZH,
    QUOTE_UPLOAD_TITLE_ZH,
    QUOTE_UPLOAD_LEAD_ZH,
    QUOTE_UPLOAD_NOTICE_ZH,
    QUOTE_ACK_LABEL_ZH,
    QUOTE_ACK_ERROR_ZH,
    QUOTE_FILE_LABEL_ZH,
    QUOTE_FILE_HINT_ZH,
    QUOTE_SUBMIT_ZH,
    QUOTE_ANALYSING_ZH,
    QUOTE_SIGN_IN_PROMPT_ZH,
    QUOTE_SIGN_IN_LINK_ZH,
    QUOTE_ACCOUNT_LINK_ZH,
    QUOTE_BACK_TO_CHECKLIST_ZH,
    QUOTE_UNAVAILABLE_ZH,
    LANDING_CHOICE_HEADING_ZH,
    LANDING_QUOTE_TITLE_ZH,
    LANDING_QUOTE_BODY_ZH,
    LANDING_QUOTE_ACTION_ZH,
    LANDING_QUOTE_UNAVAILABLE_ZH,
    LANDING_SEARCH_TITLE_ZH,
    LANDING_SEARCH_BODY_ZH,
    LANDING_SEARCH_ACTION_ZH,
    HEADER_UPLOAD_ZH,
    ACCOUNT_UPLOAD_BODY_ZH,
    ACCOUNT_UPLOAD_ACTION_ZH,
    QUOTE_PICK_FIRST_ZH,
    QUOTE_LOGIN_AFTER_FILE_ZH,
    QUOTE_FILE_RESELECT_ZH,
    QUOTE_COMPANY_FOUND_PREFIX_ZH,
    QUOTE_COMPANY_FOUND_SUFFIX_ZH,
    QUOTE_COMPANY_MISSING_ZH,
    QUOTE_COMPANY_LABEL_ZH,
    QUOTE_COMPANY_CONFIRM_ZH,
    QUOTE_COMPANY_HOLD_ZH,
    QUOTE_COMPANY_NEED_NAME_ZH,
    QUOTE_COMPANY_RESULT_HEADING_ZH,
    QUOTE_QUOTA_ZH,
    QUOTE_BUDGET_ZH,
    QUOTE_NOT_QUOTATION_ZH,
    QUOTE_PDF_TYPE_ZH,
    QUOTE_PDF_MAGIC_ZH,
    QUOTE_PDF_SIZE_ZH,
    QUOTE_PDF_PAGES_ZH,
    QUOTE_PDF_ENCRYPTED_ZH,
    QUOTE_PDF_UNREADABLE_ZH,
    QUOTE_FAILED_ZH,
    QUOTE_RATE_LIMIT_ZH,
    QUOTE_AUTH_REQUIRED_ZH,
    QUOTE_UNAVAILABLE_API_ZH,
    QUOTE_RESULT_TITLE_ZH,
    QUOTE_RESULT_LEAD_ZH,
    QUOTE_RESULT_MISSING_ZH,
    QUOTE_FINDING_CLEAR_ZH,
    QUOTE_FINDING_VAGUE_PREFIX_ZH,
    QUOTE_FINDING_MISSING_ZH,
    QUOTE_FINDING_NA_ZH,
    QUOTE_FINDING_ARITHMETIC_CLEAR_ZH,
    QUOTE_FINDING_ARITHMETIC_MISMATCH_ZH,
    LOGIN_TITLE_ZH,
    LOGIN_LEAD_ZH,
    LOGIN_EMAIL_LABEL_ZH,
    LOGIN_CODE_LABEL_ZH,
    LOGIN_SEND_ZH,
    LOGIN_SENT_ZH,
    LOGIN_SUBMIT_ZH,
    LOGIN_CODE_INVALID_ZH,
    LOGIN_EMAIL_INVALID_ZH,
    LOGIN_UNAVAILABLE_ZH,
    LOGIN_SEND_FAILED_ZH,
    ACCOUNT_TITLE_ZH,
    ACCOUNT_EMAIL_LABEL_ZH,
    ACCOUNT_SIGN_OUT_ZH,
    ACCOUNT_DELETE_HEADING_ZH,
    ACCOUNT_DELETE_BODY_ZH,
    ACCOUNT_DELETE_CONFIRM_WORD_ZH,
    ACCOUNT_DELETE_CONFIRM_LABEL_ZH,
    ACCOUNT_DELETE_HINT_ZH,
    ACCOUNT_DELETE_BUTTON_ZH,
    ACCOUNT_DELETE_ERROR_ZH,
    ACCOUNT_DELETE_ACK_ZH,
    ACCOUNT_DELETE_CLOSED_ZH,
    ACCOUNT_SIGNED_OUT_PROMPT_ZH,
    ACCOUNT_SIGN_IN_LINK_ZH,
  ];
}

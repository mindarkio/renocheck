/**
 * User-facing quote-analysis copy.
 * Quote-upload strings added in this draft are formal 書面語 and still need owner approval.
 * The homepage line HOME_QUOTE_UPLOAD_LINK_ZH is owner-written. Login and account-delete
 * strings outside this flow are unchanged. The disclaimer paragraph is formal 書面語.
 */

const QUOTE_ANALYSIS_DISCLAIMER_OPENING_ZH =
  "如閣下設立帳戶以使用報價單上載分析，本服務會收集閣下的電郵地址，用途限於發送一次性登入驗證碼、識別帳戶，以及處理刪除帳戶的要求。閣下上載的報價單（只限 PDF）僅在分析期間於伺服器記憶體中處理，並會傳送至 Microsoft Azure OpenAI（資源位於南韓中部；個別請求可能在該模型可供使用的任何 Azure 地區處理）作自動分析。本服務不會保留報價單原檔。報價單所載的承辦公司或商號名稱會被抽出，並與結構化分析結果一併保存，保存期相同（直至 180 日屆滿或閣下刪除帳戶，以較早者為準）。該名稱用於公司查冊，以及本服務的分析與改進。個人資料（個人姓名、電話、地址、簽名及銀行戶口）不會保留。閣下確認後進行的公司查冊，與其他公司查冊一樣處理。分析完成後，本服務保留與該帳戶相連的結構化分析結果（各檢查項目的狀態），直至 180 日屆滿或閣下刪除帳戶（以較早者為準）。閣下可於帳戶頁面要求刪除帳戶；帳戶刪除後，該電郵帳戶及其報價分析結果會一併移除。登入驗證碼經 Supabase 認證服務以電郵發送，電郵傳遞由 Resend 負責。設立帳戶屬自願；不設立帳戶仍可使用公司查冊及報價自查清單。";

/** Aaron's verbatim wording. Do not edit. */
export const QUOTE_ANALYSIS_DISCLAIMER_AZURE_ZH =
  "Microsoft Azure 可能為偵測濫用而暫時保留提交內容及回應；微軟現行公開文件並未列明保留期限，較早版本文件曾列明最多 30 日。本服務亦會保留分析頁數、用量及費用紀錄、所用模型及時間。上述分析結果及紀錄會於 180 日後或閣下刪除帳戶時（以較早者為準）刪除。登入後，本網站會以 cookie 保存閣下的登入狀態。";

export const QUOTE_ANALYSIS_DISCLAIMER_CLOSED_ZH =
  "如報價單上載分析未開放，閣下可電郵至 hello@renocheck.homes 要求刪除帳戶。";

export const QUOTE_ANALYSIS_DISCLAIMER_PARAGRAPH_ZH =
  QUOTE_ANALYSIS_DISCLAIMER_OPENING_ZH +
  QUOTE_ANALYSIS_DISCLAIMER_AZURE_ZH +
  QUOTE_ANALYSIS_DISCLAIMER_CLOSED_ZH;

export const QUOTE_UPLOAD_TITLE_ZH = "上載報價單分析";
export const QUOTE_UPLOAD_LEAD_ZH =
  "請上載一份 PDF 報價單。我們會按清單檢視報價內容是否列明清楚。確認公司名稱後，方會進行公司查冊。本服務不評估價格高低。";
export const QUOTE_UPLOAD_NOTICE_ZH =
  "PDF 檔案將交由 Microsoft Azure OpenAI 讀取一次，RenoCheck 不會儲存原檔。上載前，請遮蓋你本人及他人的姓名、電話、地址、簽名及銀行戶口資料。報價單上的公司名稱將與分析結果一併保存，個人資料則不會保存。";
export const QUOTE_ACK_LABEL_ZH =
  "我確認已經遮好報價單上面嘅個人資料，包括我自己同其他人嘅姓名、電話、地址、簽名同銀行戶口。";
export const QUOTE_ACK_ERROR_ZH = "請先剔選確認你已經遮好個人資料。";
export const QUOTE_FILE_LABEL_ZH = "PDF 報價單";
export const QUOTE_FILE_HINT_ZH = "只收 PDF，最大 4 MB，最多 6 頁。";
export const QUOTE_SUBMIT_ZH = "開始分析";
export const QUOTE_ANALYSING_ZH = "分析進行中，請稍候。";
export const QUOTE_SIGN_IN_PROMPT_ZH = "上載分析需先驗證電郵。公司查冊無需驗證電郵。";
export const QUOTE_SIGN_IN_LINK_ZH = "驗證電郵";
export const QUOTE_ACCOUNT_LINK_ZH = "帳戶";
/** Link back to the static /quote guide. Same label as the footer. */
export const QUOTE_GUIDE_LINK_ZH = "報價內容指南";
export const QUOTE_UNAVAILABLE_ZH = "報價單上載分析暫時未開放。";

/** Owner-written and approved. */
export const HOME_QUOTE_UPLOAD_LINK_ZH = "我有報價單，直接上載分析";
export const HEADER_UPLOAD_ZH = "上載報價";
export const QUOTE_SEAL_MODAL_TITLE_ZH = "驗證電郵以查看結果";
export const QUOTE_SEAL_MODAL_BODY_ZH =
  "分析已完成。請輸入電郵地址及驗證碼，即可查看報告。完成驗證前，此處不會顯示你的報價單內容。";
export const QUOTE_SEAL_REOPEN_ZH = "驗證並查看結果";
export const QUOTE_SEAL_CLOSE_ZH = "放棄分析";
/** Inline verify-first fallback, before analysis has run. The site login button stays 登入. */
export const QUOTE_VERIFY_EMAIL_ZH = "驗證電郵";
export const QUOTE_SEAL_EXPIRED_ZH = "此結果已過期，請重新上載。";
export const QUOTE_SEAL_USED_ZH = "此結果已被使用，請重新上載。";
export const QUOTE_ANON_LIMIT_ZH =
  "此網絡今日的免費分析次數已用完，請於明天（香港時間）再試。";

export const ACCOUNT_UPLOAD_BODY_ZH =
  "如有報價單，可上載 PDF 檔案，我們會檢視承辦公司及報價內容是否列明清楚。";
export const ACCOUNT_UPLOAD_ACTION_ZH = "上載報價單";

export const QUOTE_PICK_FIRST_ZH =
  "請先選擇 PDF 檔案。如尚未驗證電郵，選擇檔案後方需輸入電郵驗證碼。驗證前，檔案只會留在此頁面，不會傳送。";
export const QUOTE_LOGIN_AFTER_FILE_ZH =
  "已選擇檔案。完成驗證後將即時開始分析，無須重新選擇。";
export const QUOTE_FILE_RESELECT_ZH =
  "頁面重新載入後，先前選擇的 PDF 檔案未有保留，請重新選擇。";

export const QUOTE_COMPANY_FOUND_PREFIX_ZH = "我們在報價單上找到「";
export const QUOTE_COMPANY_FOUND_SUFFIX_ZH = "」。請確認是否為此公司。";
export const QUOTE_COMPANY_MISSING_ZH =
  "報價單上未能找到公司名稱。請輸入公司名稱，確認後方會進行查冊。";
export const QUOTE_COMPANY_LABEL_ZH = "公司名稱";
export const QUOTE_COMPANY_CONFIRM_ZH = "確認並查冊";
export const QUOTE_COMPANY_HOLD_ZH =
  "按下確認前不會進行查冊。確認後，公司名稱將與此結果一併保存。";
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
  "以下清單由 AI 按報價項目整理，只檢視內容是否列明清楚，不評估價格高低。請自行核對原本報價單。";
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
    QUOTE_GUIDE_LINK_ZH,
    QUOTE_UNAVAILABLE_ZH,
    HOME_QUOTE_UPLOAD_LINK_ZH,
    HEADER_UPLOAD_ZH,
    QUOTE_SEAL_MODAL_TITLE_ZH,
    QUOTE_SEAL_MODAL_BODY_ZH,
    QUOTE_SEAL_REOPEN_ZH,
    QUOTE_SEAL_CLOSE_ZH,
    QUOTE_VERIFY_EMAIL_ZH,
    QUOTE_SEAL_EXPIRED_ZH,
    QUOTE_SEAL_USED_ZH,
    QUOTE_ANON_LIMIT_ZH,
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

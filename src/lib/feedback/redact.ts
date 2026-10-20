/** C0, DEL, C1, zero-width, and bidi marks. */
const CONTROL_AND_BIDI =
  /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const WHATSAPP_RE = /(?:https?:\/\/)?wa\.me\/[\d+][\d+\s-]*/gi;
const HKID_RE = /\b[A-Za-z]{1,2}\s?\d{6}\s?\(?\s?[0-9A]\s?\)?/g;
const PHONE_RE = /(?:\+?852[\s-]?)?(?<!\d)[2-9](?:[\s-]?\d){7}(?!\d)/g;
const LABELLED_NAME_RE =
  /(客戶|業主|聯絡人|負責人|Attn|Contact|簽名|Name)\s*[:：]\s*\S{1,40}/gi;
const HONORIFIC_LONG_RE = /[\u4e00-\u9fff]{1,4}(?:先生|小姐|太太)/g;
const HONORIFIC_TAI_RE = /[\u4e00-\u9fff]{1,2}太(?!太|陽)/g;
const HONORIFIC_SANG_RE = /[\u4e00-\u9fff]{1,2}生(?![\u4e00-\u9fff])/g;

const SANG_KEEP = new Set(["發生", "產生", "學生", "先生", "人生"]);

export function stripControlAndBidi(input: string): string {
  return input.replace(CONTROL_AND_BIDI, "");
}

/** Phones, emails, HKID-like tokens, and honorific names. */
export function redactFeedbackComment(raw: string): string {
  let text = stripControlAndBidi(raw);
  text = text.replace(EMAIL_RE, "[電郵]");
  text = text.replace(WHATSAPP_RE, "[電話]");
  text = text.replace(HKID_RE, "[身份證]");
  text = text.replace(PHONE_RE, "[電話]");
  text = text.replace(LABELLED_NAME_RE, "$1：[姓名]");
  text = text.replace(HONORIFIC_LONG_RE, "[姓名]");
  text = text.replace(HONORIFIC_TAI_RE, "[姓名]");
  text = text.replace(HONORIFIC_SANG_RE, (match) =>
    SANG_KEEP.has(match) ? match : "[姓名]",
  );
  text = text.trim();
  if (text.length > 500) text = text.slice(0, 500);
  return text;
}

/** C0, DEL, C1, zero-width, and bidi marks. */
const CONTROL_AND_BIDI =
  /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

/** Up to 2 separator characters between digits: space, dot, dash, underscore, slash, middle dot, brackets. */
const SEP = String.raw`[\s.\-_/·()]{0,2}`;

const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
const EMAIL_RE = /[A-Z0-9._%+-]+\s?@\s?[A-Z0-9-]+(?:\s?\.\s?[A-Z0-9-]+)*\s?\.\s?[A-Z]{2,}/gi;
const WHATSAPP_RE = /(?:https?:\/\/)?wa\.me\/[\d+][\d+\s-]*/gi;
const BANK_RE = new RegExp(
  String.raw`(?:(?:戶口|A\/C|Account|銀行)[^\d]{0,6}\d(?:${SEP}\d){8,15})|(?<!\d)\d{3}${SEP}\d{6,9}${SEP}\d{3}(?!\d)`,
  "gi",
);
const HKID_RE =
  /(?<![A-Za-z0-9])[A-Za-z]{1,2}\s?\d{6}(?:\s?\(\s?[0-9A]\s?\)|[0-9A])?(?![0-9A-Za-z])/g;
const PHONE_RE = new RegExp(
  String.raw`(?:\+?\(?852\)?${SEP})?(?<!\d)[2-9](?:${SEP}\d){7}(?!\d)`,
  "g",
);
const ADDRESS_RE =
  /[\u4e00-\u9fffA-Za-z0-9]{0,12}(?:\d+\s?[樓座室號]|[A-Za-z]\s?室|\d+\s?\/\s?F\b|\b(?:Flat|Rm|Room|Unit|Floor|Block)\.?\s*[A-Za-z0-9]+)/gi;
const LABELLED_NAME_RE =
  /(客戶|業主|聯絡人|負責人|Attn|Contact|簽名|Name)\s*[:：]\s*[^\s,，。;；]{1,20}(?:\s[A-Z][a-z]+){0,2}/gi;
const EN_HONORIFIC_RE =
  /\b(?:Mr|Mrs|Ms|Miss|Mdm|Dr)\.?\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}/g;
const HONORIFIC_LONG_RE =
  /[\u4e00-\u9fff]{1,3}(?:先生|小姐|太太|女士|師傅|姑娘|經理|老闆)|[\u4e00-\u9fff]{1,3}\s?[Ss]ir\b/g;
const HONORIFIC_TAI_RE = /[\u4e00-\u9fff]{1,2}太(?!太|陽|空|平|古|極)/g;
const HONORIFIC_SANG_RE = /[\u4e00-\u9fff]{1,2}生(?![\u4e00-\u9fff])/g;

const SANG_KEEP = new Set([
  "發生",
  "產生",
  "學生",
  "先生",
  "人生",
  "衛生",
  "出生",
  "醫生",
  "花生",
]);

/** Full-width digits, Latin letters and ＠＋－．／ → ASCII; ideographic space → space. Chinese punctuation (，。：？！) is left alone. */
export function foldFullWidth(input: string): string {
  return input
    .replace(/[\uFF10-\uFF19\uFF21-\uFF3A\uFF41-\uFF5A\uFF20\uFF0B\uFF0D\uFF0E\uFF0F]/g, (c) =>
      String.fromCharCode(c.charCodeAt(0) - 0xfee0),
    )
    .replace(/\u3000/g, " ");
}

export function stripControlAndBidi(input: string): string {
  return input.replace(CONTROL_AND_BIDI, "");
}

/** Fold full-width first, so ９１２３４５６７ or ａ＠ｂ．ｃｏｍ cannot bypass the patterns. */
export function redactFeedbackComment(raw: string): string {
  let text = foldFullWidth(stripControlAndBidi(raw));
  text = text.replace(URL_RE, (m) => (/wa\.me\//i.test(m) ? m : "[連結]"));
  text = text.replace(EMAIL_RE, "[電郵]");
  text = text.replace(WHATSAPP_RE, "[電話]");
  text = text.replace(BANK_RE, "[戶口]");
  text = text.replace(HKID_RE, "[身份證]");
  text = text.replace(PHONE_RE, "[電話]");
  text = text.replace(ADDRESS_RE, "[地址]");
  text = text.replace(LABELLED_NAME_RE, "$1：[姓名]");
  text = text.replace(EN_HONORIFIC_RE, "[姓名]");
  text = text.replace(HONORIFIC_LONG_RE, "[姓名]");
  text = text.replace(HONORIFIC_TAI_RE, "[姓名]");
  text = text.replace(HONORIFIC_SANG_RE, (match) =>
    SANG_KEEP.has(match) ? match : "[姓名]",
  );
  text = text.trim();
  if (text.length > 500) text = text.slice(0, 500);
  return text;
}

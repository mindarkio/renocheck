/** C0, DEL, C1, soft hyphen, Mongolian vowel separator, zero-width, word joiner/invisible operators, and bidi marks. */
const CONTROL_AND_BIDI =
  /[\u0000-\u001F\u007F-\u009F\u00AD\u180E\u200B-\u200F\u202A-\u202E\u2060-\u2064\u2066-\u2069\uFEFF]/g;

/** Up to 2 separator characters between digits: space, dot, dash, underscore, slash, middle dot, brackets. */
const SEP = String.raw`[\s.\-_/·()]{0,2}`;

const URL_RE = /\b(?:https?:\/\/|www\.)\S+/gi;
/** Bounded local part and labels (RFC 5321 limits) keep long digit/letter runs linear. */
const EMAIL_RE = /[A-Z0-9._%+-]{1,64}\s?@\s?[A-Z0-9-]{1,63}(?:\s?\.\s?[A-Z0-9-]{1,63})*\s?\.\s?[A-Z]{2,}/gi;
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
  /[\u4e00-\u9fffA-Za-z0-9]{0,12}(?:\d{1,6}\s?[樓座室號]|[A-Za-z]\s?室|\d{1,6}\s?\/\s?F\b|\b(?:Flat|Rm|Room|Unit|Floor|Block)\.?\s*[A-Za-z0-9]+)/gi;
const LABELLED_NAME_RE =
  /(客戶|業主|聯絡人|負責人|Attn|Contact|簽名|Name)\s*[:：]\s*[^\s,，。;；]{1,20}(?:\s[A-Z][a-z]+){0,2}/gi;
const EN_HONORIFIC_RE =
  /\b(?:Mr|Mrs|Ms|Miss|Mdm|Dr)\.?\s*[A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2}/g;
const HONORIFIC_LONG_RE =
  /[\u4e00-\u9fff]{1,3}(?:先生|小姐|太太|女士|姑娘|經理|老闆)|[\u4e00-\u9fff]{1,3}\s?[Ss]ir\b/g;
const HONORIFIC_TAI_RE = /[\u4e00-\u9fff]{1,2}太(?!太|陽|空|平|古|極)/g;
const HONORIFIC_SANG_RE = /[\u4e00-\u9fff]{1,2}生(?![\u4e00-\u9fff])/g;

/** HK single surnames. Excludes 易平新永師陽 — those mostly are not surnames here. */
const HK_SURNAMES =
  "陳李張黃何林梁吳劉王鄭楊謝郭蔡曾鄧許馮朱蘇葉羅周盧潘余麥彭胡譚馬鍾袁莫江杜歐姚方鄒廖戴文鄺崔范程施霍冼甘關邱孔古石韋雷傅丁薛嚴洪簡湯翁符龐區岑卓唐姜尹萬高孫徐凌錢柯蕭樊侯賴呂金游熊史顏溫黎倪聶魏夏植招容伍利屈祁邵董任葛衛衞花白單田康蔣沈邢連魯" +
  // Simplified forms, so 陈生 / 黄师傅 are caught like 陳生 / 黃師傅.
  "陈张黄刘郑杨谢邓许冯苏叶罗卢钟谭马邹欧邝关韦汤庞区万孙萧赖吕颜温聂卫单蒋连鲁严钱邱";
const DOUBLE_SURNAMES =
  "歐陽|司徒|上官|諸葛|司馬|東方|皇甫|公孫|慕容|尉遲|夏侯|欧阳|诸葛|司马|东方|公孙|尉迟";
/**
 * Char after 生 that makes a word (生意、生產、生氣…) rather than 「X生」.
 * Not 成日手果前: 「陳生成日」「李生手腳」「陳生果然」「陳生日日」「何生前日」 are names.
 */
const SANG_WORD_NEXT =
  "活命產效存長物態病氣硬疏動菜鏽銹鐵涯計還育殖理火肖字機財根疑色怕記號";
const SANG_PAIR_KEEP = new Set(["衛生", "衞生", "花生", "招生"]);
/** 生意 is a word unless it is 生意見; 生生 is kept (周生生) unless it starts 生意/生日/生活. */
const SURNAME_SANG_RE = new RegExp(
  `(?<![師师])(${DOUBLE_SURNAMES}|[${HK_SURNAMES}])\\s{0,2}生(?![${SANG_WORD_NEXT}]|意(?!見)|生(?![意日活]))`,
  "g",
);
/** 「陳醫生」: 0.3.0 masked it via the 生 fallback; the bigram KEEP for 醫生 no longer does. */
const SURNAME_DOCTOR_RE = new RegExp(
  `(${DOUBLE_SURNAMES}|[${HK_SURNAMES}])\\s{0,2}[醫医]生`,
  "g",
);

/**
 * Trade words and function chars. The name is whatever follows the last of these
 * in the 1–3 chars before 師傅, so 「我問過師父」 stays and 「陳生同李師傅」 masks only 李.
 */
const GENERIC_SIFU_TOKEN =
  /裝修|水電|電工|油漆|泥水|木工|冷氣|水喉|鋁窗|地板|吊頂|扇灰|批盪|拆卸|雜工|判頭|維修|安裝|工程|清潔|傢俬|搬屋|装修|水电|电工|冷气|维修|安装|清洁|[搵揾請叫問同俾畀話個位嗰呢啲班幾兩三一各有冇好真係做拜當老咗嘅隻條都又就過得到嚟日他的我你佢們哋咁請请叫问话个这那过来]/g;
/** Runs before X師傅 so a following X仔 is not left behind. */
const SIFU_TAIL_RE =
  /(師傅|師父|师傅|师父|\[姓名\])\s{0,2}(?![個个嘅好都又同有冇係做啲咁就佢你我哋嘢幾真太細生打叫帶湊錫])([\u4e00-\u9fff]{1,2})仔(?![細褸麵])/g;
const SIFU_RE = /([\u4e00-\u9fff]{1,3})\s{0,2}(師傅|師父|师傅|师父)/g;
/** 「Ken師傅」「阿Ken 師父」. */
const EN_SIFU_RE = /\b[A-Za-z]{2,15}\s{0,2}(?:師傅|師父|师傅|师父)/g;

const SANG_KEEP = new Set([
  "一生",
  "人生",
  "先生",
  "學生",
  "醫生",
  "出生",
  "衛生",
  "衞生",
  "花生",
  "發生",
  "產生",
  "書生",
  "後生",
  "陌生",
  "師生",
  "考生",
  "男生",
  "女生",
  "新生",
  "民生",
  "眾生",
  "終生",
  "畢生",
  "招生",
  "誕生",
  "謀生",
  "野生",
  "再生",
  "天生",
  "半生",
  "今生",
  "來生",
  "前生",
  "重生",
  "寄生",
  "養生",
  "小生",
  "門生",
  "放生",
  "殺生",
  "求生",
  "逃生",
  "接生",
  "好生",
  "平生",
  "永生",
  "長生",
  "營生",
  "派生",
  "衍生",
  "共生",
  "畜生",
  "蒼生",
  "儒生",
  "晚生",
  "優生",
  "習生",
  "業生",
  "究生",
  // Trailing 生 is not CJK-followed, so the fallback would otherwise mask 周生生.
  "生生",
  // Simplified forms of the words above.
  "学生",
  "医生",
  "卫生",
  "发生",
  "产生",
  "书生",
  "师生",
  "众生",
  "终生",
  "毕生",
  "诞生",
  "谋生",
  "养生",
  "门生",
  "营生",
  "优生",
  "习生",
  "业生",
  "后生",
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

function replaceSifuTail(_match: string, head: string): string {
  return head === "[姓名]" ? "[姓名]" : `${head}[姓名]`;
}

function replaceSifu(match: string, pre: string): string {
  let cut = 0;
  for (const m of pre.matchAll(GENERIC_SIFU_TOKEN)) cut = m.index + m[0].length;
  return cut < pre.length ? `${pre.slice(0, cut)}[姓名]` : match;
}

function replaceSurnameSang(match: string): string {
  const compact = match.replace(/\s/g, "");
  return SANG_PAIR_KEEP.has(compact) ? match : "[姓名]";
}

/** Keep when the bigram before 生 is a common word; otherwise replace only that bigram. */
function replaceSangBigram(match: string): string {
  const bigram = match.slice(-2);
  if (SANG_KEEP.has(bigram)) return match;
  return `${match.slice(0, -2)}[姓名]`;
}

function applyNameVariantRules(text: string): string {
  text = text.replace(SIFU_TAIL_RE, replaceSifuTail);
  text = text.replace(EN_SIFU_RE, "[姓名]");
  text = text.replace(SIFU_RE, replaceSifu);
  text = text.replace(SURNAME_DOCTOR_RE, "[姓名]");
  text = text.replace(HONORIFIC_LONG_RE, "[姓名]");
  text = text.replace(HONORIFIC_TAI_RE, "[姓名]");
  text = text.replace(SURNAME_SANG_RE, replaceSurnameSang);
  text = text.replace(HONORIFIC_SANG_RE, replaceSangBigram);
  return text;
}

/** Fold full-width first, so ９１２３４５６７ or ａ＠ｂ．ｃｏｍ cannot bypass the patterns. */
export function redactFeedbackComment(raw: string): string {
  let text = foldFullWidth(stripControlAndBidi(raw)).replace(
    // CJK compatibility ideographs and radicals look like the unified char but miss every pattern.
    /[\u2E80-\u2FDF\uF900-\uFAFF]/g,
    (c) => c.normalize("NFKC"),
  );
  text = text.replace(URL_RE, (m) => (/wa\.me\//i.test(m) ? m : "[連結]"));
  text = text.replace(EMAIL_RE, "[電郵]");
  text = text.replace(WHATSAPP_RE, "[電話]");
  text = text.replace(BANK_RE, "[戶口]");
  text = text.replace(HKID_RE, "[身份證]");
  text = text.replace(PHONE_RE, "[電話]");
  text = text.replace(ADDRESS_RE, "[地址]");
  text = text.replace(LABELLED_NAME_RE, "$1：[姓名]");
  text = text.replace(EN_HONORIFIC_RE, "[姓名]");
  text = applyNameVariantRules(text);
  text = text.trim();
  if (text.length > 500) text = text.slice(0, 500);
  return text;
}

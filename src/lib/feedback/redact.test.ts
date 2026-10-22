import { describe, expect, it } from "vitest";
import { redactFeedbackCommentLegacy } from "./redact-legacy-for-test";
import { redactFeedbackComment, stripControlAndBidi } from "./redact";

describe("feedback comment redaction", () => {
  it("strips C0/C1 control characters and bidi marks", () => {
    expect(stripControlAndBidi("a\u0001b\u007Fc\u0080d\u202Ee\u200Bf")).toBe(
      "abcdef",
    );
  });

  it("redacts phones, emails, HKID-like tokens, and honorific names", () => {
    const raw =
      "聯絡 9123 4567 / +852 61234567 同 a.b@example.com，證 A123456(7) 陳生 李小姐 wa.me/85290000000";
    const out = redactFeedbackComment(raw);
    expect(out).not.toContain("9123");
    expect(out).not.toContain("61234567");
    expect(out).not.toContain("example.com");
    expect(out).not.toContain("A123456");
    expect(out).not.toContain("陳生");
    expect(out).not.toContain("李小姐");
    expect(out).not.toContain("wa.me");
    expect(out).toContain("[電話]");
    expect(out).toContain("[電郵]");
    expect(out).toContain("[身份證]");
    expect(out).toContain("[姓名]");
  });

  it("keeps an ordinary company mention", () => {
    expect(redactFeedbackComment("合成測試有限公司")).toBe("合成測試有限公司");
  });

  it.each([
    ["打 ９１２３４５６７", "[電話]"],
    ["打 9123.4567", "[電話]"],
    ["打 9123  4567", "[電話]"],
    ["a.b＠example.com", "[電郵]"],
    ["a.b @ example.com", "[電郵]"],
    ["Ａ１２３４５６(７)", "[身份證]"],
    ["陳師傅好好", "[姓名]"],
    ["Mr Chan good", "[姓名]"],
    ["住 九龍某街1號3樓A室", "[地址]"],
    ["Flat A, 3/F, Block 2", "[地址]"],
    ["戶口 123-456789-001", "[戶口]"],
    ["https://example.com/x", "[連結]"],
  ])("redacts %s", (raw, tag) => {
    const out = redactFeedbackComment(raw);
    expect(out).toContain(tag);
    expect(out.replace(/\[[^\]]+\]/g, "")).not.toMatch(/\d{4}|@|Chan|師傅|室/);
  });

  it("keeps ordinary text and Chinese punctuation", () => {
    for (const s of [
      "報告好有用，多謝！",
      "3 年保養",
      "第 2 項寫得唔清楚",
      "太平洋工程",
      "衛生間唔掂",
      "BR 12345678",
    ]) {
      expect(redactFeedbackComment(s)).toBe(s);
    }
  });
});

const NAME_CATCHES: Array<[string, string]> = [
  ["陳 師傅好好", "[姓名]好好"],
  ["搵陳師父做", "搵[姓名]做"],
  ["黃生話佢得", "[姓名]話佢得"],
  ["李生做嘢好快", "[姓名]做嘢好快"],
  ["陳生，好專業", "[姓名]，好專業"],
  ["歐陽生介紹", "[姓名]介紹"],
  ["師傅陳仔好好人", "師傅[姓名]好好人"],
  ["師傅強仔準時", "師傅[姓名]準時"],
  ["搵咗陳師傅", "搵咗[姓名]"],
  ["老陳師傅", "老[姓名]"],
  ["陳仔師傅", "[姓名]"],
  ["阿強師傅", "[姓名]"],
  ["陳\u3000師傅", "[姓名]"],
  ["黃生 9123 4567", "[姓名] [電話]"],
];

const NAME_KEEPS = [
  "師傅好準時",
  "裝修師傅推介",
  "水電師傅好難搵",
  "搵師傅",
  "個師傅好好人",
  "呢位師父",
  "拜師父學藝",
  "老師傅",
  "師傅好仔細",
  "師傅做嘢仔細",
  "師傅個仔幫手",
  "師父領進門",
  "我係學生",
  "大學生。",
  "醫生話",
  "出生日期",
  "衛生間唔掂",
  "衞生",
  "做生意",
  "先生",
  "花生醬",
  "招生",
  "莫生氣",
  "經常生病",
  "高生產力",
  "古生物",
  "李生記工程",
  "人生",
  "發生咩事",
  "研究生",
  "周生生",
  "報告好有用，多謝！",
  "太平洋工程",
  "BR 12345678",
  "3 年保養",
  "第 2 項寫得唔清楚",
] as const;

describe("name-variant redaction", () => {
  it.each(NAME_CATCHES)("masks %s", (raw, expected) => {
    expect(redactFeedbackComment(raw)).toBe(expected);
  });

  it.each(NAME_KEEPS)("keeps %s", (raw) => {
    expect(redactFeedbackComment(raw)).toBe(raw);
  });

  it("fails at least half of the catch table without the new name rules", () => {
    const missed = NAME_CATCHES.filter(
      ([raw, expected]) => redactFeedbackCommentLegacy(raw) !== expected,
    );
    expect(missed.length).toBeGreaterThanOrEqual(
      Math.ceil(NAME_CATCHES.length / 2),
    );
  });
});

const NAME_CATCHES_R2: Array<[string, string]> = [
  ["陳生成日遲到", "[姓名]成日遲到"],
  ["黃生意見好多", "[姓名]意見好多"],
  ["李生手腳快", "[姓名]手腳快"],
  ["陳生果然準時", "[姓名]果然準時"],
  ["陳生生意好好", "[姓名]生意好好"],
  ["陳生日日都嚟", "[姓名]日日都嚟"],
  ["何生前日嚟過", "[姓名]前日嚟過"],
  ["黃醫生。", "[姓名]。"],
  ["陳醫生話", "[姓名]話"],
  ["陳生同李師傅", "[姓名]同[姓名]"],
  ["問過陳師傅", "問過[姓名]"],
  ["陳  師傅", "[姓名]"],
  ["黃  生", "[姓名]"],
  ["陳\u2060師傅", "[姓名]"],
  ["陳\u00ad師傅", "[姓名]"],
  ["Ken師傅好好", "[姓名]好好"],
  ["阿Ken 師父", "阿[姓名]"],
  ["陈师傅", "[姓名]"],
  ["陈生话", "[姓名]话"],
  ["师傅陈仔", "师傅[姓名]"],
  ["\uF9E1生話", "[姓名]話"],
  ["\u2FC8生好好", "[姓名]好好"],
  ["多謝強生。", "多謝[姓名]。"],
  ["Mr Wong 強仔好好", "[姓名]好好"],
];

const NAME_KEEPS_R2 = [
  "我問過師父",
  "佢話師父教落",
  "我覺得師傅好好",
  "今日師傅冇嚟",
  "第二個師傅",
  "其他師傅",
  "另一位師傅",
  "新嚟嘅師傅",
  "我師傅話",
  "所有師傅都好",
  "師傅生日",
  "師傅細仔",
  "師傅叫仔仔幫手",
  "師傅非常仔細",
  "睇醫生",
  "家庭醫生",
  "学生",
  "医生",
  "发生",
  "周生生珠寶",
  "生意額",
] as const;

describe("name-variant redaction, round 2", () => {
  it.each(NAME_CATCHES_R2)("masks %s", (raw, expected) => {
    expect(redactFeedbackComment(raw)).toBe(expected);
  });

  it.each(NAME_KEEPS_R2)("keeps %s", (raw) => {
    expect(redactFeedbackComment(raw)).toBe(raw);
  });

  it("stays linear on 50k-char adversarial input", () => {
    const n = 50_000;
    for (const unit of ["9", "９", "a", "陳", "師傅", "陳生", "陳 師傅 ", "師傅陳仔"]) {
      const raw = unit.repeat(Math.ceil(n / unit.length)).slice(0, n);
      const t = performance.now();
      redactFeedbackComment(raw);
      expect(performance.now() - t).toBeLessThan(1_000);
    }
  });
});

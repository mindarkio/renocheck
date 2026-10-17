import { describe, expect, it } from "vitest";
import { z } from "zod";
import { summaryZhForLegalLookupDegraded as S } from "./search-pipeline-legal-summary";

const P = "判詞紀錄暫時未能查詢，本次評級未計入判詞。";

describe("summaryZhForLegalLookupDegraded (exact)", () => {
  it("empty", () => {
    const out = S("");
    expect(out).toBe(P + "");
    expect(out.length).toBeLessThanOrEqual(120);
    expect(S(out)).toBe(out);
  });
  it("only phrase", () => {
    const out = S("未見負面摘要");
    expect(out).toBe(P + "");
    expect(out.length).toBeLessThanOrEqual(120);
    expect(S(out)).toBe(out);
  });
  it("no 。", () => {
    const out = S("公開討論未見負面摘要，建議自行核實");
    expect(out).toBe(P + "建議自行核實。");
    expect(out.length).toBeLessThanOrEqual(120);
    expect(S(out)).toBe(out);
  });
  it("phrase + disclaimer same sentence", () => {
    const out = S("公開討論未見負面摘要，建議自行核實。");
    expect(out).toBe(P + "建議自行核實。");
    expect(out.length).toBeLessThanOrEqual(120);
    expect(S(out)).toBe(out);
  });
  it("phrase own sentence", () => {
    const out = S("本次檢索未見負面摘要。建議自行核實。");
    expect(out).toBe(P + "建議自行核實。");
    expect(out.length).toBeLessThanOrEqual(120);
    expect(S(out)).toBe(out);
  });
  it("inside quotes", () => {
    const out = S("評級為「未見負面摘要」，建議自行核實。");
    expect(out).toBe(P + "建議自行核實。");
    expect(out.length).toBeLessThanOrEqual(120);
    expect(S(out)).toBe(out);
  });
  it("twice", () => {
    const out = S("未見負面摘要。網上亦未見負面摘要。資料有限。建議自行核實。");
    expect(out).toBe(P + "資料有限。建議自行核實。");
    expect(out.length).toBeLessThanOrEqual(120);
    expect(S(out)).toBe(out);
  });
  it("雖…但", () => {
    const out = S("雖未見負面摘要，但資料有限。建議自行核實。");
    expect(out).toBe(P + "資料有限。建議自行核實。");
    expect(out.length).toBeLessThanOrEqual(120);
    expect(S(out)).toBe(out);
  });
  it("；", () => {
    const out = S("未見負面摘要；建議自行核實。");
    expect(out).toBe(P + "建議自行核實。");
    expect(out.length).toBeLessThanOrEqual(120);
    expect(S(out)).toBe(out);
  });
  it("english", () => {
    const out = S("No issues found. 未見負面摘要; please verify.");
    expect(out).toBe(P + "No issues found. please verify.");
    expect(out.length).toBeLessThanOrEqual(120);
    expect(S(out)).toBe(out);
  });
  it("already prefixed", () => {
    const out = S("判詞紀錄暫時未能查詢，本次評級未計入判詞。摘要。");
    expect(out).toBe(P + "摘要。");
    expect(out.length).toBeLessThanOrEqual(120);
    expect(S(out)).toBe(out);
  });
  it("already prefixed + phrase", () => {
    const out = S("判詞紀錄暫時未能查詢，本次評級未計入判詞。未見負面摘要。");
    expect(out).toBe(P + "");
    expect(out.length).toBeLessThanOrEqual(120);
    expect(S(out)).toBe(out);
  });
  it("disclaimer beyond 120", () => {
    const out = S("甲".repeat(110) + "。建議自行核實。");
    expect(out).toBe(
      P +
        "甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲…建議自行核實。",
    );
    expect(out.length).toBeLessThanOrEqual(120);
    expect(S(out)).toBe(out);
  });
  it("long, only 。 at end", () => {
    const out = S("甲".repeat(130) + "。");
    expect(out).toBe(
      P +
        "甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲…",
    );
    expect(out.length).toBeLessThanOrEqual(120);
    expect(S(out)).toBe(out);
  });
  it("extension plane", () => {
    const out = S("甲".repeat(60) + "𠝹".repeat(20) + "。");
    expect(out).toBe(
      P +
        "甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲甲𠝹𠝹𠝹𠝹𠝹𠝹𠝹𠝹𠝹𠝹𠝹𠝹𠝹𠝹𠝹𠝹𠝹𠝹𠝹…",
    );
    expect(out.length).toBe(120);
    expect(z.string().max(120).safeParse(out).success).toBe(true);
    expect(S(out)).toBe(out);
  });
  it("extension only", () => {
    const out = S("𠝹".repeat(130));
    expect(out).toBe(P + "𠝹".repeat(49) + "…");
    expect(out.length).toBe(120);
    expect(S(out)).toBe(out);
  });
});

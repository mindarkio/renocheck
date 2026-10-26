import { describe, expect, it } from "vitest";
import { classifyCompanyNameQuery } from "./company-query-gate";

describe("classifyCompanyNameQuery", () => {
  it("blocks english personal names and offers the continue link", () => {
    for (const typed of ["alfred ho", "Tim Ho", "Mr Ho", "Miss Chan", "Lee Garden", "Wong Kee"]) {
      const gate = classifyCompanyNameQuery(typed);
      expect(gate).toEqual({ kind: "personal", input: typed, allowCompanyOverride: true });
    }
  });

  it("blocks titled Chinese names and offers the continue link", () => {
    for (const typed of ["陳生", "何太", "陳先生", "陳小姐", "何太太", "陳師傅"]) {
      const gate = classifyCompanyNameQuery(typed);
      expect(gate).toEqual({ kind: "personal", input: typed, allowCompanyOverride: true });
    }
  });

  it("keeps 陳生裝修 as a company search", () => {
    expect(classifyCompanyNameQuery("陳生裝修")).toEqual({
      kind: "search",
      input: "陳生裝修",
    });
  });

  it("uses the short-name prompt for a 2-character trading name", () => {
    expect(classifyCompanyNameQuery("南興")).toEqual({
      kind: "short",
      input: "南興",
    });
  });

  it("blocks a 3-character Chinese name and allows continuing as a company", () => {
    expect(classifyCompanyNameQuery("何文軒")).toEqual({
      kind: "personal",
      input: "何文軒",
      allowCompanyOverride: true,
    });
  });

  it("does not block Modern Living, Urban Craft, or Alfred", () => {
    expect(classifyCompanyNameQuery("Modern Living").kind).toBe("search");
    expect(classifyCompanyNameQuery("Urban Craft").kind).toBe("search");
    expect(classifyCompanyNameQuery("Alfred")).toEqual({
      kind: "search",
      input: "Alfred",
    });
  });

  it("uses the short prompt for a Latin name under 6 letters", () => {
    expect(classifyCompanyNameQuery("Tim").kind).toBe("short");
    expect(classifyCompanyNameQuery("Alfre").kind).toBe("short");
  });

  it("searches only the trading name after 經營, trading as, or t/a", () => {
    expect(classifyCompanyNameQuery("陳大文經營南興裝修工程有限公司")).toEqual({
      kind: "search",
      input: "南興裝修工程有限公司",
    });
    expect(classifyCompanyNameQuery("Tim Ho trading as Urban Craft")).toEqual({
      kind: "search",
      input: "Urban Craft",
    });
    expect(classifyCompanyNameQuery("alfred ho t/a Modern Living")).toEqual({
      kind: "search",
      input: "Modern Living",
    });
    expect(classifyCompanyNameQuery("何太經營何文軒")).toEqual({
      kind: "personal",
      input: "何文軒",
      allowCompanyOverride: true,
    });
    expect(classifyCompanyNameQuery("陳生經營陳生").kind).toBe("personal");
  });

  it("does not search the owner when the trading name is empty", () => {
    const gate = classifyCompanyNameQuery("alfred ho trading as");
    expect(gate.kind).toBe("short");
    expect(gate.kind === "short" && gate.input).not.toBe("alfred ho");
  });

  it("folds full-width letters before the english personal-name check", () => {
    expect(classifyCompanyNameQuery("ａｌｆｒｅｄ　ｈｏ")).toEqual({
      kind: "personal",
      input: "alfred ho",
      allowCompanyOverride: true,
    });
  });

  it("reads t/a and trading as only as whole words", () => {
    expect(classifyCompanyNameQuery("Smart/Advance Engineering Limited")).toEqual({
      kind: "search",
      input: "Smart/Advance Engineering Limited",
    });
    expect(classifyCompanyNameQuery("Light/Air Design Co")).toEqual({
      kind: "search",
      input: "Light/Air Design Co",
    });
    expect(classifyCompanyNameQuery("t/a Synth Works")).toEqual({
      kind: "search",
      input: "Synth Works",
    });
    expect(classifyCompanyNameQuery("Chan trading as Synth Works")).toEqual({
      kind: "search",
      input: "Synth Works",
    });
    expect(classifyCompanyNameQuery("Chan t/a").kind).toBe("short");
    expect(classifyCompanyNameQuery("Synthat/A Design")).toEqual({
      kind: "search",
      input: "Synthat/A Design",
    });
    expect(classifyCompanyNameQuery("Synth T/Advance Works")).toEqual({
      kind: "search",
      input: "Synth T/Advance Works",
    });
  });

  it("keeps 經營 inside a register name and splits it after an owner name", () => {
    expect(classifyCompanyNameQuery("合成物業經營管理有限公司")).toEqual({
      kind: "search",
      input: "合成物業經營管理有限公司",
    });
    expect(classifyCompanyNameQuery("合成餐飲經營有限公司")).toEqual({
      kind: "search",
      input: "合成餐飲經營有限公司",
    });
    expect(classifyCompanyNameQuery("合成文經營合成裝修")).toEqual({
      kind: "search",
      input: "合成裝修",
    });
    expect(classifyCompanyNameQuery("合成生經營合成裝修")).toEqual({
      kind: "search",
      input: "合成裝修",
    });
    expect(classifyCompanyNameQuery("合成文經營").kind).toBe("short");
  });

  it("treats titles, word counts and title-like words as approved", () => {
    const mr = classifyCompanyNameQuery("Mr Synthetic");
    expect(mr.kind).toBe("personal");
    expect(classifyCompanyNameQuery("Martin").kind).toBe("search");
    expect(classifyCompanyNameQuery("Synth Chan Alpha Beta").kind).toBe("search");
    expect(classifyCompanyNameQuery("合成四字生").kind).toBe("search");
    for (const word of ["花生", "醫生", "學生", "人生"]) {
      expect(classifyCompanyNameQuery(word).kind).toBe("short");
    }
  });

  it("splits 陳大文經營 and keeps a company name that contains 經營", () => {
    expect(classifyCompanyNameQuery("陳大文經營南興裝修")).toEqual({
      kind: "search",
      input: "南興裝修",
    });
    expect(classifyCompanyNameQuery("陳大文經營").kind).toBe("short");
    expect(classifyCompanyNameQuery("甲乙物業經營管理")).toEqual({
      kind: "search",
      input: "甲乙物業經營管理",
    });
    expect(classifyCompanyNameQuery("Smart/Advance Engineering Limited")).toEqual({
      kind: "search",
      input: "Smart/Advance Engineering Limited",
    });
  });

  it("still searches a name that ends in 記 or 號", () => {
    expect(classifyCompanyNameQuery("李錦記")).toEqual({ kind: "search", input: "李錦記" });
    expect(classifyCompanyNameQuery("　李錦記 ")).toEqual({ kind: "search", input: "李錦記" });
    expect(classifyCompanyNameQuery("合成號")).toEqual({ kind: "search", input: "合成號" });
  });

  it("keeps a two-character name that ends in 記 or 號 on the short-name prompt", () => {
    for (const input of ["陳記", "李號", "登記", "型號", "記", "號", "A記", "1號"]) {
      expect(classifyCompanyNameQuery(input)).toEqual({ kind: "short", input });
    }
  });

  it("treats a 3-character name ending in 行 as a personal name with the continue link", () => {
    for (const input of ["陳志行", "永發行", "合成行"]) {
      expect(classifyCompanyNameQuery(input)).toEqual({
        kind: "personal",
        input,
        allowCompanyOverride: true,
      });
    }
  });

  it("keeps a three-character name personal when 記 or 號 is not last", () => {
    for (const input of ["行文華", "記文華", "文號華"]) {
      expect(classifyCompanyNameQuery(input)).toEqual({
        kind: "personal",
        input,
        allowCompanyOverride: true,
      });
    }
  });

  it("keeps a generic trade word with 記、行 or 號 on the short-name prompt", () => {
    for (const input of ["水電行", "工程行", "裝修行", "設計記", "香港號", "合行"]) {
      expect(classifyCompanyNameQuery(input)).toEqual({ kind: "short", input });
    }
  });
});

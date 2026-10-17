import { describe, expect, it } from "vitest";
import {
  normalizeForQuoteMatch,
  sourceQuoteMatchesExcerpt,
} from "./judgment-summary-draft";
import { htmlToPlainText } from "./judgment-lrs-plain-text";

describe("judgment summary draft helpers", () => {
  it("matches quotes with collapsed whitespace", () => {
    const src = "本案涉及  裝修  工程合約  爭議。";
    expect(
      sourceQuoteMatchesExcerpt("裝修 工程合約 爭議", src),
    ).toBe(true);
  });

  it("strips basic HTML to text", () => {
    const plain = htmlToPlainText("<p>判詞</p><br/>第二段");
    expect(normalizeForQuoteMatch(plain)).toContain("判詞");
  });
});

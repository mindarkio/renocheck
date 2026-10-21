import { describe, expect, it } from "vitest";
import { entityMatchTokens } from "./search-entity-labels";
import {
  buildRetrievalEvidence,
  countBoundDisputeSignals,
  countBoundPraiseSignals,
  filterWebSearchHitsForLlm,
  matchesPhoneAnchor,
} from "./search-evidence-filter";
import type { WebSearchHit } from "./web-search";
import { calibrateEvaluation } from "./risk-report-calibration-v2";

describe("filterWebSearchHitsForLlm", () => {
  it("drops hits with no entity token", () => {
    const hits: WebSearchHit[] = [
      {
        title: "裝修群組總覽",
        url: "https://www.facebook.com/groups/renovation",
        snippet: "歡迎加入討論",
      },
      {
        title: "良心裝修佬評價",
        url: "https://www.lihkg.com/thread/3049015",
        snippet: "工程質素問題",
      },
    ];
    const out = filterWebSearchHitsForLlm(hits, ["良心裝修"]);
    expect(out).toHaveLength(1);
    expect(out[0].url).toContain("lihkg");
  });

  it("buildRetrievalEvidence mirrors bound hits with matchedToken", () => {
    const hits: WebSearchHit[] = [
      {
        title: "良心裝修佬評價",
        url: "https://www.lihkg.com/thread/3049015",
        snippet: "工程質素問題討論",
      },
    ];
    const bound = filterWebSearchHitsForLlm(hits, ["良心裝修"]);
    const evidence = buildRetrievalEvidence(bound, ["良心裝修"]);
    expect(evidence).toHaveLength(1);
    expect(evidence[0].matchedToken).toBe("良心裝修");
    expect(evidence[0].matchReason).toBe("entity_token");
    expect(evidence[0].url).toContain("lihkg");
  });

  it("binds MWC fullwidth digits to forum halfwidth (創建２１ vs 創建21)", () => {
    const tokens = entityMatchTokens(
      { companyName: "創建 2 1 顧問有限公司" },
      { mwcCompanyName: "創建２１顧問有限公司" },
    );
    const hits: WebSearchHit[] = [
      {
        title: "投稿",
        url: "https://www.facebook.com/share/r/1",
        snippet:
          "避免中伏創建21顧問有限公司（CR21康藝家居）裝修爛尾投訴",
      },
    ];
    expect(filterWebSearchHitsForLlm(hits, tokens)).toHaveLength(1);
  });

  it("matches tokens when snippet uses half-width brackets", () => {
    const hits: WebSearchHit[] = [
      {
        title: "討論",
        url: "https://www.threads.com/post/1",
        snippet: "源始(國際)設計及裝修糾紛分享",
      },
    ];
    const out = filterWebSearchHitsForLlm(hits, ["源始（國際）"]);
    expect(out).toHaveLength(1);
  });

  it("does not bind 物種源始 on bare 源始 token", () => {
    const tokens = entityMatchTokens({
      companyName: "源始（國際）設計及裝修有限公司",
    });
    const hits: WebSearchHit[] = [
      {
        title: "物種源始",
        url: "https://example.com/darwin",
        snippet: "達爾文演化論第一章",
      },
    ];
    expect(filterWebSearchHitsForLlm(hits, tokens)).toHaveLength(0);
  });

  it("mustIncludeAny drops token match without anchor", () => {
    const hits: WebSearchHit[] = [
      {
        title: "ISO",
        url: "https://www.instagram.com/reel/x",
        snippet: "國際ISO認證裝修公司",
      },
      {
        title: "源始公司",
        url: "https://www.facebook.com/page",
        snippet: "源始（國際）設計及裝修",
      },
    ];
    const out = filterWebSearchHitsForLlm(hits, ["源始（國際）", "源始國際"], {
      mustIncludeAny: ["源始（國際）", "源始國際"],
    });
    expect(out).toHaveLength(1);
    expect(out[0].url).toContain("facebook");
  });

  it("returns empty when no tokens and no phone", () => {
    const hits: WebSearchHit[] = [
      { title: "x", url: "https://example.com", snippet: "y" },
    ];
    expect(filterWebSearchHitsForLlm(hits, [])).toEqual([]);
  });

  it("binds phone_anchor when snippet contains formatted phone", () => {
    const hits: WebSearchHit[] = [
      {
        title: "裝修討論",
        url: "https://www.facebook.com/post/1",
        snippet: "聯絡 9280-5455 關於爛尾糾紛",
      },
    ];
    const out = filterWebSearchHitsForLlm(hits, [], {
      normalizedPhone: "92805455",
    });
    expect(out).toHaveLength(1);
    const evidence = buildRetrievalEvidence(out, [], {
      normalizedPhone: "92805455",
    });
    expect(evidence[0].matchReason).toBe("phone_anchor");
    expect(evidence[0].matchedToken).toBe("92805455");
  });

  it("prefers entity_token over phone_anchor in evidence", () => {
    const hits: WebSearchHit[] = [
      {
        title: "良心裝修 9280 5455",
        url: "https://www.lihkg.com/thread/1",
        snippet: "良心裝修佬電話92805455",
      },
    ];
    const bound = filterWebSearchHitsForLlm(hits, ["良心裝修"], {
      normalizedPhone: "92805455",
    });
    const evidence = buildRetrievalEvidence(bound, ["良心裝修"], {
      normalizedPhone: "92805455",
    });
    expect(evidence[0].matchReason).toBe("entity_token");
  });
});

describe("countBoundPraiseSignals", () => {
  it("O6: counts traditional 推薦", () => {
    const hits: WebSearchHit[] = [
      {
        title: "帖",
        url: "https://www.facebook.com/1",
        snippet: "十分推薦這間公司",
      },
    ];
    expect(countBoundPraiseSignals(hits)).toBe(1);
  });

  it.each(["不推薦", "唔推薦", "唔係好推薦", "不太推薦", "唔好推薦"])(
    "O6: negated praise form %s → 0",
    (snippet) => {
      const hits: WebSearchHit[] = [
        { title: "帖", url: "https://www.facebook.com/1", snippet },
      ];
      expect(countBoundPraiseSignals(hits)).toBe(0);
    },
  );

  it.each([
    "十分推薦",
    "非常推薦",
    "好專業",
    "唔錯，十分推薦",
    "唔使諗，推薦",
    "不錯，推薦",
    "準時完工，好滿意",
  ])("O6: still counts praise: %s", (snippet) => {
    const hits: WebSearchHit[] = [
      { title: "帖", url: "https://www.facebook.com/1", snippet },
    ];
    expect(countBoundPraiseSignals(hits)).toBe(1);
  });

  it.each([
    "唔係好推薦，做嘢慢",
    "不太推薦，態度差",
    "唔好推薦俾人",
  ])("R-R2-2: negated praise snippet %s → 中性 not 未見負面摘要", (snippet) => {
    const hits: WebSearchHit[] = [
      { title: "帖", url: "https://www.facebook.com/1", snippet },
    ];
    const out = calibrateEvaluation({
      slice: {
        grade: "C",
        confidence: "low",
        summaryZh: "x",
        discussionCount: 0,
        themes: [],
        highlights: [],
      },
      evidence: {
        llmHitCount: 1,
        boundHitCount: 1,
        serpHitCount: 5,
        boundDisputeHitCount: 0,
        boundPraiseHitCount: countBoundPraiseSignals(hits),
      },
      mwcMatched: false,
      mwcAmbiguous: false,
      generatedAt: "2026-06-01T00:00:00.000Z",
    });
    expect(out.evaluation.riskBandZh).toBe("中性");
    expect(out.evaluation.riskBandZh).not.toBe("未見負面摘要");
  });

  it("O6: 唔專業 is not praise", () => {
    const hits: WebSearchHit[] = [
      {
        title: "帖",
        url: "https://www.lihkg.com/1",
        snippet: "師傅好唔專業",
      },
    ];
    expect(countBoundPraiseSignals(hits)).toBe(0);
  });
});

describe("countBoundDisputeSignals", () => {
  it("ignores negated 投訴 in praise snippets", () => {
    const hits: WebSearchHit[] = [
      {
        title: "推薦",
        url: "https://www.facebook.com/1",
        snippet: "溝通順暢，完全冇投訴",
      },
    ];
    expect(countBoundDisputeSignals(hits)).toBe(0);
  });

  it("still counts undisputed 投訴", () => {
    const hits: WebSearchHit[] = [
      {
        title: "苦主",
        url: "https://www.lihkg.com/1",
        snippet: "多宗投訴",
      },
    ];
    expect(countBoundDisputeSignals(hits)).toBe(1);
  });
});

describe("matchesPhoneAnchor", () => {
  it("matches +852 prefix in url digits", () => {
    expect(
      matchesPhoneAnchor(
        "https://wa.me/85291234567",
        "91234567",
      ),
    ).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { entityMatchTokens } from "./search-entity-labels";
import {
  PUBLIC_LINK_DISPLAY_CAP,
  classifyPublicLinkHit,
  selectPublicLinkHits,
} from "./public-link-signal";
import type { WebSearchHit } from "./web-search";

const COMPANY = "齊來設計";
const TOKENS = [COMPANY];

function hit(
  title: string,
  snippet = "",
  url = "https://www.facebook.com/groups/example/posts/1",
): WebSearchHit {
  return { title, url, snippet };
}

describe("classifyPublicLinkHit — question posts and listicles", () => {
  it("drops a bare 'has anyone used them' question", () => {
    const decision = classifyPublicLinkHit(
      hit("有否人使用過齊來設計居+屋Dimensions Interiors 效果如何？"),
      TOKENS,
    );
    expect(decision).toEqual({ keep: false, reason: "bare_question" });
  });

  it("drops a bare 'anyone hired them' question without a personal name", () => {
    const decision = classifyPublicLinkHit(
      hit("想請教大家齊來設計有人幫襯過嘛？有任何後續"),
      TOKENS,
    );
    expect(decision).toEqual({ keep: false, reason: "bare_question" });
  });

  it("drops a generic renovation question that only mentions the company in the snippet", () => {
    const decision = classifyPublicLinkHit(
      hit(
        "想全屋裝修水電做。但係私想分開做，唔洗啲咩特別design",
        "群組有人提過齊來設計",
      ),
      TOKENS,
    );
    // Not a question cue on its own; dropped because nothing near the name is a signal.
    expect(decision).toEqual({ keep: false, reason: "no_signal" });
  });

  it("drops the same generic question when the company name is absent", () => {
    const decision = classifyPublicLinkHit(
      hit("想全屋裝修水電做。但係私想分開做，唔洗啲咩特別design"),
      TOKENS,
    );
    expect(decision).toEqual({ keep: false, reason: "weak_entity" });
  });

  it("drops a numbered listicle that only names the company among others", () => {
    const decision = classifyPublicLinkHit(
      hit("1. Homic Décor. 居屋・舊屋 2. 翻新齊來設計居+屋"),
      TOKENS,
    );
    expect(decision).toEqual({ keep: false, reason: "listicle" });
  });

  it("drops a question even when the group name contains 中伏", () => {
    const decision = classifyPublicLinkHit(
      hit(
        "中伏經驗 | 有否人使用過齊來設計居+屋Dimensions Interiors 效果如何？",
      ),
      TOKENS,
    );
    expect(decision).toEqual({ keep: false, reason: "bare_question" });
  });

  it("drops a title about another company with only a passing mention", () => {
    const decision = classifyPublicLinkHit(
      hit("Homic Décor 中伏實測", "文末提到齊來設計"),
      TOKENS,
    );
    expect(decision).toEqual({ keep: false, reason: "no_signal" });
  });

  it("drops a URL-only match", () => {
    const decision = classifyPublicLinkHit(
      hit(
        "有否人用過？效果如何？",
        "想請教大家",
        "https://www.facebook.com/groups/example/齊來設計",
      ),
      TOKENS,
    );
    expect(decision).toEqual({ keep: false, reason: "weak_entity" });
  });

  it("drops recruitment", () => {
    const decision = classifyPublicLinkHit(
      hit("齊來設計請緊師傅，月薪面議"),
      TOKENS,
    );
    expect(decision).toEqual({ keep: false, reason: "recruitment" });
  });

  it("drops bare praise with no concrete detail", () => {
    const decision = classifyPublicLinkHit(hit("推薦齊來設計"), TOKENS);
    expect(decision).toEqual({ keep: false, reason: "no_signal" });
  });
});

describe("classifyPublicLinkHit — signal worth showing", () => {
  it("matches an English name regardless of case", () => {
    const decision = classifyPublicLinkHit(
      hit(
        "Hang Wai Engineering Limited took the deposit and disappeared",
        "",
        "https://www.lihkg.com/thread/3",
      ),
      ["HANG WAI ENGINEERING LIMITED"],
    );
    expect(decision).toEqual({ keep: true, reason: "dispute_or_experience" });
  });

  it("keeps a first-hand dispute", () => {
    const decision = classifyPublicLinkHit(
      hit("齊來設計裝修爛尾，訂金收咗就失聯"),
      TOKENS,
    );
    expect(decision).toEqual({
      keep: true,
      reason: "dispute_or_experience",
    });
  });

  it("keeps a question that also states a first-hand incident", () => {
    const decision = classifyPublicLinkHit(
      hit("有冇人同我一樣中伏齊來設計？訂金三萬收咗就唔覆機"),
      TOKENS,
    );
    expect(decision).toEqual({
      keep: true,
      reason: "dispute_or_experience",
    });
  });

  it("keeps praise that includes a concrete detail", () => {
    const decision = classifyPublicLinkHit(
      hit("十分推薦齊來設計，態度好好，收費清楚"),
      TOKENS,
    );
    expect(decision).toEqual({ keep: true, reason: "specific_praise" });
  });

  it("keeps a court or news item", () => {
    const decision = classifyPublicLinkHit(
      hit("明報：齊來設計被小額錢債審裁處裁定敗訴"),
      TOKENS,
    );
    expect(decision).toEqual({ keep: true, reason: "news_or_registry" });
  });

  it("keeps a registry listing", () => {
    const decision = classifyPublicLinkHit(
      hit("屋宇署小型工程承建商名冊：齊來設計工程有限公司"),
      TOKENS,
    );
    expect(decision).toEqual({ keep: true, reason: "news_or_registry" });
  });

  it("keeps a list item that states an incident about the company", () => {
    const decision = classifyPublicLinkHit(
      hit("1. Homic Décor 2. 齊來設計訂金收咗走數"),
      TOKENS,
    );
    expect(decision).toEqual({
      keep: true,
      reason: "dispute_or_experience",
    });
  });

  it("keeps a snippet complaint when the title is about someone else", () => {
    const decision = classifyPublicLinkHit(
      hit("Homic Décor 效果如何？", "另外齊來設計訂金收咗就失聯"),
      TOKENS,
    );
    expect(decision.keep).toBe(true);
  });

  it("keeps gold-style dispute snippets for 創建21, 良心裝修, and 源始", () => {
    const create21 = entityMatchTokens({
      companyName: "創建 2 1 顧問有限公司",
    });
    expect(
      classifyPublicLinkHit(
        hit(
          "投稿",
          "避免中伏創建21顧問有限公司（CR21康藝家居）裝修爛尾投訴",
          "https://www.facebook.com/share/r/1",
        ),
        create21,
      ).keep,
    ).toBe(true);

    const conscientious = entityMatchTokens({
      companyName: "良心裝修顧問有限公司",
    });
    expect(
      classifyPublicLinkHit(
        hit(
          "良心裝修佬評價",
          "工程質素問題",
          "https://www.lihkg.com/thread/3049015",
        ),
        conscientious,
      ).keep,
    ).toBe(true);

    const yuanshi = entityMatchTokens({
      companyName: "源始（國際）設計及裝修有限公司",
    });
    expect(
      classifyPublicLinkHit(
        hit(
          "討論",
          "源始(國際)設計及裝修糾紛分享",
          "https://www.threads.com/post/1",
        ),
        yuanshi,
      ).keep,
    ).toBe(true);
  });

  it("keeps a phone-anchored dispute and drops a phone-only question", () => {
    expect(
      classifyPublicLinkHit(
        hit("裝修討論", "聯絡 9280-5455 關於爛尾糾紛"),
        [],
        "92805455",
      ).keep,
    ).toBe(true);
    expect(
      classifyPublicLinkHit(
        hit("裝修討論", "有冇人知 9280-5455 係邊間"),
        [],
        "92805455",
      ),
    ).toEqual({ keep: false, reason: "bare_question" });
  });
});

describe("classifyPublicLinkHit — review follow-ups", () => {
  it("keeps a court item even when a reader comment asks a question", () => {
    expect(
      classifyPublicLinkHit(
        hit("明報：齊來設計被小額錢債審裁處裁定敗訴", "網友留言：請問點睇判詞？"),
        TOKENS,
      ),
    ).toEqual({ keep: true, reason: "news_or_registry" });
  });

  it("uses a 2–3 character brand when no longer anchor exists", () => {
    expect(classifyPublicLinkHit(hit("新家居裝修爛尾，訂金收咗就失聯"), ["新家居"]).keep).toBe(true);
    expect(classifyPublicLinkHit(hit("新家居 Instagram"), ["新家居"])).toEqual({
      keep: false,
      reason: "no_signal",
    });
    expect(
      classifyPublicLinkHit(hit("新家居", ""), ["新家居裝修工程有限公司", "新家居"]),
    ).toEqual({ keep: false, reason: "weak_entity" });
  });

  it("keeps English incidents and court items, drops English questions and hiring", () => {
    const en = ["Brightway Interiors"];
    expect(classifyPublicLinkHit(hit("Brightway Interiors took my deposit and disappeared"), en).keep).toBe(true);
    expect(classifyPublicLinkHit(hit("Small Claims Tribunal ruling against Brightway Interiors"), en)).toEqual({
      keep: true,
      reason: "news_or_registry",
    });
    expect(classifyPublicLinkHit(hit("Complaint: Brightway Interiors works delayed 6 months"), en).keep).toBe(true);
    expect(classifyPublicLinkHit(hit("Has anyone used Brightway Interiors? Any reviews?"), en)).toEqual({
      keep: false,
      reason: "bare_question",
    });
    expect(classifyPublicLinkHit(hit("Brightway Interiors is hiring a site foreman"), en).keep).toBe(false);
  });

  it("does not let another list item's incident count for this company", () => {
    expect(
      classifyPublicLinkHit(hit("十大裝修公司 1. 甲公司爛尾 2. 齊來設計 3. 乙"), TOKENS),
    ).toEqual({ keep: false, reason: "listicle" });
  });

  it("does not treat a neutral milestone as an incident", () => {
    expect(classifyPublicLinkHit(hit("齊來設計招聘師傅，完工獎金"), TOKENS)).toEqual({
      keep: false,
      reason: "recruitment",
    });
    expect(classifyPublicLinkHit(hit("齊來設計呃錢，有冇人一齊追？"), TOKENS).keep).toBe(true);
  });

  it("does not treat 想全屋 as a question when the post is specific praise", () => {
    expect(
      classifyPublicLinkHit(hit("我想全屋翻新，最後揀咗齊來設計，推薦，態度好收費清楚"), TOKENS),
    ).toEqual({ keep: true, reason: "specific_praise" });
  });

  it("shows a dispute-seeking question even without a first-hand incident", () => {
    expect(
      classifyPublicLinkHit(hit("有冇人同齊來設計有糾紛？想搵苦主"), TOKENS),
    ).toEqual({ keep: true, reason: "dispute_or_experience" });
    expect(
      classifyPublicLinkHit(hit("有冇人投訴過齊來設計？"), TOKENS),
    ).toEqual({ keep: true, reason: "dispute_or_experience" });
    expect(
      classifyPublicLinkHit(
        hit("Has anyone had a dispute with Brightway Interiors?"),
        ["Brightway Interiors"],
      ),
    ).toEqual({ keep: true, reason: "dispute_or_experience" });
  });

  it("still hides a bare usage question", () => {
    expect(
      classifyPublicLinkHit(hit("有否人使用過齊來設計效果如何？"), TOKENS),
    ).toEqual({ keep: false, reason: "bare_question" });
    expect(
      classifyPublicLinkHit(hit("有冇人推薦齊來設計？"), TOKENS),
    ).toEqual({ keep: false, reason: "bare_question" });
  });

  it("shows negated praise as a negative first-hand signal", () => {
    for (const title of [
      "唔係好推薦齊來設計，收費貴",
      "唔推薦齊來設計",
      "冇推薦齊來設計",
      "不推薦齊來設計",
      "冇乜推薦齊來設計",
      "不太推薦齊來設計",
      "唔好推薦齊來設計",
    ]) {
      expect(classifyPublicLinkHit(hit(title), TOKENS)).toEqual({
        keep: true,
        reason: "dispute_or_experience",
      });
    }
    expect(
      classifyPublicLinkHit(
        hit("十分推薦齊來設計，態度好好，收費清楚，唔錯"),
        TOKENS,
      ),
    ).toEqual({ keep: true, reason: "specific_praise" });
  });

  it("treats 唔會 / 不會 / 唔太 / 未必 推薦 like 唔推薦", () => {
    for (const title of [
      "唔會推薦齊來設計",
      "唔太推薦齊來設計",
      "不會推薦齊來設計，收費貴",
      "未必推薦齊來設計",
    ]) {
      expect(classifyPublicLinkHit(hit(title), TOKENS).keep).toBe(true);
    }
  });

  it("does not read idioms or double negation as negated praise", () => {
    for (const title of [
      "唔係唔推薦齊來設計，只係貴少少",
      "唔推薦都難，齊來設計真係好",
      "不推薦不行！齊來設計",
      "無推薦費！齊來設計免費度尺",
      "冇推薦錯，齊來設計",
    ]) {
      expect(classifyPublicLinkHit(hit(title), TOKENS).keep).toBe(false);
    }
  });

  it("does not treat a denied dispute in a question as dispute-seeking", () => {
    expect(
      classifyPublicLinkHit(hit("齊來設計做嘢好好，冇糾紛，有冇人都係咁覺得？"), TOKENS).keep,
    ).toBe(false);
    expect(
      classifyPublicLinkHit(
        hit("Has anyone used Brightway Interiors? No dispute so far, any tips?"),
        ["Brightway Interiors"],
      ).keep,
    ).toBe(false);
    expect(classifyPublicLinkHit(hit("齊來設計有冇糾紛？"), TOKENS).keep).toBe(true);
    expect(classifyPublicLinkHit(hit("有冇人知點搵齊來設計苦主？"), TOKENS).keep).toBe(true);
  });

  it("does not read 有冇推薦 / 冇人唔推薦 as negated praise", () => {
    expect(classifyPublicLinkHit(hit("有冇推薦齊來設計？"), TOKENS).keep).toBe(false);
    expect(classifyPublicLinkHit(hit("冇人唔推薦齊來設計"), TOKENS).keep).toBe(false);
  });

  it("uses the whole text when only the phone is in the title", () => {
    expect(classifyPublicLinkHit(hit("9123-4567 做到一半爛尾", "裝修討論"), [], "91234567")).toEqual({
      keep: true,
      reason: "dispute_or_experience",
    });
  });

  it("ignores an incident far from the company name", () => {
    expect(
      classifyPublicLinkHit(
        hit("Homic Décor 分享", `齊來設計${"。".repeat(30)}另一間爛尾`),
        TOKENS,
      ),
    ).toEqual({ keep: false, reason: "no_signal" });
  });
});

describe("selectPublicLinkHits", () => {
  const questions: WebSearchHit[] = [
    hit(
      "有否人使用過齊來設計居+屋Dimensions Interiors 效果如何？",
      "",
      "https://www.facebook.com/groups/a/posts/1",
    ),
    hit(
      "想請教大家齊來設計有人幫襯過嘛？有任何後續",
      "",
      "https://www.facebook.com/groups/a/posts/2",
    ),
    hit(
      "想全屋裝修水電做。但係私想分開做，唔洗啲咩特別design",
      "群組有人提過齊來設計",
      "https://www.facebook.com/groups/a/posts/3",
    ),
    hit(
      "1. Homic Décor. 居屋・舊屋 2. 翻新齊來設計居+屋",
      "",
      "https://www.facebook.com/groups/a/posts/4",
    ),
  ];

  it("returns no links when every hit is a question or listicle", () => {
    const selected = selectPublicLinkHits(questions, TOKENS);
    expect(selected.hits).toEqual([]);
    expect(selected.kept).toBe(0);
    expect(selected.dropped.bare_question).toBe(2);
    expect(selected.dropped.no_signal).toBe(1);
    expect(selected.dropped.listicle).toBe(1);
  });

  it("keeps the dispute and drops the questions", () => {
    const dispute = hit(
      "齊來設計裝修爛尾，訂金收咗就失聯",
      "",
      "https://www.lihkg.com/thread/9",
    );
    const selected = selectPublicLinkHits([dispute, ...questions], TOKENS);
    expect(selected.hits.map((h) => h.url)).toEqual([
      "https://www.lihkg.com/thread/9",
    ]);
  });

  it("caps the list and prefers a later news item over extra praise", () => {
    const praise = Array.from({ length: 9 }, (_, i) =>
      hit(
        "十分推薦齊來設計，態度好好，收費清楚",
        "",
        `https://www.facebook.com/groups/a/posts/p${i}`,
      ),
    );
    const news = hit(
      "明報：齊來設計被小額錢債審裁處裁定敗訴",
      "",
      "https://www.mingpao.com/article/1",
    );
    const selected = selectPublicLinkHits([...praise, news], TOKENS);
    expect(selected.hits).toHaveLength(PUBLIC_LINK_DISPLAY_CAP);
    expect(selected.hits.some((h) => h.url.includes("mingpao"))).toBe(true);
    expect(selected.dropped.over_cap).toBe(2);
  });

  it("keeps a cited highlight URL even when the heuristic would drop it", () => {
    const selected = selectPublicLinkHits(questions, TOKENS, {
      alwaysIncludeUrls: new Set([questions[0]!.url]),
    });
    expect(selected.hits.map((h) => h.url)).toEqual([questions[0]!.url]);
    expect(selected.dropped.bare_question).toBe(1);
    expect(selected.dropped.no_signal).toBe(1);
  });

  it("keeps a cited URL inside the cap and still caps the rest", () => {
    const disputes = Array.from({ length: 10 }, (_, i) =>
      hit(`齊來設計爛尾 個案${i}`, "", `https://lihkg.com/thread/${i}`),
    );
    const cited = questions[0]!;
    const selected = selectPublicLinkHits([...disputes, cited], TOKENS, {
      alwaysIncludeUrls: new Set([cited.url]),
    });
    expect(selected.hits).toHaveLength(PUBLIC_LINK_DISPLAY_CAP);
    expect(selected.hits.at(-1)?.url).toBe(cited.url);
    expect(selected.dropped.over_cap).toBe(3);
  });

  it("keeps a dispute-keyword source even when its URL is not http(s)", () => {
    const disputeQuestion = hit(
      "中伏經驗 | 有否人使用過齊來設計效果如何？",
      "",
      "javascript:alert(1)",
    );
    const selected = selectPublicLinkHits([disputeQuestion], TOKENS, {
      keepDisputeSources: true,
    });
    expect(selected.hits.map((h) => h.url)).toEqual(["javascript:alert(1)"]);
  });

  it("keeps a dispute-keyword question when that sentence will be shown", () => {
    const disputeQuestion = hit(
      "中伏經驗 | 有否人使用過齊來設計效果如何？",
      "",
      "https://www.facebook.com/groups/a/posts/d",
    );
    const bare = hit(
      "有否人使用過齊來設計效果如何？",
      "",
      "https://www.facebook.com/groups/a/posts/q",
    );
    const selected = selectPublicLinkHits([disputeQuestion, bare], TOKENS, {
      keepDisputeSources: true,
    });
    expect(selected.hits.map((h) => h.url)).toEqual([disputeQuestion.url]);
    expect(selected.dropped.bare_question).toBe(1);
  });

  it("does not exempt a question that did not contribute a dispute keyword", () => {
    const selected = selectPublicLinkHits(questions, TOKENS, {
      keepDisputeSources: true,
    });
    expect(selected.hits).toEqual([]);
  });

  it("keeps every dispute-keyword source past the display cap", () => {
    const hits = Array.from({ length: 9 }, (_, i) =>
      hit(
        "中伏經驗 | 有否人使用過齊來設計效果如何？",
        "",
        `https://www.facebook.com/groups/a/posts/d${i}`,
      ),
    );
    const selected = selectPublicLinkHits(hits, TOKENS, {
      keepDisputeSources: true,
    });
    expect(selected.hits).toHaveLength(9);
    expect(selected.dropped.bare_question).toBe(0);
    expect(selected.dropped.over_cap).toBe(0);
  });

  it("keeps kept dispute statements past the display cap too", () => {
    const hits = Array.from({ length: 10 }, (_, i) =>
      hit(`${COMPANY}爛尾 個案${i}`, "苦主分享", `https://www.lihkg.com/thread/s${i}`),
    );
    const selected = selectPublicLinkHits(hits, TOKENS, {
      keepDisputeSources: true,
    });
    expect(selected.hits).toHaveLength(10);
    expect(selected.dropped.over_cap).toBe(0);
  });

  it("keeps every cited highlight past the display cap", () => {
    const hits = Array.from({ length: 9 }, (_, i) =>
      hit(
        "有否人使用過齊來設計效果如何？",
        "",
        `https://www.facebook.com/groups/a/posts/c${i}`,
      ),
    );
    const selected = selectPublicLinkHits(hits, TOKENS, {
      alwaysIncludeUrls: new Set(hits.map((h) => h.url)),
    });
    expect(selected.hits).toHaveLength(9);
  });

  it("still hides a dispute-keyword question when a summary was formed", () => {
    const disputeQuestion = hit(
      "中伏經驗 | 有否人使用過齊來設計效果如何？",
      "",
      "https://www.facebook.com/groups/a/posts/d",
    );
    const selected = selectPublicLinkHits([disputeQuestion], TOKENS);
    expect(selected.hits).toEqual([]);
    expect(selected.dropped.bare_question).toBe(1);
  });

  it("returns kept links in L1 order, not rank order", () => {
    const praise = hit(
      "十分推薦齊來設計，態度好好，收費清楚",
      "",
      "https://www.facebook.com/groups/a/posts/p",
    );
    const news = hit(
      "明報：齊來設計被小額錢債審裁處裁定敗訴",
      "",
      "https://www.mingpao.com/article/1",
    );
    const selected = selectPublicLinkHits([praise, news], TOKENS);
    expect(selected.hits.map((h) => h.url)).toEqual([praise.url, news.url]);
  });
});

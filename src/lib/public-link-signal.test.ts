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
    expect(decision).toEqual({ keep: false, reason: "bare_question" });
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
    expect(selected.dropped.bare_question).toBe(3);
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
    expect(selected.dropped.bare_question).toBe(2);
  });
});

# LRS keyword probe — round 2（2026-10-16）

**狀態：** probe only（**唔 crawl**）  
**分支：** `docs/dec-0012-legal-data-sources`  
**輸出：** `scripts/output/lrs-keyword-probe.json`（`pnpm lrs:probe-keywords`）

## 下一輪 topic 清單（Aaron）

| id | 模式 | keyword | 備註 |
|----|------|---------|------|
| `phrase-判頭` | phrase | 判頭 | 已有 probe |
| `phrase-水電` | phrase | 水電 | 細於「水電工程」 |
| `phrase-冷氣` | phrase | 冷氣 | |
| `phrase-浴室` | phrase | 浴室 | |
| `phrase-廚櫃` | phrase | 廚櫃 | |
| `phrase-油漆` | phrase | 油漆 | |
| `phrase-防水` | phrase | 防水 | |
| `phrase-拆卸` | phrase | 拆卸 | |
| `phrase-室內設計` | phrase | 室內設計 | |
| `anywords-interior` | anywords | interior | 英文 anywords |

## 決策門檻（沿用 D1）

- `hitsJu` **> 500** → 考慮 **年份分片** 再 crawl（browser 驗證後加 profile）
- probe `null` → 檢查 LRS HTML／`&nbsp;` 解析後重跑

## Probe 結果（2026-10-16T19:48Z · JU `hitsJu`）

| id | keyword | hitsJu | 備註 |
|----|---------|--------|------|
| phrase-判頭 | 判頭 | **396** | |
| phrase-水電 | 水電 | **944** | >500 → 年份分片候選 |
| phrase-冷氣 | 冷氣 | **1175** | >500 |
| phrase-浴室 | 浴室 | **490** | |
| phrase-廚櫃 | 廚櫃 | **71** | |
| phrase-油漆 | 油漆 | **732** | >500 |
| phrase-防水 | 防水 | **392** | |
| phrase-拆卸 | 拆卸 | **431** | |
| phrase-室內設計 | 室內設計 | **183** | |
| anywords-interior | interior | **1582** | >500 |

解析：`parseLrsSearchResultMeta`（`searchresult-total` span）。完整清單見 `scripts/output/lrs-keyword-probe.json`。

## 命令

```bash
pnpm lrs:probe-keywords
```

Crawl（**本輪不做**）：`pnpm lrs:save-search-pages --profile-id=...` 待 probe 結果 + Aaron OK。

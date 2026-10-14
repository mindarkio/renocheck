# 報告質量 — 發布前人工 10 條（P2-E3）

**目的：** 在自動 `pnpm eval:report-quality` / `--live` 之外，用人眼確認 **評級、摘要語氣、查證範圍** 符合 [`compliance-legal`](../../.cursor/rules/compliance-legal.mdc)（唔用「黑店／騙子」、低資料時唔放大確定性）。

**做法：** `pnpm dev` 運行中，對每條查詢開報告（建議 `refresh: true`），填下表。全部 **Pass** 方可當 MVP 發布 gate。

| # | 查詢（輸入） | 預期重點 | Grade 合理？ | 摘要中性？ | 查證範圍清晰？ | 審閱人 | 日期 | 備註 |
|---|--------------|----------|:------------:|:----------:|:--------------:|--------|------|------|
| 1 | 公司：`良心裝修顧問有限公司` | bound 可能 ≥1；零 highlight 仍 ≤C | | | | | | |
| 1b | 公司：`創建 2 1 顧問有限公司`（refresh） | bound≥3；檢索層有 FB/LIHKG；唔應 B+「未見糾紛」 | | | | | | |
| 2 | 公司：`源始（國際）設計及裝修有限公司` | stretch gold；低置信；唔應 D–F 無據 | | | | | | |
| 3 | 公司：`Renocheck評估用虛構裝修有限公司` | 虛構；≤C | | | | | | |
| 4 | 公司：`輝煌設計工程有限公司` | MWC 匹配 | | | | | | |
| 5 | 電話：`92805455` | `searchLabelUsed` = 名冊名 | | | | | | |
| 6 | 公司：`偉景工程` | MWC；弱討論 | | | | | | |
| 7 | 公司：`深德(香港)工程有限公司` | MWC；唔混淆其他「深德」 | | | | | | |
| 8 | 公司：`南興工程有限公司` | 可能唔 hit 名冊；`user_only` 可接受 | | | | | | |
| 9 | _自選：用戶輸入名 ≠ 名冊名（有 MWC hit 時）_ | `nameAlignment` / 文案 | | | | | | |
| 10 | _自選：BR 或第二條電話（若有真實測試資料）_ | 匹配路徑 | | | | | | |

**自動對照（唔代替本表）：**

```bash
pnpm eval:report-quality
pnpm eval:report-quality --live   # 需 dev + .env.local；食 quota
```

```bash
pnpm eval:report-quality --live --gate   # 8 條 blocking gold
```

目錄：[`docs/design/release-gold-set.md`](../design/release-gold-set.md)。Fixture：`report-quality-live.json`；上表 8–10 為人工補齊。

# DEC-0011: MWC 名冊姓名按政府公開資料顯示（取消個人脫敏）

- **Status:** accepted
- **Date:** 2026-10-15
- **Supersedes:** MVP §2.4「個人師傅脫敏顯示」；產品 rule「Mask individuals」條文（以本 DEC 為準）。

## Context

MVP 曾要求 MWC(W) 個人承建商在報告以 `陳** 師傅` 脫敏，避免 UI 像「點名批判」。實際 **Track 1** 資料來自屋宇署／DATA.GOV **公開名冊**（公司名、獲授權簽署人、屆滿日等），與用戶自行上政府網站查閱內容一致。繼續脫敏會令報告與可核對來源不一致，削弱 SSOT。

## Options

| Option | Pros | Cons |
|--------|------|------|
| A — 維持脫敏 | 與早期 MVP 文案一致 | 與名冊／BD 連結不一致；用戶無法對照合約簽署人 |
| B — 名冊欄位按政府刊登全文顯示 | 可核對、合規敘事為「公開資料摘要」 | 個人姓名可見（與政府站相同） |
| C — 僅官方區塊全文、查證對象仍脫敏 | 折衷 | 同一實體兩種寫法，易混淆 |

## Decision

**Option B.** 當 entity 來自 MWC 名冊匹配時：

- `entity.displayName`、`official.details.companyName`、`official.details.authorizedSignatory` 使用匯入之名冊字串（含 MWC(W) 個人）。
- 不再產生 `entity.maskedLabel`；schema 保留該欄位僅作舊 cache 相容，新報告不寫入。
- 討論摘要／網搜來源仍只展示 snippet 與連結；**不得**在無公開來源下自行拼湊或指控個人（既有合規規則不變）。

## Consequences

- 實作：`buildOfficialMwcDetails`、`synthesizeRiskReport` 已移除 `maskIndividualDisplayName`。
- 文案：報告仍須標示名冊摘錄截至時間、屋宇署連結與免責聲明。
- 舊 `search_cache` 可能仍含脫敏或 `maskedLabel`；新搜尋或 cache miss 後更新。

## Reversal cost

低—恢復脫敏函數與 pipeline 分支即可；需再更新 DEC／MVP 與人工審閱免責表述。

## Triggers to reconsider

- 法律／PDPO 意見要求對非名冊來源的個人姓名另作處理（與本 DEC 範圍分開）。
- 若將論壇 UGC 全名寫入報告（現為 MVP out of scope）— 需新 DEC，**不得**沿用本 DEC 作為 UGC 真名依據。

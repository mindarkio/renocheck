# Track 1 判詞 — 產品負責人確認（beta／內測）

**用途：** 你唔使識法律細節；只要確認 **產品怎樣用資料、用戶會看到什麼**。  
**唔代替：** 律師意見書；有需要仍要另找法律顧問睇司法網站條款。

**技術狀態（2026-10-16）：** 15 宗真實判詞已入庫；lookup + alias smoke 通過。見 [`judgment-seed-human-signoff-2026-10-16.md`](./judgment-seed-human-signoff-2026-10-16.md)。

---

## 請你確認（打勾 = 同意上 beta）

| # | 聲明（白話） |
|---|----------------|
| 1 | 判詞區只顯示 **政府公開來源的要點 + 連結**，唔當「法庭判咗佢係黑店」。 |
| 2 | 資料 **唔完整**：只覆蓋我哋人手入庫嘅少數案，查唔到 **唔代表** 冇官司。 |
| 3 | 用戶會見到 **免責／生成時間／法律頁**（現有 MVP 機制）。 |
| 4 | 內測／preview 可以開 `LEGAL_EVENTS_ENABLED`；**正式對外大推** 前會再問你是否擴庫或找法律睇條款。 |
| 5 | **暫唔再加** seed（維持 15 宗），直到內測有反饋或你明確要求加案。 |

**負責人：** Product owner（chat）  
**日期：** 2026-10-16  
**確認方式：** Chat —「同意 Track 1 beta 確認表 1–5」（**已記錄**）

---

## D0.3（法律條款）— 務實狀態

| 項 | 狀態 |
|----|------|
| 來源清單 | [`judgments-sources.md`](../sourcedata/judgments-sources.md) |
| 實際做法 | 只存 **要點列點 + `sourceUrl`**，唔 mirror 全文；user search **唔** 即時爬 LRS |
| 風險 | LRS 條款寫明商業使用可能要司法機構同意 — **正式收費／大規模推廣前** 應法律確認 |
| **beta 決策（產品）** | 在 **非收費、小流量內測** 下，用公開連結 + 摘要轉述，風險可控；你確認表 #1–4 即足夠開 preview |

---

## DEC-0012

- **2026-10-16：** Repo 已標記 DEC-0012 **beta scope accepted**（見 decision-log 頂部欄位）。
- 完整 v1.0.0 GA 仍須 DEC status → **accepted** + 建議法律睇 `judgments-sources.md` 第一行備註。

## Preview 開關（Vercel）

| Env | 值 | 備註 |
|-----|-----|------|
| `LEGAL_EVENTS_ENABLED` | `1` | Production／preview 要顯示判詞區 |
| Supabase | 已 `import:judgments` | 與 preview 同一 project |
| Smoke | 任一本庫 seed 公司名 + `refresh: true` | 見 `development.md` Track 1 段 |

本地 `pnpm dev` 預設已開；只改 Vercel 時要 **redeploy**。

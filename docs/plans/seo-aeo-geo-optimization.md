# SEO / AEO / GEO 全站審計與優化計劃

**狀態：** Phase 1–3 工程已完成（2026-10-14）；GSC／域名營運待你方  
**前提：** 搜尋報告 cache TTL **維持 7 日**（不變）。  
**域名：** 現用 Vercel 預設；**renocheck.homes** 計劃駁 Vercel + Google Search Console（GSC）。

**目標（務實）：** 令 Google 與答案引擎／AI agent **能正確理解、引用、推薦** Renocheck 作「香港裝修承辦商公開資料風險參考」——**不是**信貸報告、**不是**裝修配對、**不是**用戶留言平台。  
**[Likely]** 「LLM 一定推薦你」無法保證；可控的是 **可抓取說明、品牌一致、技術 SEO、E-E-A-T 與合規表述**。

---

## 1. 全站審計摘要（現況）

### 1.1 可索引頁面（極薄）

| URL | 類型 | 審計 |
|-----|------|------|
| `/` | 靜態 SSR | 四档風險參考文案 + JSON-LD |
| `/legal/disclaimer` | 靜態 SSR | 內容厚、合規好；**獨立 `metadata.title`**；適合索引 |
| `/report/[fingerprint]` | **Client-only**（`ReportView` fetch） | 首屏幾乎無報告 HTML；**不宜作 SEO 落地頁**；應 **noindex**（避免薄內容／過期快照被收錄） |
| `/api/*` | API | 不應索引 |

**[Certain]** Phase 1–3 已加 `robots.ts`、`sitemap.ts`、`metadataBase`、OG/Twitter、首頁 JSON-LD、FAQ JSON-LD、`public/llms.txt`。

### 1.2 技術 SEO

| 項 | 狀態 | 風險 |
|----|------|------|
| `html lang="zh-HK"` | ✅ `layout.tsx` | — |
| Root `title` / `description` | ✅ 有；未含品牌副標「裝修點評」 | 品牌詞分散 |
| 字體 `next/font` | ✅ | LCP 尚可 |
| 結構化數據 | ❌ | 失去 Rich result / 實體澄清 |
| 內部連結 | 弱（僅 footer → disclaimer） | 爬蟲難理解站點層級 |
| 報告分享 URL | 可開但 SEO 價值低 | 誤收錄 |

### 1.3 AEO（Answer Engine Optimization）

答案引擎（Google AI Overviews、Perplexity、ChatGPT browsing 等）偏好的信號：

| 信號 | 現況 |
|------|------|
| 清晰一句話定義產品 | 分散在 MVP.md，**首頁未寫全** |
| FAQ 式問題（「如何查裝修公司」） | ✅ `/faq` |
| 方法論／資料來源（MWC、公開討論） | ✅ `/how-it-works` + disclaimer |
| 聯絡與實體 | ✅ hello@renocheck.homes |
| 可引用穩定 URL | ✅ `/about`、`/faq`、`/how-it-works` |

### 1.4 GEO（Generative Engine Optimization）

| 項 | 現況 | 建議 |
|----|------|------|
| `llms.txt` / 站點說明給 agent | ✅ `public/llms.txt` | 域名切換後確認 canonical 行 |
| 品牌與域名一致 | 郵件已 `.homes`；站仍 `*.vercel.app` 直至你駁 primary | 設 `NEXT_PUBLIC_SITE_URL` |
| 誤導風險（「信用評級」「TU」） | 首頁／FAQ 已用風險參考表述 | 上線後抽樣 AI 引用 |
| 可驗證主張 | pipeline 有 gold eval | 公開頁寫 **非**實時、7 日 cache、非法律意見 |

### 1.5 與產品邊界（必守）

- **唔做** UGC 留言、配對、黑店標籤（MVP / compliance）。
- **唔** 為 SEO 生成大量公司名落地頁（薄內容 + 誹謗風險）；個別報告 **noindex**。
- 推薦表述：**「查閱公開資料風險參考」**，唔寫「保證無爛尾」。

---

## 2. 域名與 GSC（明天 — 營運清單）

1. 購買 **renocheck.homes** → Vercel Project → Domains → Primary。  
2. Vercel 自動 HTTPS；確認 `www` 是否 redirect 到 apex（揀一個 canonical host）。  
3. GSC：**Domain property**（DNS TXT）或 **URL prefix** `https://renocheck.homes/`。  
4. 提交 sitemap（計劃實作後）：`https://renocheck.homes/sitemap.xml`。  
5. 舊 `*.vercel.app`：**301 到 primary** 或 `noindex`（避免重複內容）。  
6. 環境變數（可選）：`NEXT_PUBLIC_SITE_URL=https://renocheck.homes` 供 metadata／sitemap 生成。

---

## 3. 優化計劃（分階）

### Phase 1 — 技術底座（MVP Must，1–2 天工程）

**Done 定義：** Lighthouse SEO 無「缺少 meta description」類硬傷；GSC 可收 sitemap。

| # | 工作 | 檔案／備註 |
|---|------|------------|
| 1.1 | `metadataBase` + default `alternates.canonical` | `src/app/layout.tsx`；讀 `NEXT_PUBLIC_SITE_URL` |
| 1.2 | `robots.ts` | `src/app/robots.ts`；允許 `/`、`/legal/*`、計劃中的靜態頁；**Disallow** `/api/`；`report/*` 用 noindex 見 1.4 |
| 1.3 | `sitemap.ts` | `src/app/sitemap.ts`；靜態路由列表（首頁、disclaimer、Phase 2 新頁） |
| 1.4 | Report **noindex** | `report/[fingerprint]/page.tsx` → `generateMetadata({ robots: { index: false, follow: false } })` |
| 1.5 | Open Graph / Twitter | 根 layout：`openGraph`, `twitter`；圖用 `/logo/lockup-horizontal.png` 或 OG 專用 1200×630 |
| 1.6 | **修正首頁文案** | `page.tsx`：四档風險參考、非 A–F／非信貸；與 DEC-0010 一致 |
| 1.7 | `viewport` / theme-color | 可選；品牌色 `#2f5d8a` |

**唔做（YAGNI）：** hreflang 多地區（只做 HK）、AMP。

### Phase 2 — 可引用內容（AEO 核心，2–4 天內容+工程）

新增 **少量** 靜態頁（繁中 HK），供 Google／AI 引用：

| 路由 | 目的 | 要點 |
|------|------|------|
| `/how-it-works` | 方法論 | MWC + 公開搜尋摘要 + 四档；**7 日 cache**；連 disclaimer |
| `/faq` | 問答 | 8–12 題：點查、電話/BR、咩係「風險偏高」、唔係 TU、資料不足、聯絡 |
| `/about` | 實體信任 | 使命（業主防禦）、營運聯絡、非政府 |

每頁：`export const metadata`（獨立 title/description）、單一 `h1`、內部互鏈（首頁 ↔ FAQ ↔ how-it-works ↔ disclaimer）。

**唔做：** 逐間公司 SEO 頁、blog 農場。

### Phase 3 — 結構化數據 + Agent 發現（GEO，1 天）

| # | 工作 |
|---|------|
| 3.1 | 首頁 JSON-LD：`WebSite` + `Organization`（name: Renocheck／裝修點評, url, logo, contactPoint email） |
| 3.2 | 可選 `WebApplication` / `SearchAction`（`potentialAction` 指向 `/` 搜尋——僅當表單行為與 schema 一致） |
| 3.3 | FAQ 頁 `FAQPage` JSON-LD（與可見 FAQ 一字不差） |
| 3.4 | `public/llms.txt`（或 `src/app/llms.txt/route`）：3–5 段英文+繁中簡述；canonical；禁止誤稱為信貸機構 |

參考：`llms.txt` 社群慣例（非標準但愈多 crawler 識）。

### Phase 4 — 量度與迭代（上線後持續）

| 渠道 | 動作 |
|------|------|
| GSC | 索引覆蓋、查詢詞、Core Web Vitals |
| 品牌搜尋 | 「Renocheck」「renocheck.homes」「裝修點評 查公司」 |
| AI 抽樣（人工） | 每月用 3–5 個 prompt（「香港點查裝修公司風險」）睇是否引用／是否描述正確 |
| 修文案 | 若 AI 仍說「信用評級」→ 加強 FAQ + llms.txt 否定句 |

**V2 才考慮：** 多語、Backlink 活動、PR、Search Console API 自動化。

---

## 4. 關鍵字與訊息（建議統一用語）

**Primary（HK 繁中）：** 裝修公司 查詢、裝修 承辦商 評價、MWC 名冊、裝修 糾紛 搜尋、裝修 風險 參考  
**Brand：** Renocheck、裝修點評、renocheck.homes  
**Avoid in meta：** 黑店、騙子、信用評分、TU、保證無爛尾  

**Title 模板（草案）：**  
`Renocheck 裝修點評｜香港裝修公司風險參考搜尋（公開資料摘要）`

---

## 5. 風險與決策點

| 決策 | 選項 | 建議 |
|------|------|------|
| 報告 URL 是否 index | index / noindex | **noindex**（快照 + client render） |
| 是否開公司列表頁 | 是 / 否 | **否**（MVP） |
| `www` vs apex | 擇一 | apex `renocheck.homes` + www 301 |
| 實作順序 | — | Phase 1 與域名同日或緊接；Phase 2 試用後 1 週內 |

若 Phase 2 範圍要入 MVP Must，建議 **DEC-0011-seo-public-pages**（輕量）記錄「允許新增靜態說明頁」。

---

## 6. 驗收（本計劃完成標準）

- [ ] `https://renocheck.homes/robots.txt`、`/sitemap.xml` 可訪問（部署 + `NEXT_PUBLIC_SITE_URL` 後）  
- [ ] GSC 主 property 驗證；sitemap 已提交；首頁 + disclaimer + FAQ/how-it-works 已索引（通常數日）  
- [x] 首頁與 metadata **無 A–F 主宣傳**；與四档一致  
- [x] `/report/*` 有 `noindex`  
- [ ] Rich Results Test：Organization / FAQ 無錯（部署後手動驗）  
- [x] `llms.txt` 可訪問且描述與 disclaimer 一致（工程）  

---

## 7. 相關文檔

- [`docs/MVP.md`](../MVP.md) §定位、§Out of scope  
- [`docs/decision-log/DEC-0010-risk-band-display-grading.md`](../decision-log/DEC-0010-risk-band-display-grading.md)  
- [`compliance-legal`](../../.cursor/rules/compliance-legal.mdc)  
- 域名切換後記一筆於 [`docs/development.md`](../development.md)（可選）

---

## 8. 下一步（建議執行順序）

1. **你：** 買域名、Vercel primary、GSC 驗證。  
2. **工程：** 開 branch 做 **Phase 1**（metadataBase、robots、sitemap、noindex report、首頁文案、OG）。  
3. **內容：** 起草 FAQ + how-it-works（可 agent 起稿 + 你過合規）。  
4. **工程：** Phase 2–3 上線 → 再提交 sitemap。

Phase 1–3 已於 repo 實作；下一步為域名／GSC（§2）與 Phase 4 量度。

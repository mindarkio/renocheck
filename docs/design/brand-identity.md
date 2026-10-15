# Renocheck 品牌識別（Brand identity）

**來源：** [`public/logo/overview.png`](../../public/logo/overview.png)（與 `public/logo/*.svg` 同色值）  
**狀態：** MVP 基線（2026-10-14）  
**產品定位：** 香港業主防禦向的裝修承辦商**公開資料風險參考**——可信、冷靜，唔似推銷或配對平台（見 [`ui-principles.md`](../ui-principles.md)）。

---

## 1. 品牌名稱

| 用途 | 寫法 |
|------|------|
| 英文（正式） | **Renocheck**（lockup 上可全大寫 **RENOCHECK**） |
| 中文（正式） | **裝修點評** |
| 合併稱呼 | Renocheck 裝修點評 |
| 域名 | **renocheck.homes** |
| 聯絡 | hello@renocheck.homes |

**主 tagline（SSOT：`BRAND_TAGLINE` in `src/lib/constants.ts`）：**  
裝修爛尾、糾紛避雷——一鍵查公開討論風險參考。

副句／合規緩衝（首頁、footer）：並非信貸報告、配對服務或法律意見；內容為公開來源摘要，不構成對任何公司的指控。

對外長述（可改寫但勿偏離 tagline 含義）：  
整合 MWC 名冊與公開討論摘要的裝修風險參考搜尋。

---

## 2. 標誌（Logo）

**Mark：** 屋形輪廓 + 對話氣泡尾；內有三條橫線（清單／討論摘要意象）。

**檔案（優先用 SVG）：** `public/logo/`

| 情境 | 檔案 |
|------|------|
| 網站 header（白底） | `lockup-horizontal.svg` |
| 白底完整（橫／疊） | `lockup-horizontal.svg`、`lockup-stacked.svg` |
| 藍底反白 | `lockup-horizontal-reversed.svg`、`lockup-stacked-reversed.svg`、`mark-reversed-on-blue.svg` |
| 單色印刷／極簡 | `lockup-horizontal-black.svg`、`mark-black.svg` |
| Favicon | `favicon-16.svg`、`favicon-32.svg`；App `src/app/icon.svg` |
| 總覽 | `overview.png` |

**勿：** 拉長比例、改色、加陰影漸層、與「黑店／騙子」等標籤並排作攻擊性宣傳。

---

## 3. 色彩（Color）

overview 標示兩個**品牌主色**；實作上 mark 在白底第三條橫線用略深珊瑚以保對比（見 `build.py`）。

### 3.1 主色板

| 名稱 | Hex | RGB | 用途 |
|------|-----|-----|------|
| **Navy 海軍藍** | `#2F5D8A` | 47, 93, 138 | 主色：按鈕、連結、反白底、瀏覽器 `theme-color`、mark 主體 |
| **Coral 珊瑚** | `#FF8F7D` | 255, 143, 125 | **點綴**：mark 第三條（藍底反白版）、極少量 UI 強調 |
| **Coral emphasis** | `#D64532` | 214, 69, 50 | 白底 mark 第三條（對比度）；**唔**作全站「危險／風險偏高」色 |
| **Ink 墨灰** | `#2B2F36` | 43, 47, 54 | 字標深灰（lockup 中文／英文）；可接近正文色 |
| **White** | `#FFFFFF` | — | 全站頁面底（`--background`）、反白字 |

### 3.2 UI 語意（與產品邏輯）

| Token（`globals.css`） | 對應 | 說明 |
|--------------------------|------|------|
| `primary` | Navy `#2F5D8A` | 主 CTA、連結、進度完成態 |
| `accent` | Coral `#FF8F7D` | 小面積強調（**唔**取代風險分檔色） |
| `foreground` | 近 Ink | 正文 |
| `warning` | Amber（非品牌色） | **低置信度／資料不足**；必須配文字，唔用 Coral 冒充警告 |

風險參考分檔（風險偏高／中等／中性／未見負面摘要）**唔**綁品牌 Coral，避免「珊瑚 = 壞公司」聯想；分檔樣式見 [`risk-band-grading.md`](risk-band-grading.md) 與 `ReportCard`。

### 3.3 可及性

- Navy 上白字：正文級對比通常足夠；細字留意 `#2F5D8A` on `#FFFFFF` 作**大標／連結**較安全，細灰字用 `muted-foreground`。
- 藍底反白 mark 上第三條用 `#FF8F7D`（較白底 `#D64532` 淺），以達約 3:1 對藍底（logo 生成腳本註解）。
- Coral 不作唯一資訊載體（色盲／低對比場景）。

### 3.4 禁止用法

- 唔把 Coral 當全站錯誤色或「風險偏高」專色。
- 唔用鮮紅綠燈暗示「好公司／壞公司」。
- 唔在報告 UI 使用「黑店」「騙子」等品牌色標籤。

---

## 4. 字體（Typography）

| 層級 | 規格 |
|------|------|
| 產品 UI | **Noto Sans TC**（`next/font`），標題與正文同 family，以字重區分 |
| Logo 字標 | 設計稿內嵌曲線字（**唔**用 Noto 替代 lockup 內中文／RENOCHECK） |

建議 UI 字重：正文 400、小標 500–600、頁面 `h1` 600–700。

---

## 5. 語氣與視覺性格

- **可信：** 像查閱公開紀錄，唔像廣告。
- **冷靜：** 海軍藍主導；珊瑚只作「記起這是對話／摘要」的輕量記憶點。
- **保護性：** 繁中 HK、事實表述、風險參考唔等同信貸或法律意見。

---

## 6. 數碼資產檢查表

- [ ] Header 用 `lockup-horizontal.svg`（已接線）
- [ ] `NEXT_PUBLIC_SITE_URL` 與正式域名一致
- [ ] `theme-color` = `#2f5d8a`
- [ ] 新 UI 只改 CSS variables，唔散落硬編碼 hex（除非 logo 資產）

---

## 7. 相關文檔

- [`ui-principles.md`](../ui-principles.md) — 組件與 token 使用
- [`risk-band-grading.md`](risk-band-grading.md) — 風險分檔顯示
- [`compliance-legal`](../../.cursor/rules/compliance-legal.mdc) — 對外措辭

# UI 原則（Renocheck MVP）

## 定位

可信、冷靜、像「查閱公開紀錄」——唔像推銷或配對平台。

**品牌色與 logo 用法：** [`design/brand-identity.md`](design/brand-identity.md)（`#2F5D8A` / `#FF8F7D`，見 `public/logo/overview.png`）。

## 字體

- **Noto Sans TC**（via `next/font/google`；繁中字形由字體本身提供）
- 標題與正文同一 family，以字重區分
- 頁面 **唔** 用 Noto 取代 logo lockup 內字標

## 色（semantic tokens — 見 `src/app/globals.css`）

| Token | 用途 |
|-------|------|
| `background` / `foreground` | 頁面底與正文（前景近品牌 Ink `#2B2F36`） |
| `primary` | 主按鈕、品牌連結（Navy `#2F5D8A`） |
| `accent` | 極少量點綴（Coral；**唔**作風險分檔或錯誤色） |
| `muted` | 次要說明、footer |
| `warning` | 低置信度、注意（amber；必須配文字標籤） |

換色時只改 CSS variables，唔散改 class。

## 風險參考分檔（DEC-0010）

- 以 **風險偏高／風險中等／中性／未見負面摘要** 為主標，唔用紅綠燈暗示「好公司／壞公司」
- 資料不足時用 `warning` 樣式 + 「資料不足／低置信度」文案
- 分檔視覺見 [`design/risk-band-grading.md`](design/risk-band-grading.md)

## 付費牆（視覺）

- 免費層：分檔 + 討論 **條數**
- 付費層：摘要／連結可 blur 或鎖定；**唔隱藏**分檔本身

## 組件

- `SearchForm`：公司名 / 電話 / BR，至少填一項
- Header：`lockup-horizontal.svg`；Footer：免責與說明頁連結

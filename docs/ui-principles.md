# UI 原則（Renocheck MVP）

## 定位

可信、冷靜、像「查閱公開紀錄」——唔像推銷或配對平台。

## 字體

- **Noto Sans TC**（via `next/font/google`；繁中字形由字體本身提供）
- 標題與正文同一 family，以字重區分

## 色（semantic tokens — 見 `src/app/globals.css`）

| Token | 用途 |
|-------|------|
| `background` / `foreground` | 頁面底與正文（zinc 系中性） |
| `primary` | 主按鈕、品牌連結（slate 深灰，非鮮豔推銷色） |
| `muted` | 次要說明、footer |
| `warning` | 低置信度、注意（amber；必須配文字標籤） |

## 評級 A–F

- 必須顯示 **字母 + 中文說明**，唔用紅綠燈暗示「好公司／壞公司」
- 資料不足時用 warning 樣式 + 「資料不足／低置信度」文案

## 付費牆（視覺）

- 免費層：評級 + 討論 **條數**
- 付費層：摘要／連結可 blur 或鎖定；**唔隱藏**評級本身

## 組件

- `SearchForm`：公司名 / 電話 / BR，至少填一項
- Header / Footer：免責連結常駐

Logo 與完整 VI 待定；換色時只改 CSS variables，唔散改 class。

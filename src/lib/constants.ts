/**
 * Site / deploy label. `next.config.ts` inlines `package.json` `version` as
 * `NEXT_PUBLIC_APP_VERSION` so client bundles do not import package.json.
 */
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0";

/** Primary brand tagline (HK 繁中); see docs/design/brand-identity.md */
export const BRAND_TAGLINE_LINES = [
  "裝修糾紛、爛尾中伏、不良紀錄",
  "係好係壞，一鍵睇哂",
] as const;

/** Flat tagline for metadata / JSON-LD */
export const BRAND_TAGLINE = BRAND_TAGLINE_LINES.join(" ");

/** Site footer disclaimer (all pages). */
export const FOOTER_DISCLAIMER =
  "裝修點評僅根據網上可檢索的公開資料（包括 MWC 名冊與公開討論摘要）整理風險參考分檔，供你自行核實與參考；並不構成法律、投資或專業意見，亦非信貸報告或裝修配對服務。";

export const DISCLAIMER_VERSION = "1.2.1";

/** Bump when RiskReport shape changes; stale cache entries are ignored. */
export const REPORT_VERSION = "2.6.0";

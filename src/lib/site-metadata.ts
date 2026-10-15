import type { Metadata } from "next";
import { BRAND_TAGLINE } from "./constants";
import { getSiteUrl } from "./site-url";

const defaultTitle =
  "Renocheck 裝修點評｜香港裝修公司風險參考搜尋（公開資料摘要）";
const defaultDescription = `${BRAND_TAGLINE} 輸入公司名稱、香港電話或商業登記號碼查閱 MWC 名冊與公開摘要。並非信貸報告、配對或法律意見。`;

export function buildRootMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: defaultTitle,
      template: "%s · Renocheck",
    },
    description: defaultDescription,
    alternates: {
      canonical: "/",
    },
    openGraph: {
      type: "website",
      locale: "zh_HK",
      url: siteUrl,
      siteName: "Renocheck 裝修點評",
      title: defaultTitle,
      description: defaultDescription,
      images: [
        {
          url: "/logo/lockup-horizontal.svg",
          width: 702,
          height: 320,
          alt: "Renocheck 裝修點評",
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: defaultTitle,
      description: defaultDescription,
      images: ["/logo/lockup-horizontal.svg"],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export const SITE_CONTACT_EMAIL = "hello@renocheck.homes";

import type { Metadata } from "next";
import { BRAND_TAGLINE } from "./constants";
import { getSiteUrl } from "./site-url";

const defaultTitle =
  "Renocheck 裝修點評｜香港裝修公司風險參考搜尋（公開資料摘要）";
const defaultDescription = `${BRAND_TAGLINE} 輸入公司名稱、香港電話或商業登記號碼查閱 MWC 名冊與公開摘要。並非信貸報告、配對或法律意見。`;

export const OG_IMAGE = {
  url: "/og.png",
  width: 1200,
  height: 630,
  alt: "Renocheck 裝修點評",
};

/** Per-page metadata: own title/description/canonical/OG/Twitter. */
export function pageMetadata({
  path,
  title,
  description,
}: {
  path: string;
  title?: string;
  description: string;
}): Metadata {
  const fullTitle = title ? `${title} · Renocheck` : defaultTitle;
  return {
    ...(title ? { title } : { title: { absolute: defaultTitle } }),
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      locale: "zh_HK",
      siteName: "Renocheck 裝修點評",
      url: path,
      title: fullTitle,
      description,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [OG_IMAGE.url],
    },
  };
}

export const HOME_DESCRIPTION = defaultDescription;

export function buildRootMetadata(): Metadata {
  const siteUrl = getSiteUrl();
  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: defaultTitle,
      template: "%s · Renocheck",
    },
    description: defaultDescription,
    openGraph: {
      type: "website",
      locale: "zh_HK",
      siteName: "Renocheck 裝修點評",
      title: defaultTitle,
      description: defaultDescription,
      images: [OG_IMAGE],
    },
    twitter: {
      card: "summary_large_image",
      title: defaultTitle,
      description: defaultDescription,
      images: [OG_IMAGE.url],
    },
  };
}

export const SITE_CONTACT_EMAIL = "hello@renocheck.homes";

import { BRAND_TAGLINE } from "./constants";
import { SITE_CONTACT_EMAIL } from "./site-metadata";

const AREA_SERVED = {
  "@type": "AdministrativeArea" as const,
  name: "Hong Kong",
  alternateName: "香港",
};

/** Approved disambiguation (W6). Not a visible UI string. */
const DISAMBIGUATING_DESCRIPTION =
  "Hong Kong-only (zh-HK) public-record risk-reference search for renovation contractors. Not affiliated with renocheck.co.uk (UK). No expert consultation or cost estimates.";

export function buildSiteJsonLd(siteUrl: string) {
  const orgId = `${siteUrl}/#org`;
  return {
    "@context": "https://schema.org" as const,
    "@graph": [
      {
        "@type": "WebSite" as const,
        name: "Renocheck 裝修點評",
        alternateName: ["裝修點評"],
        url: siteUrl,
        inLanguage: "zh-HK",
        description: BRAND_TAGLINE,
        publisher: { "@id": orgId },
      },
      {
        "@type": "Organization" as const,
        "@id": orgId,
        name: "Renocheck",
        alternateName: "裝修點評",
        url: siteUrl,
        logo: `${siteUrl}/logo/mark-color-on-white.png`,
        email: SITE_CONTACT_EMAIL,
        areaServed: AREA_SERVED,
        knowsLanguage: "zh-HK",
        disambiguatingDescription: DISAMBIGUATING_DESCRIPTION,
      },
      {
        "@type": "WebApplication" as const,
        name: "Renocheck 裝修點評",
        url: siteUrl,
        applicationCategory: "UtilitiesApplication",
        operatingSystem: "Web",
        inLanguage: "zh-HK",
        areaServed: AREA_SERVED,
        isAccessibleForFree: true,
        provider: { "@id": orgId },
      },
    ],
  };
}

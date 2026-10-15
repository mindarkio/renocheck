import Image from "next/image";
import Link from "next/link";
import { LandingStats } from "@/components/LandingStats";
import {
  marketingPageInnerClass,
  marketingPageShellClass,
} from "@/components/ContentPage";
import { SearchForm } from "@/components/SearchForm";
import { getLandingPublicStats } from "@/lib/landing-public-stats";
import { JsonLd } from "@/components/JsonLd";
import { getSiteUrl } from "@/lib/site-url";
import { BRAND_TAGLINE, BRAND_TAGLINE_LINES } from "@/lib/constants";
import { SITE_CONTACT_EMAIL } from "@/lib/site-metadata";

export default async function Home() {
  const landingStats = await getLandingPublicStats();
  const siteUrl = getSiteUrl();
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "Renocheck 裝修點評",
        url: siteUrl,
        inLanguage: "zh-HK",
        description: BRAND_TAGLINE,
      },
      {
        "@type": "Organization",
        name: "Renocheck",
        alternateName: "裝修點評",
        url: siteUrl,
        logo: `${siteUrl}/logo/mark-color-on-white.svg`,
        email: SITE_CONTACT_EMAIL,
      },
    ],
  };

  return (
    <main
      className={`relative items-center justify-start ${marketingPageShellClass}`}
    >
      <JsonLd data={jsonLd} />
      <div className={`flex flex-col items-center ${marketingPageInnerClass}`}>
        <h1 className="sr-only">香港裝修公司風險參考搜尋</h1>
        <Link
          href="/"
          className="mb-6 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 sm:mb-8"
        >
          <Image
            src="/logo/lockup-stacked.svg"
            alt="Renocheck 裝修點評"
            width={216}
            height={254}
            className="h-[clamp(7rem,22vw,9.5rem)] w-auto"
            priority
          />
        </Link>
        <div className="mb-8 max-w-md text-center sm:mb-10">
          <p
            className="text-sm font-normal leading-snug tracking-wide text-muted-foreground sm:text-[0.9375rem]"
          >
            {BRAND_TAGLINE_LINES[0]}
          </p>
          <p
            className="mt-2.5 text-lg font-semibold leading-snug text-primary sm:mt-3 sm:text-xl sm:leading-tight"
          >
            {BRAND_TAGLINE_LINES[1]}
          </p>
        </div>
        <SearchForm variant="landing" />
      </div>
      {landingStats ? (
        <div
          className="absolute inset-x-4 bottom-2 mx-auto w-full max-w-[584px] sm:bottom-3"
        >
          <LandingStats stats={landingStats} />
        </div>
      ) : null}
    </main>
  );
}

import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { LandingStats } from "@/components/LandingStats";
import {
  marketingPageInnerClass,
  marketingPageShellClass,
} from "@/components/ContentPage";
import { SearchForm } from "@/components/SearchForm";
import { ServiceBanner } from "@/components/ServiceBanner";
import { getLandingPublicStats } from "@/lib/landing-public-stats";
import { JsonLd } from "@/components/JsonLd";
import { getSiteUrl } from "@/lib/site-url";
import { BRAND_TAGLINE_LINES } from "@/lib/constants";
import { contentLinkClass } from "@/lib/ui-surfaces";
import type { Metadata } from "next";
import { HOME_DESCRIPTION, pageMetadata } from "@/lib/site-metadata";
import { buildSiteJsonLd } from "@/lib/site-jsonld";
import { getServiceStatus } from "@/lib/service-status";

export const metadata: Metadata = pageMetadata({
  path: "/",
  description: HOME_DESCRIPTION,
});

/** Pause state is read per request (`connection` + in-memory breaker). */
export const instant = false;

export default async function Home() {
  await connection();
  const landingStats = await getLandingPublicStats();
  const paused = getServiceStatus().paused;
  const jsonLd = buildSiteJsonLd(getSiteUrl());

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
        {paused ? <ServiceBanner /> : null}
        <SearchForm variant="landing" paused={paused} />
        <p className="mt-5 text-center text-sm">
          <Link
            href="/quote"
            className={`${contentLinkClass} inline-flex min-h-11 items-center px-2`}
          >
            報價自查清單
          </Link>
        </p>
      </div>
      {landingStats ? (
        <div
          // Width comes from left/right. `w-full` plus `inset-x-4` overflows the viewport by 1rem.
          className="absolute inset-x-4 bottom-2 mx-auto min-w-0 max-w-[584px] sm:bottom-3"
        >
          <LandingStats stats={landingStats} />
        </div>
      ) : null}
    </main>
  );
}

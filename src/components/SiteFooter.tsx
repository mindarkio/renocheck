"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { APP_VERSION, FOOTER_DISCLAIMER } from "@/lib/constants";
import { QUOTE_PAGE_TITLE_ZH } from "@/lib/quote-selfcheck";
import { SITE_CONTACT_EMAIL } from "@/lib/site-metadata";

const FOOTER_PRIMARY_LINKS = [
  { href: "/guides", label: "裝修指南" },
  { href: "/how-it-works", label: "點樣運作" },
  { href: "/faq", label: "常見問題" },
  { href: "/quote", label: QUOTE_PAGE_TITLE_ZH },
  { href: "/about", label: "關於" },
] as const;

function isCurrentNav(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

const FOOTER_LEGAL_LINK = {
  href: "/legal/disclaimer",
  label: "免責聲明",
} as const;

const footerLinkClass =
  "inline-flex min-h-11 items-center justify-center rounded-md px-1 text-center text-xs text-primary-foreground/92 transition-colors hover:text-primary-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:px-0";

export function SiteFooter() {
  const pathname = usePathname();
  return (
    <footer className="mt-auto shrink-0 border-t border-white/15 bg-primary text-primary-foreground">
      <div className="mx-auto w-full max-w-[584px] px-4 py-4 sm:px-6 sm:py-5">
        <div
          className="mx-auto max-w-md rounded-lg bg-white/10 px-3.5 py-2.5 ring-1 ring-white/10 sm:px-4 sm:py-3"
        >
          <p
            className="text-pretty text-center text-xs leading-snug text-primary-foreground/90 sm:leading-normal"
          >
            {FOOTER_DISCLAIMER}
          </p>
        </div>

        <nav
          className="mt-3 border-t border-white/12 pt-3"
          aria-label="頁尾連結"
        >
          <ul className="flex flex-col items-center gap-1">
            <li className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-0">
              {FOOTER_PRIMARY_LINKS.map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  aria-current={isCurrentNav(pathname, href) ? "page" : undefined}
                  className={footerLinkClass}
                >
                  {label}
                </Link>
              ))}
            </li>
            <li>
              <Link
                href={FOOTER_LEGAL_LINK.href}
                aria-current={
                  isCurrentNav(pathname, FOOTER_LEGAL_LINK.href) ? "page" : undefined
                }
                className={footerLinkClass}
              >
                {FOOTER_LEGAL_LINK.label}
              </Link>
            </li>
          </ul>
        </nav>

        <p
          className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-0 text-xs text-primary-foreground/80"
        >
          <a
            href={`mailto:${SITE_CONTACT_EMAIL}`}
            className="text-primary-foreground/88 underline decoration-white/25 underline-offset-2 hover:text-primary-foreground"
          >
            {SITE_CONTACT_EMAIL}
          </a>
          <span className="text-primary-foreground/80" aria-hidden="true">
            ·
          </span>
          <span className="tabular-nums">v{APP_VERSION}</span>
        </p>
      </div>
    </footer>
  );
}

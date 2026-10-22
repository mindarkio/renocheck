"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BrandMenuMark } from "@/components/BrandMenuMark";
import {
  siteLayoutContainerClass,
  siteLayoutGutterClass,
} from "@/components/report-column";

const HOME_NAV = [
  { href: "/guides", label: "裝修指南" },
  { href: "/how-it-works", label: "點樣運作" },
  { href: "/faq", label: "常見問題" },
  { href: "/about", label: "關於" },
  { href: "/legal/disclaimer", label: "免責聲明" },
] as const;

const navLinkClass =
  "rounded-md hover:underline hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30";

const homeMenuLinkClass =
  "rounded-md text-white hover:text-white hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50";

const menuButtonClass = (menuOpen: boolean) =>
  `inline-flex min-h-11 min-w-11 items-center justify-center rounded-md transition-[color,transform,opacity] duration-200 ease-out active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 sm:hidden ${
    menuOpen
      ? "fixed right-4 top-3 z-[130] text-white focus-visible:ring-white/50"
      : "text-foreground/85 hover:text-foreground focus-visible:ring-primary/30"
  }`;

function useMobileNavMenu() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return { menuOpen, setMenuOpen, closeMenu: () => setMenuOpen(false) };
}

function MobileNavMenuPortal({
  open,
  menuId,
  onNavigate,
}: {
  open: boolean;
  menuId: string;
  onNavigate: () => void;
}) {
  if (!open) return null;

  return createPortal(
    <div
      id={menuId}
      role="dialog"
      aria-modal="true"
      aria-label="網站選單"
      className="fixed inset-0 z-[100] flex flex-col bg-primary/95 text-white backdrop-blur-md supports-[backdrop-filter]:bg-primary/85 sm:hidden"
    >
      <nav
        className="renocheck-menu-panel-in flex flex-1 flex-col items-center justify-center gap-1 px-6 pb-16"
      >
        {HOME_NAV.map(({ href, label }, index) => (
          <Link
            key={href}
            href={href}
            className={`renocheck-menu-link-in min-h-12 py-3 text-lg font-medium ${homeMenuLinkClass}`}
            style={{ animationDelay: `${60 + index * 40}ms` }}
            onClick={onNavigate}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>,
    document.body,
  );
}

function DesktopNavLinks() {
  return (
    <div className="hidden items-center gap-5 text-sm text-foreground/85 sm:flex">
      {HOME_NAV.map(({ href, label }) => (
        <Link key={href} href={href} className={navLinkClass}>
          {label}
        </Link>
      ))}
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const { menuOpen, setMenuOpen, closeMenu } = useMobileNavMenu();
  const menuId = "site-nav-menu";

  // Segment match only: /administrator or /admin-foo are public (404) paths and keep the header.
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;

  return (
    <>
      <header
        className={`relative shrink-0 ${
          menuOpen ? "z-[120] bg-transparent" : "z-[60] bg-background"
        }`}
      >
        <div className={siteLayoutGutterClass}>
          <nav
            className={`${siteLayoutContainerClass} flex items-center justify-between gap-4 py-3`}
            aria-label="頁首"
            data-testid="site-header-nav"
          >
          <Link
            href="/"
            className="shrink-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Image
              src="/logo/lockup-horizontal.svg"
              alt="Renocheck 裝修點評"
              width={280}
              height={48}
              className="h-6 w-auto sm:h-7 lg:h-8"
              priority
            />
          </Link>
          <div className="flex items-center gap-2">
            <DesktopNavLinks />
            <button
              type="button"
              className={menuButtonClass(menuOpen)}
              aria-expanded={menuOpen}
              aria-controls={menuId}
              aria-label={menuOpen ? "關閉選單" : "開啟選單"}
              onClick={() => setMenuOpen((open) => !open)}
            >
              <BrandMenuMark
                open={menuOpen}
                onPrimary={menuOpen}
                className="size-7"
              />
            </button>
          </div>
          </nav>
        </div>
      </header>
      <MobileNavMenuPortal
        open={menuOpen}
        menuId={menuId}
        onNavigate={closeMenu}
      />
    </>
  );
}

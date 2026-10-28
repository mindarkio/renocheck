"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";
import { BrandMenuMark } from "@/components/BrandMenuMark";
import {
  siteLayoutContainerClass,
  siteLayoutGutterClass,
} from "@/components/report-column";
import {
  focusOnPrimaryClass,
  focusRingClass,
  focusRingOnPrimaryClass,
} from "@/lib/focus-ring";
import { HEADER_UPLOAD_ZH } from "@/lib/quote-analysis/copy";
import { QUOTE_PAGE_TITLE_ZH } from "@/lib/quote-selfcheck";

const HOME_NAV = [
  { href: "/guides", label: "裝修指南" },
  { href: "/how-it-works", label: "點樣運作" },
  { href: "/faq", label: "常見問題" },
  { href: "/quote", label: QUOTE_PAGE_TITLE_ZH },
  { href: "/about", label: "關於" },
  { href: "/legal/disclaimer", label: "免責聲明" },
] as const;

type NavItem = { href: string; label: string; desktopClass?: string };

function buildNav(upload: boolean): NavItem[] {
  const items: NavItem[] = HOME_NAV.map((item) => ({ href: item.href, label: item.label }));
  if (!upload) return items;
  const quoteAt = items.findIndex((item) => item.href === "/quote");
  items.splice(quoteAt + 1, 0, {
    href: "/quote/upload",
    label: HEADER_UPLOAD_ZH,
    // Hidden below lg so the existing row does not overflow. The phone sheet still lists it.
    desktopClass: "hidden lg:inline-flex",
  });
  return items;
}

function currentHref(pathname: string, hrefs: readonly string[]): string | null {
  const matches = hrefs.filter(
    (href) => pathname === href || pathname.startsWith(`${href}/`),
  );
  matches.sort((a, b) => b.length - a.length);
  return matches[0] ?? null;
}

function useQuoteUploadNav(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (typeof fetch !== "function") return;
    let cancelled = false;
    fetch("/api/quote/availability")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { enabled?: boolean } | null) => {
        if (!cancelled && data?.enabled === true) setEnabled(true);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return enabled;
}

/** Solid navy on the page. See `focusRingClass`. */
const headerFocusRingClass = focusRingClass;

const navLinkClass = `rounded-md hover:underline hover:text-foreground ${headerFocusRingClass}`;

/** Solid white on the navy sheet. A navy ring on `bg-primary/85` is about 1.4:1. */
const menuFocusRingClass = focusRingOnPrimaryClass;

const homeMenuLinkClass = `rounded-md text-white hover:text-white hover:underline ${menuFocusRingClass}`;

const MENU_ID = "site-nav-menu";

const menuButtonClass = (menuOpen: boolean) =>
  `inline-flex min-h-11 min-w-11 items-center justify-center rounded-md transition-[color,transform,opacity] duration-200 ease-out active:scale-95 motion-reduce:transition-none motion-reduce:active:scale-100 sm:hidden ${
    menuOpen
      ? `fixed right-4 top-3 z-[130] text-white ${menuFocusRingClass}`
      : `text-foreground/85 hover:text-foreground ${headerFocusRingClass}`
  }`;

function menuFocusables(button: HTMLButtonElement | null): HTMLElement[] {
  const dialog = document.getElementById(MENU_ID);
  const links = dialog ? [...dialog.querySelectorAll<HTMLElement>("a[href]")] : [];
  return button ? [button, ...links] : links;
}

/** Tailwind `sm` (40rem). At or above it the sheet and its button are `display: none`. */
const DESKTOP_MEDIA = "(min-width: 40rem)";

/** Body children that must stay reachable while the sheet is open. */
function keepInteractive(el: Element, dialog: Element | null, button: Element | null): boolean {
  return (
    el === dialog ||
    (button !== null && el.contains(button)) ||
    el.tagName === "SCRIPT" ||
    el.tagName === "NEXT-ROUTE-ANNOUNCER"
  );
}

function useMobileNavMenu(
  buttonRef: RefObject<HTMLButtonElement | null>,
  pathname: string,
) {
  const [menuOpen, setMenuOpen] = useState(false);
  const wasOpen = useRef(false);
  const [menuPath, setMenuPath] = useState(pathname);

  // Back/forward (or any route change not made from the sheet) closes it and releases the lock.
  if (menuPath !== pathname) {
    setMenuPath(pathname);
    if (menuOpen) setMenuOpen(false);
  }

  useLayoutEffect(() => {
    // Move focus only after an open or a close. The first paint must not steal focus.
    if (menuOpen || wasOpen.current) buttonRef.current?.focus();
    wasOpen.current = menuOpen;
  }, [menuOpen, buttonRef]);

  useEffect(() => {
    if (!menuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenuOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const focusables = menuFocusables(buttonRef.current);
      if (focusables.length === 0) return;
      const current = document.activeElement;
      const index = focusables.findIndex(
        (el) => el === current || (current instanceof Node && el.contains(current)),
      );
      event.preventDefault();
      const nextIndex = event.shiftKey
        ? index <= 0
          ? focusables.length - 1
          : index - 1
        : index < 0 || index >= focusables.length - 1
          ? 0
          : index + 1;
      focusables[nextIndex]?.focus();
    };
    const onFocusIn = (event: FocusEvent) => {
      const focusables = menuFocusables(buttonRef.current);
      if (focusables.length === 0) return;
      const target = event.target;
      if (target instanceof Node && focusables.some((el) => el === target || el.contains(target))) {
        return;
      }
      focusables[0]?.focus();
    };
    // The sheet is display:none from `sm` up. Close it so Tab, scroll and the logo are not stuck.
    const desktop = typeof window.matchMedia === "function" ? window.matchMedia(DESKTOP_MEDIA) : null;
    const onDesktop = () => {
      if (desktop?.matches) setMenuOpen(false);
    };
    // Screen-reader swipe ignores Tab traps: hide the page behind the sheet from AT and focus.
    const dialog = document.getElementById(MENU_ID);
    const inerted = [...document.body.children].filter(
      (el): el is HTMLElement =>
        el instanceof HTMLElement &&
        !el.hasAttribute("inert") &&
        !keepInteractive(el, dialog, buttonRef.current),
    );
    for (const el of inerted) el.setAttribute("inert", "");
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("focusin", onFocusIn);
    desktop?.addEventListener("change", onDesktop);
    return () => {
      document.body.style.overflow = prevOverflow;
      for (const el of inerted) el.removeAttribute("inert");
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("focusin", onFocusIn);
      desktop?.removeEventListener("change", onDesktop);
    };
  }, [menuOpen, buttonRef]);

  return { menuOpen, setMenuOpen, closeMenu: () => setMenuOpen(false) };
}

function MobileNavMenuPortal({
  open,
  menuId,
  items,
  onNavigate,
}: {
  open: boolean;
  menuId: string;
  items: readonly NavItem[];
  onNavigate: () => void;
}) {
  const pathname = usePathname();
  if (!open) return null;
  const current = currentHref(pathname, items.map((item) => item.href));

  return createPortal(
    <div
      id={menuId}
      role="dialog"
      aria-label="網站選單"
      className={`fixed inset-0 z-[100] flex flex-col bg-primary/95 text-white backdrop-blur-md supports-[backdrop-filter]:bg-primary/85 sm:hidden ${focusOnPrimaryClass}`}
    >
      <nav
        className="renocheck-menu-panel-in flex flex-1 flex-col items-center justify-center gap-1 px-6 pb-16"
      >
        {items.map(({ href, label }, index) => (
          <Link
            key={href}
            href={href}
            aria-current={current === href ? "page" : undefined}
            className={`renocheck-menu-link-in min-h-12 whitespace-nowrap py-3 text-lg font-medium ${homeMenuLinkClass}`}
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

function DesktopNavLinks({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();
  const current = currentHref(pathname, items.map((item) => item.href));
  return (
    <div className="hidden flex-nowrap items-center gap-5 text-sm text-foreground/85 sm:flex">
      {items.map(({ href, label, desktopClass }) => (
        <Link
          key={href}
          href={href}
          aria-current={current === href ? "page" : undefined}
          className={`${desktopClass ?? "inline-flex"} min-h-11 shrink-0 items-center whitespace-nowrap ${navLinkClass}`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const { menuOpen, setMenuOpen, closeMenu } = useMobileNavMenu(menuButtonRef, pathname);
  const navItems = buildNav(useQuoteUploadNav());

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
            data-testid="site-header-logo"
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-md ${headerFocusRingClass} ${
              menuOpen ? "invisible" : ""
            }`}
          >
            <Image
              src="/logo/mark-color-transparent.svg"
              alt=""
              width={114}
              height={123}
              className="h-6 w-auto sm:h-7 lg:h-8"
              priority
            />
            <span
              data-testid="site-header-wordmark"
              className="text-sm font-semibold leading-none text-primary lg:text-base"
            >
              裝修點評
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <DesktopNavLinks items={navItems} />
            <button
              ref={menuButtonRef}
              type="button"
              className={menuButtonClass(menuOpen)}
              aria-expanded={menuOpen}
              aria-controls={MENU_ID}
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
        menuId={MENU_ID}
        items={navItems}
        onNavigate={closeMenu}
      />
    </>
  );
}

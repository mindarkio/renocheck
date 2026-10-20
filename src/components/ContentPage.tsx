import Link from "next/link";
import type { ReactNode } from "react";
import {
  brandPageTitleClass,
  brandSectionTitleClass,
  contentLinkClass,
  surfaceCardClass,
} from "@/lib/ui-surfaces";

const pageShellClass =
  "flex min-h-0 flex-1 flex-col overflow-x-hidden px-4 pb-12 pt-5 sm:px-6 sm:pb-16 sm:pt-7";

const pageInnerClass = "mx-auto w-full max-w-[584px]";

export function ContentPage({ children }: { children: ReactNode }) {
  return (
    <main className={pageShellClass}>
      <div className={pageInnerClass}>{children}</div>
    </main>
  );
}

export function ContentCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <article
      className={`${surfaceCardClass} px-5 py-6 sm:px-6 sm:py-7 ${className}`}
    >
      {children}
    </article>
  );
}

export function ContentPageTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className={brandPageTitleClass}>
      {children}
    </h1>
  );
}

export function ContentPageLead({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={`mt-2 text-sm text-muted-foreground ${className}`.trim()}
    >
      {children}
    </p>
  );
}

export function ContentSections({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mt-6 space-y-6 text-sm leading-[1.7] text-muted-foreground [&_a]:text-primary [&_a]:underline-offset-2 [&_a]:hover:underline [&_strong]:font-medium [&_strong]:text-foreground ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function ContentSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className={brandSectionTitleClass}>{title}</h2>
      <div
        className="space-y-2 text-sm leading-[1.7] text-muted-foreground [&_a]:text-primary [&_a]:underline-offset-2 [&_a]:hover:underline [&_strong]:font-medium [&_strong]:text-foreground"
      >
        {children}
      </div>
    </section>
  );
}

export function ContentPageNav({
  links,
}: {
  links: readonly { href: string; label: string }[];
}) {
  return (
    <nav
      className="mt-8 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-border/60 pt-6 text-sm text-muted-foreground"
      aria-label="相關頁面"
    >
      {links.map(({ href, label }, index) => (
        <span key={href} className="inline-flex items-center gap-3">
          {index > 0 ? (
            <span className="text-border" aria-hidden>·</span>
          ) : null}
          <Link href={href} className={contentLinkClass}>
            {label}
          </Link>
        </span>
      ))}
    </nav>
  );
}

/** Same horizontal rhythm as report / content pages (e.g. landing). */
export const marketingPageShellClass = pageShellClass;
export const marketingPageInnerClass = pageInnerClass;

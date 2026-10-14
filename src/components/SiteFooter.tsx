import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border bg-muted/50">
      <div className="mx-auto max-w-3xl px-4 py-6 text-center text-xs leading-relaxed text-muted-foreground">
        <p>本工具整理公開資料摘要，不構成法律、投資或專業意見。</p>
        <p className="mt-2">
          <Link href="/legal/disclaimer" className="underline hover:text-foreground">
            免責聲明與資料來源
          </Link>
          {" · "}
          <a
            href="mailto:hello@renocheck.homes"
            className="underline hover:text-foreground"
          >
            hello@renocheck.homes
          </a>
        </p>
      </div>
    </footer>
  );
}

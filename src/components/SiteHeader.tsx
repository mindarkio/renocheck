import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex h-14 max-w-3xl items-center px-4">
        <Link
          href="/"
          className="flex items-center rounded-md hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Image
            src="/logo/lockup-horizontal.svg"
            alt="Renocheck 裝修點評"
            width={200}
            height={91}
            className="h-8 w-auto max-w-[min(220px,70vw)]"
            priority
          />
        </Link>
      </div>
    </header>
  );
}

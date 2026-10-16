import Link from "next/link";

export function GuideDisclaimer() {
  return (
    <p className="mt-6 rounded-lg bg-muted/50 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      本文只供一般參考，<strong className="text-foreground">並不構成法律意見</strong>
      ；法例、程序及收費以相關政府部門及機構最新公布為準。如涉及具體糾紛，請諮詢律師或相關機構。詳見
      <Link href="/legal/disclaimer" className="ml-1 text-primary underline-offset-2 hover:underline">
        免責聲明
      </Link>
      。
    </p>
  );
}

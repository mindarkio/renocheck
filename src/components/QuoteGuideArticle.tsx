import Link from "next/link";
import { focusRingClass } from "@/lib/focus-ring";
import {
  QUOTE_CHECK_ITEMS,
  QUOTE_GUIDE_CTA_ZH,
  QUOTE_GUIDE_FAQS,
  QUOTE_GUIDE_POINTS,
} from "@/lib/quote-selfcheck";

const ctaClass = `inline-flex min-h-11 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground ${focusRingClass}`;

export function QuoteGuideArticle() {
  return (
    <>
      <p className="mt-6">
        <Link href="/quote/upload" className={ctaClass}>
          {QUOTE_GUIDE_CTA_ZH}
        </Link>
      </p>
      <ol className="mt-8 space-y-6">
        {QUOTE_CHECK_ITEMS.map((item, index) => (
          <li key={item.id}>
            <h2 className="text-base font-semibold text-foreground">
              {index + 1}. {item.label}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              {QUOTE_GUIDE_POINTS[item.id]}
            </p>
          </li>
        ))}
      </ol>
      <section className="mt-10 border-t border-border/60 pt-6" aria-labelledby="quote-guide-faq">
        <h2 id="quote-guide-faq" className="text-base font-semibold text-foreground">
          常見問題
        </h2>
        <dl className="mt-4 space-y-5">
          {QUOTE_GUIDE_FAQS.map((item) => (
            <div key={item.question}>
              <dt className="text-sm font-medium text-foreground">{item.question}</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.answer}</dd>
            </div>
          ))}
        </dl>
      </section>
      <p className="mt-8">
        <Link href="/quote/upload" className={ctaClass}>
          {QUOTE_GUIDE_CTA_ZH}
        </Link>
      </p>
    </>
  );
}

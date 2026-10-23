import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ContentCard,
  ContentPage,
  ContentPageNav,
  ContentPageTitle,
  ContentSection,
  ContentSections,
} from "@/components/ContentPage";
import { GuideDisclaimer } from "@/components/GuideDisclaimer";
import { JsonLd } from "@/components/JsonLd";
import { breadcrumbJsonLd } from "@/lib/breadcrumb-jsonld";
import { GUIDES, getGuide, guideFaqJsonLd } from "@/lib/guides";
import { OG_IMAGE, pageMetadata } from "@/lib/site-metadata";
import { getSiteUrl } from "@/lib/site-url";

type PageProps = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return GUIDES.map((g) => ({ slug: g.slug }));
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) return {};
  const meta = pageMetadata({
    path: `/guides/${guide.slug}`,
    title: guide.title,
    description: guide.description,
  });
  return {
    ...meta,
    openGraph: {
      ...meta.openGraph,
      type: "article",
      publishedTime: guide.datePublished,
      modifiedTime: guide.dateModified,
    },
  };
}

const INLINE_LINK = /\[([^\]]+)\]\((\/(?!\/)[^)\s]*)\)/g;

function GuideRichText({ text }: { text: string }) {
  const nodes: ReactNode[] = [];
  const re = new RegExp(INLINE_LINK.source, "g");
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    const href = match[2] ?? "/";
    nodes.push(
      <Link key={`${match.index}-${href}`} href={href}>
        {match[1]}
      </Link>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  if (nodes.length === 0) return text;
  return <>{nodes}</>;
}

const NAV_LINKS = [
  { href: "/guides", label: "全部指南" },
  { href: "/how-it-works", label: "點樣運作" },
  { href: "/faq", label: "常見問題" },
] as const;

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params;
  const guide = getGuide(slug);
  if (!guide) notFound();

  const base = getSiteUrl();
  const url = `${base}/guides/${guide.slug}`;
  const related = GUIDES.filter((g) => g.slug !== guide.slug).slice(0, 3);
  const faqLd = guideFaqJsonLd(guide);
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        headline: guide.title,
        description: guide.description,
        inLanguage: "zh-HK",
        url,
        mainEntityOfPage: url,
        datePublished: guide.datePublished,
        dateModified: guide.dateModified,
        image: `${base}${OG_IMAGE.url}`,
        author: { "@type": "Organization", name: "Renocheck", url: `${base}/` },
        publisher: {
          "@type": "Organization",
          name: "Renocheck",
          url: `${base}/`,
          logo: { "@type": "ImageObject", url: `${base}/logo/mark-color-on-white.png` },
        },
        citation: guide.sources.map((s) => s.url),
      },
      ...(faqLd ? [faqLd] : []),
      breadcrumbJsonLd([
        { name: "首頁", path: "/" },
        { name: "業主裝修指南", path: "/guides" },
        { name: guide.title, path: `/guides/${guide.slug}` },
      ]),
    ],
  };

  return (
    <ContentPage>
      <JsonLd data={jsonLd} />
      <ContentCard>
        <nav aria-label="麵包屑" className="mb-3 text-xs text-muted-foreground">
          <Link href="/" className="hover:underline">首頁</Link>
          <span aria-hidden> › </span>
          <Link href="/guides" className="hover:underline">業主裝修指南</Link>
        </nav>
        <ContentPageTitle>{guide.title}</ContentPageTitle>
        <p className="mt-2 text-xs text-muted-foreground">
          更新日期：<time dateTime={guide.dateModified}>{guide.dateModified}</time>
        </p>
        <ContentSections>
          <p className="text-foreground">
            <GuideRichText text={guide.answer} />
          </p>
          {guide.sections.map((section) => (
            <ContentSection key={section.heading} title={section.heading}>
              {section.paragraphs?.map((p) => (
                <p key={p}>
                  <GuideRichText text={p} />
                </p>
              ))}
              {section.bullets ? (
                <ul className="list-disc space-y-1 pl-5">
                  {section.bullets.map((b) => (
                    <li key={b}>
                      <GuideRichText text={b} />
                    </li>
                  ))}
                </ul>
              ) : null}
            </ContentSection>
          ))}
          {guide.faqs?.length ? (
            <ContentSection title="常見問題">
              <dl className="space-y-3">
                {guide.faqs.map((item) => (
                  <div key={item.question}>
                    <dt className="font-medium text-foreground">{item.question}</dt>
                    <dd className="mt-1">{item.answer}</dd>
                  </div>
                ))}
              </dl>
            </ContentSection>
          ) : null}
          <ContentSection title="委聘前查一查">
            <p>
              想知心水裝修公司有冇公開討論或名冊紀錄？可以喺
              <Link href="/">Renocheck 首頁</Link>
              輸入公司名稱、電話或商業登記號碼，查閱公開資料風險參考；了解資料來源見
              <Link href="/how-it-works">點樣運作</Link>。
            </p>
          </ContentSection>
          <ContentSection title="資料來源">
            <ul className="list-disc space-y-1 pl-5">
              {guide.sources.map((s) => (
                <li key={s.url}>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="break-words"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </ContentSection>
          <ContentSection title="相關指南">
            <ul className="list-disc space-y-1 pl-5">
              {related.map((g) => (
                <li key={g.slug}>
                  <Link href={`/guides/${g.slug}`}>{g.title}</Link>
                </li>
              ))}
            </ul>
          </ContentSection>
        </ContentSections>
        <GuideDisclaimer />
        <ContentPageNav links={NAV_LINKS} />
      </ContentCard>
    </ContentPage>
  );
}

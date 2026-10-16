import type { Metadata } from "next";
import Link from "next/link";
import { pageMetadata } from "@/lib/site-metadata";
import {
  ContentCard,
  ContentPage,
  ContentPageNav,
  ContentPageTitle,
  ContentSections,
} from "@/components/ContentPage";
import { SITE_CONTACT_EMAIL } from "@/lib/site-metadata";

export const metadata: Metadata = pageMetadata({
  path: "/about",
  title: "關於我們",
  description:
    "Renocheck 裝修點評的使命：為香港業主提供裝修承辦商公開資料風險參考，非政府機構、非信貸報告。",
});

const NAV_LINKS = [
  { href: "/guides", label: "裝修指南" },
  { href: "/how-it-works", label: "點樣運作" },
  { href: "/faq", label: "常見問題" },
  { href: "/legal/disclaimer", label: "免責聲明" },
] as const;

export default function AboutPage() {
  return (
    <ContentPage>
      <ContentCard>
        <ContentPageTitle>關於 Renocheck</ContentPageTitle>
        <ContentSections className="space-y-4">
          <p>
            <strong>Renocheck（裝修點評）</strong>站在業主防禦角度，協助你在委聘裝修承辦商前，快速查閱
            <strong>公開可得</strong>的資料摘要與風險參考分檔。
          </p>
          <p>
            我們<strong>不是</strong>政府部門、<strong>不是</strong>裝修配對或廣告平台，亦
            <strong>不提供</strong>信貸評分或 TransUnion 類產品。我們<strong>不</strong>
            對任何公司作出「黑店」等定性指控；報告為算法與公開來源整理，請你自行核實合約與牌照。
          </p>
          <h2 className="text-sm font-semibold text-primary">誰營運本網站</h2>
          <p>
            本網站由 <strong>Renocheck</strong> 營運，與任何裝修公司、政府部門或信貸資料機構均無從屬關係，亦不向裝修公司收取刊登或排名費用。
          </p>
          <h2 className="text-sm font-semibold text-primary">資料點嚟</h2>
          <p>
            報告整合屋宇署小型工程承建商名冊等官方公開資料，以及可檢索的公開網上討論摘要；方法詳見
            <Link href="/how-it-works" className="mx-1">點樣運作</Link>
            。我們亦整理咗
            <Link href="/guides" className="mx-1">業主裝修指南</Link>
            ，內容引用官方來源。
          </p>
          <p>
            聯絡：
            <a href={`mailto:${SITE_CONTACT_EMAIL}`} className="ml-1">
              {SITE_CONTACT_EMAIL}
            </a>
          </p>
        </ContentSections>
        <ContentPageNav links={NAV_LINKS} />
      </ContentCard>
    </ContentPage>
  );
}

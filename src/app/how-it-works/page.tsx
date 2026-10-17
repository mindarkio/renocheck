import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site-metadata";
import {
  ContentCard,
  ContentPage,
  ContentPageNav,
  ContentPageTitle,
  ContentSections,
  ContentSection,
} from "@/components/ContentPage";

export const metadata: Metadata = pageMetadata({
  path: "/how-it-works",
  title: "點樣運作",
  description:
    "Renocheck 如何整合 MWC 名冊與公開網上討論摘要，產生裝修風險參考報告（含 7 日快取說明）。",
});

const NAV_LINKS = [
  { href: "/faq", label: "常見問題" },
  { href: "/legal/disclaimer", label: "免責聲明與資料來源" },
] as const;

export default function HowItWorksPage() {
  return (
    <ContentPage>
      <ContentCard>
        <ContentPageTitle>點樣運作</ContentPageTitle>
        <ContentSections>
          <ContentSection title="1. 你輸入查詢">
            <p>
              公司名稱、香港電話或商業登記號碼（至少一項）。系統會標示「本次查證範圍」（你的查詢、搜尋用名稱、公開搜尋對照結果等）。
            </p>
          </ContentSection>
          <ContentSection title="2. 公開資料來源">
            <p>
              並行檢索屋宇署<strong>小型工程承辦商註冊制度（MWC）</strong>相關公開名冊；在功能開啟時，查詢營運方<strong>已匯入</strong>的<strong>公開判詞紀錄</strong>（聆訊要點與刊憲連結，不經 AI 改寫）；以及合規搜尋服務取得的
              <strong>公開網頁摘要</strong>（標題與 snippet）。未收錄的私人通訊、未匯入的官司或已刪除內容可能不在範圍內。
            </p>
          </ContentSection>
          <ContentSection title="3. 對照與風險參考分檔">
            <p>
              系統嘗試將搜尋結果與本次查證名稱對照，並在範圍內整理與裝修糾紛或讚揚相關的公開討論摘要。判詞紀錄以程式規則影響分檔下限（按案件類型與角色），與討論摘要分開。你會看到風險參考分檔（例如風險偏高、風險中等、中性、未見負面摘要）及置信度說明——
              <strong>不是</strong>工程品質保證或信貸評分。
            </p>
          </ContentSection>
          <ContentSection title="4. 快取（約 7 日）">
            <p>
              相同查詢在約 7 日內可能直接顯示已生成的報告快照，以節省資源；公開討論可能有新帖而未反映。報告會標示生成時間；需要時請隔日再查或留意免責說明。
            </p>
          </ContentSection>
        </ContentSections>
        <ContentPageNav links={NAV_LINKS} />
      </ContentCard>
    </ContentPage>
  );
}

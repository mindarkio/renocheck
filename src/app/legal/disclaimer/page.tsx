import type { Metadata } from "next";
import { pageMetadata } from "@/lib/site-metadata";
import {
  ContentCard,
  ContentPage,
  ContentPageLead,
  ContentPageNav,
  ContentPageTitle,
  ContentSections,
  ContentSection,
} from "@/components/ContentPage";
import { DISCLAIMER_VERSION } from "@/lib/constants";
export const metadata: Metadata = pageMetadata({
  path: "/legal/disclaimer",
  title: "免責聲明與資料來源",
  description:
    "Renocheck 免責聲明、風險參考分檔說明、非信貸報告聲明及個人資料（私隱）摘要。",
});

const NAV_LINKS = [{ href: "/", label: "返回搜尋" }] as const;

export default function DisclaimerPage() {
  return (
    <ContentPage>
      <ContentCard>
        <ContentPageTitle>免責聲明、資料來源與個人資料</ContentPageTitle>
        <ContentPageLead>版本 {DISCLAIMER_VERSION}</ContentPageLead>

        <ContentSections>
          <ContentSection title="一、服務性質">
            <p>
              Renocheck（「本服務」）整理<strong>公開可得</strong>的資料（包括政府開放數據及公開網上討論之
              <strong>摘要</strong>），並以程式產生<strong>風險參考分檔</strong>，供業主在委聘裝修承辦商前自行參考。
            </p>
            <p>
              本服務<strong>不</strong>對任何公司、商號或個人作出「黑店」「騙子」等定性指控。報告內容為公開資料摘要與系統化整理，
              <strong>不是</strong>事實查證、調查報告或法庭可採納的證明。
            </p>
          </ContentSection>

          <ContentSection title="二、風險參考分檔">
            <p>報告可能顯示下列分檔（含義以當次「本次查證範圍」及系統規則為準）：</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>風險偏高</strong>：在本次查證範圍內，檢出較多或較嚴重與裝修糾紛、投訴或相關風險有關的公開討論摘要。
              </li>
              <li>
                <strong>風險中等</strong>：在本次查證範圍內，檢出一些相關公開討論摘要，但未達「風險偏高」的規則。
              </li>
              <li>
                <strong>中性</strong>：在本次查證範圍內，未能依規則得出正面或負面的口碑結論。若公開搜尋結果未能與本次查證對象名稱對照，分檔應為中性，並不表示「已核實無問題」。
              </li>
              <li>
                <strong>未見負面摘要</strong>：僅在本次查證範圍內，檢出與讚揚或正面評價相關的公開討論摘要，且未檢出與糾紛相關的摘要。
                <strong>並不構成</strong>工程品質、履約能力或誠信的保證，亦<strong>不構成</strong>對任何承辦商的推薦、背書或邀請聘用。
              </li>
            </ul>
            <p>
              「置信度」（較低／中等／較高）反映資料多寡與對照是否清晰，不是法律或專業上的準確度保證。
            </p>
            <p>
              若報告顯示<strong>公開判詞紀錄</strong>，風險參考分檔可能因<strong>已匯入</strong>的司法程序類別與訴訟角色（例如工程合約相關民事、小額錢債等）而調整下限；此與公開討論摘要分開處理，並<strong>不</strong>表示法庭已對商號作出「黑店」等定性。即使公開討論摘要為「中性」，仍可能因對照到的判詞紀錄而顯示「風險中等」等分檔。
            </p>
          </ContentSection>

          <ContentSection title="三、非信貸報告">
            <p>
              本服務及其報告<strong>不是</strong>信貸報告、信用評分或《信貸資料業務規則》下的信貸資料；
              <strong>不是</strong>任何信用評級機構（包括 TransUnion 等）的產品或代理服務。報告中的「風險」僅指裝修委聘情境下的公開資料風險參考，與金融信貸無關。
            </p>
          </ContentSection>

          <ContentSection title="四、查證範圍與限制">
            <p>
              未收錄的網站、私人通訊、已刪除內容等可能不在範圍內。公開討論可能不完整、不準確或與查詢對象無關；系統會嘗試對照名稱，但無法保證每則摘要均指向同一商號或個人。資料不足時請自行核實牌照、合約及工程細節。
            </p>
            <p>
              <strong>公開判詞紀錄</strong>僅涵蓋營運方<strong>已匯入</strong>、並與裝修委聘情境相關且能與本次查證對象對照之案件要點；報告列出聆訊要點及官方／刊憲連結，<strong>不</strong>載入判詞全文。若顯示「未見與查證對象對照之紀錄」，只表示在<strong>本次匯入批次</strong>內未匹配，<strong>不</strong>表示該方從未涉及司法程序，亦<strong>不</strong>表示「無官司」。
            </p>
          </ContentSection>

          <ContentSection title="五、不構成專業意見">
            <p>
              報告不構成法律、工程、財務或投資意見。在簽約、付款或委聘前，請自行尋求適當專業意見並核實官方紀錄。
            </p>
          </ContentSection>

          <ContentSection title="六、資料來源">
            <p>
              可包括屋宇署小型工程承辦商註冊制度（MWC）相關公開名冊；營運方匯入的<strong>司法刊憲／法律參考</strong>判詞要點（連結至司法機構或公開法律索引，見產品內「判詞庫摘錄截至」時間）；以及透過合規搜尋服務取得的公開網頁標題及摘要（以當次報告列示的連結為準）。第三方網站內容由該第三方負責；使用時請遵守相關服務條款及適用法律（司法判詞下載條款可能限制商業用途，產品以要點摘要及連結為主）。
            </p>
          </ContentSection>

          <ContentSection title="七、個人資料（私隱）">
            <p>
              香港《個人資料（私隱）條例》（「私隱條例」）規管我們如何收集、使用及保存可識別個人的資料。以下說明
              <strong>本服務的實際做法</strong>（若你唔係資料當事人，可略讀第三段聯絡方式即可）：
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>我們會處理咩？</strong>你輸入的查詢（例如公司名稱、電話、商業登記號碼）、為產生報告而取得的公開網頁摘要，以及技術上需要的查詢識別碼（經雜湊處理的 fingerprint，用於快取及統計）。
              </li>
              <li>
                <strong>用途</strong>：提供風險參考報告、改善檢索與系統安全、遵守法律義務。
              </li>
              <li>
                <strong>保存多久？</strong>完整報告快取約<strong> 7 日</strong>後過期（見產品設定）；過期後系統不再依該快取向你顯示舊報告。搜尋事件記錄（是否快取命中、時間）用於運維統計。
              </li>
              <li>
                <strong>會唔會俾第三方？</strong>搜尋、托管、資料庫及 AI 摘要可能使用境外服務供應商（例如雲端及搜尋 API）；我們只傳送產生報告所需的最少資料。
              </li>
              <li>
                <strong>你的權利</strong>：你可要求查閱或更正你向我們提供的查詢資料。請電郵至{" "}
                <a href="mailto:hello@renocheck.homes">hello@renocheck.homes</a> 提出。
              </li>
            </ul>
            <p className="text-xs">
              我們<strong>沒有</strong>設立「資料保護主任（DPO）」的法定義務，除非營運架構觸發私隱條例相關要求；上述聯絡渠道即一般查詢及更正途徑。
            </p>
          </ContentSection>

          <ContentSection title="八、責任限制">
            <p>
              在法律允許的最大範圍內，營運者（無論以公司或其他形式營運）對因使用或無法使用本服務、或依賴報告內容而產生的任何直接、間接或相應損失不承擔責任。本條不旨在排除依法不能排除的責任（包括適用於消費者交易的法定權利）。
            </p>
          </ContentSection>

          <ContentSection title="九、版本更新">
            <p>
              我們可能更新本聲明及算法規則。報告上的免責版本號標示你當時適用的版本。你亦可隨時閱讀本頁最新文本。
            </p>
          </ContentSection>
        </ContentSections>

        <ContentPageNav links={NAV_LINKS} />
      </ContentCard>
    </ContentPage>
  );
}

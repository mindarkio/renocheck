import { SearchForm } from "@/components/SearchForm";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 py-10 sm:py-14">
      <section className="space-y-3 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          裝修風險情報搜尋
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          輸入公司名稱、香港電話或商業登記號碼，查閱公開資料摘要與風險參考（A–F）。
          並非法律意見或配對服務。
        </p>
      </section>
      <div className="mt-8">
        <SearchForm />
      </div>
    </main>
  );
}

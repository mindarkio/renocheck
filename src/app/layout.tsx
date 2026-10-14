import type { Metadata } from "next";
import { Noto_Sans_TC } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import "./globals.css";

const notoSansTc = Noto_Sans_TC({
  // next/font only exposes `latin` in types; Noto Sans TC still serves Traditional Chinese glyphs.
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Renocheck — 裝修風險情報搜尋",
  description:
    "聚合官方牌照與公開討論摘要，提供裝修相關風險參考。資料來自公開來源，並非法律意見或信貸報告。",
  icons: {
    icon: [
      { url: "/logo/favicon-16.svg", sizes: "16x16", type: "image/svg+xml" },
      { url: "/logo/favicon-32.svg", sizes: "32x32", type: "image/svg+xml" },
    ],
    apple: [
      {
        url: "/logo/mark-color-on-white.svg",
        type: "image/svg+xml",
      },
    ],
    shortcut: "/logo/favicon-32.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-HK" className={notoSansTc.variable}>
      <body className="min-h-screen flex flex-col antialiased">
        <SiteHeader />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}

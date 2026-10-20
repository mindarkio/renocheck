import type { Viewport } from "next";
import { Noto_Sans_TC } from "next/font/google";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { buildRootMetadata } from "@/lib/site-metadata";
import "./globals.css";

const notoSansTc = Noto_Sans_TC({
  // next/font only exposes `latin` in types; Noto Sans TC still serves Traditional Chinese glyphs.
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  themeColor: "#2f5d8a",
};

export const metadata = {
  ...buildRootMetadata(),
  icons: {
    icon: [
      { url: "/logo/favicon-16.svg", sizes: "16x16", type: "image/svg+xml" },
      { url: "/logo/favicon-32.svg", sizes: "32x32", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-HK" className={notoSansTc.variable}>
      <body className="flex min-h-screen flex-col overflow-x-hidden antialiased">
        <SiteHeader />
        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}

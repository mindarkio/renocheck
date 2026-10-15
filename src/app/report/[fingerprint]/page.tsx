export const instant = false;

import type { Metadata } from "next";
import { ReportView } from "@/components/ReportView";

type PageProps = {
  params: Promise<{ fingerprint: string }>;
};

export const metadata: Metadata = {
  title: "風險參考報告",
  robots: { index: false, follow: false },
};

export default async function ReportPage({ params }: PageProps) {
  const { fingerprint } = await params;
  return <ReportView key={fingerprint} fingerprint={fingerprint} />;
}

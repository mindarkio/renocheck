export const instant = false;

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/ReportView";
import { isFeedbackEnabled } from "@/lib/feedback/config";

/** buildSearchFingerprint → sha256 hex sliced to 32 chars. */
const FINGERPRINT_RE = /^[0-9a-f]{32}$/;

type PageProps = {
  params: Promise<{ fingerprint: string }>;
};

export const metadata: Metadata = {
  title: "風險參考報告",
  robots: { index: false, follow: false },
};

export default async function ReportPage({ params }: PageProps) {
  const { fingerprint } = await params;
  if (!FINGERPRINT_RE.test(fingerprint)) notFound();
  return (
    <ReportView
      key={fingerprint}
      fingerprint={fingerprint}
      feedbackEnabled={isFeedbackEnabled()}
    />
  );
}

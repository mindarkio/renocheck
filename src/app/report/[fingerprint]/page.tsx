export const instant = false;

import { ReportView } from "@/components/ReportView";

type PageProps = {
  params: Promise<{ fingerprint: string }>;
};

export default async function ReportPage({ params }: PageProps) {
  const { fingerprint } = await params;
  return <ReportView key={fingerprint} fingerprint={fingerprint} />;
}

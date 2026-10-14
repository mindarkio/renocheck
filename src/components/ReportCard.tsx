import Link from "next/link";
import type { RiskReport } from "@/lib/report-schema";

/** Fixed pattern for SSR/client match (avoids locale hydration drift). */
function formatGeneratedAtZhHk(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} (UTC)`;
}

function matchTypeLabel(matchType: RiskReport["entity"]["matchType"]): string {
  if (matchType === "phone") return "電話";
  if (matchType === "br") return "商業登記號碼";
  return "公司名稱";
}

function nameAlignmentHint(
  alignment: RiskReport["entity"]["nameAlignment"],
  matchType: RiskReport["entity"]["matchType"],
): string | null {
  if (alignment === "ambiguous") {
    return "名冊有多間近似名稱，請以牌照編號或電話再查並自行核實。";
  }
  if (alignment === "mwc_authoritative") {
    return "公開討論搜尋以名冊登記名稱為準；若與你輸入的公司名不同，請確認是否同一商號。";
  }
  if (alignment === "match" && matchType === "phone") {
    return "已以名冊登記名稱搜尋公開討論。";
  }
  if (alignment === "user_only") {
    return "名冊未匹配；搜尋以你輸入的字串為準。";
  }
  return null;
}

function confidenceLabelZh(confidence: RiskReport["confidence"]): string {
  if (confidence === "high") return "較高";
  if (confidence === "medium") return "中等";
  return "較低";
}

function dataSaturationCaution(
  saturation: RiskReport["evaluation"]["dataSaturation"],
): string | null {
  if (saturation === "sparse") {
    return "官方名冊有登記；本次未檢出公開糾紛討論。風險參考為中性，並不表示工程無風險。";
  }
  if (saturation === "unindexed") {
    return "名冊未匹配或公開資料不足以評估口碑，請自行核實牌照與合約。";
  }
  if (saturation === "moderate") {
    return "已檢出與查詢相關的公開來源；若未列出討論摘要，請以檢索層連結自行核實。";
  }
  return null;
}

function complianceBadgeText(report: RiskReport): string {
  const { complianceTrack } = report.evaluation;
  const reg = report.official.details?.registrationNo;
  if (complianceTrack.licenseStatus === "ambiguous") {
    return "名冊有多間近似登記，請以編號或電話再核實。";
  }
  if (complianceTrack.licenseStatus === "active") {
    return reg
      ? `小型工程承辦商名冊有登記（${reg}）`
      : "小型工程承辦商名冊有登記";
  }
  return "名冊未匹配登記資料";
}

function reputationBadgeText(report: RiskReport): string {
  const { reputationTrack } = report.evaluation;
  const recent = reputationTrack.recentDisputeCount;
  switch (reputationTrack.disputeLevel) {
    case "none_detected":
      return "未檢出活躍投訴紀錄";
    case "historical_isolated":
      return recent > 0
        ? `有較早的公開提及（近兩年內 ${recent} 則相關摘要）`
        : "有較早的公開提及；請逐條核實來源";
    case "active_concerning":
      return recent > 0
        ? `近兩年內約 ${recent} 則糾紛相關摘要`
        : "有近期公開糾紛相關提及";
    case "severe":
      return "多宗可引用討論；請逐條核實來源";
    default:
      return "請以下方來源自行核實";
  }
}

function overallBadgeText(report: RiskReport): string {
  const band =
    report.evaluation.riskBandDetailZh ?? report.evaluation.riskBandZh;
  return `${band} · 置信度${confidenceLabelZh(report.evaluation.confidence)}`;
}

function matchReasonLabel(
  reason: RiskReport["signals"]["retrievalEvidence"][number]["matchReason"],
): string {
  if (reason === "phone_anchor") return "電話號碼";
  return "公司／名稱字串";
}

type IncidentType = NonNullable<
  NonNullable<RiskReport["signals"]["highlights"]>[number]["incidentType"]
>;

function incidentTypeLabel(type: IncidentType): string {
  const map: Record<IncidentType, string> = {
    payment_dispute: "付款／超支",
    quality_defect: "工程質素",
    delay_abandonment: "延誤／爛尾",
    communication: "溝通",
    other: "其他",
  };
  return map[type];
}

function discussionEmptyCopy(
  serpHits: number | undefined,
  boundHits: number | undefined,
): string {
  const serp = serpHits ?? 0;
  const bound = boundHits ?? 0;
  if (serp === 0 && bound === 0) {
    return "未檢索到相關公開頁面。";
  }
  if (serp > 0 && bound === 0) {
    return `已檢視約 ${serp} 條公開搜尋結果，未能確認與本次查詢對象相關的可引用討論（摘要未出現可對象字串）。`;
  }
  if (serp > 0 && bound > 0) {
    return `已確認 ${bound} 條與查詢對象字串相關的來源，但未形成可列出的討論摘要，請自行核實。`;
  }
  return "未檢出相關提及。";
}

function TextBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/20 px-3 py-2 min-h-[4.5rem]">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground mt-1 leading-snug">
        {value}
      </p>
    </div>
  );
}

export function ReportCard({ report }: { report: RiskReport }) {
  const highlights = report.signals.highlights ?? [];
  const serpHits = report.signals.serpHitCount;
  const boundHits = report.signals.boundHitCount;
  const alignmentHint = nameAlignmentHint(
    report.entity.nameAlignment,
    report.entity.matchType,
  );
  const checklist = report.signals.contractChecklist ?? [];
  const actionable = report.signals.actionableClauses ?? [];
  const saturation = report.evaluation.dataSaturation;
  const saturationNote = dataSaturationCaution(saturation);
  const showSaturationBanner =
    saturation === "sparse" ||
    saturation === "unindexed" ||
    (saturation === "moderate" && highlights.length === 0);

  return (
    <article className="rounded-xl border border-border bg-background p-4 shadow-sm sm:p-6 text-left space-y-4">
      <header>
        <h2 className="text-lg font-semibold text-foreground">
          {report.entity.displayName}
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          風險參考（公開資料摘要）·{" "}
          <span className="font-medium text-foreground">
            {report.evaluation.riskBandDetailZh ??
              report.evaluation.riskBandZh}
          </span>
        </p>
      </header>

      <section
        className="rounded-lg border border-border bg-muted/20 px-3 py-2 space-y-1"
        aria-labelledby="scope-heading"
      >
        <h3
          id="scope-heading"
          className="text-sm font-medium text-foreground"
        >
          本次查證範圍
        </h3>
        <p className="text-xs text-muted-foreground">
          查詢方式：{matchTypeLabel(report.entity.matchType)}
        </p>
        <p className="text-xs text-muted-foreground">
          你的查詢：{report.entity.queryEcho}
        </p>
        <p className="text-xs text-muted-foreground">
          搜尋用名稱：{report.entity.searchLabelUsed}
        </p>
        {report.entity.normalizedPhone && (
          <p className="text-xs text-muted-foreground">
            已用電話錨點協助檢索（僅於你提供電話時記錄）。
          </p>
        )}
        {boundHits != null && serpHits != null && (
          <p className="text-xs text-muted-foreground">
            公開搜尋結果約 {serpHits} 條；其中 {boundHits} 條在摘要中出現與本次對象相關的字串。
          </p>
        )}
        {serpHits != null &&
          boundHits != null &&
          serpHits >= 5 &&
          boundHits === 0 && (
            <p
              className="text-xs text-warning leading-relaxed rounded border border-warning/40 bg-warning-foreground/50 px-2 py-1.5"
              role="alert"
            >
              搜尋有結果但未能與本次名稱對照（常見於全形／半形數字或商號不同）。請試常用商號或半形公司名再查，或點擊重新查詢。
            </p>
          )}
        {report.official.details && (
          <p className="text-xs text-muted-foreground">
            官方名冊：{report.official.details.companyName}
            {report.official.details.registrationNo
              ? `（${report.official.details.registrationNo}）`
              : ""}
          </p>
        )}
        {alignmentHint && (
          <p className="text-xs text-foreground leading-relaxed">{alignmentHint}</p>
        )}
      </section>

      {showSaturationBanner && saturationNote && (
        <p
          className="rounded-lg border border-warning/30 bg-warning-foreground px-3 py-2 text-sm text-warning leading-relaxed"
          role="status"
        >
          {saturationNote}
        </p>
      )}

      <section
        className="grid gap-2 sm:grid-cols-3"
        aria-labelledby="evaluation-badges-heading"
      >
        <h3 id="evaluation-badges-heading" className="sr-only">
          評估摘要
        </h3>
        <TextBadge label="官方資質" value={complianceBadgeText(report)} />
        <TextBadge label="民間聲量" value={reputationBadgeText(report)} />
        <TextBadge label="風險參考" value={overallBadgeText(report)} />
      </section>

      <section aria-labelledby="summary-heading">
        <h3 id="summary-heading" className="text-sm font-medium text-foreground">
          摘要
        </h3>
        <p className="mt-1 text-sm leading-relaxed text-foreground">
          {report.summaryZh}
        </p>
      </section>

      {actionable.length > 0 && (
        <section aria-labelledby="actionable-heading">
          <h3
            id="actionable-heading"
            className="text-sm font-medium text-foreground"
          >
            簽約防守建議（依本案公開資料）
          </h3>
          <ul className="mt-2 space-y-2">
            {actionable.map((item, i) => (
              <li
                key={`${item.category}-${i}`}
                className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
              >
                <p className="text-xs text-muted-foreground">{item.category}</p>
                <p className="mt-0.5 text-foreground">{item.clauseText}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {item.reason}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section
        className="space-y-2"
        aria-labelledby="retrieval-evidence-heading"
      >
        <h3
          id="retrieval-evidence-heading"
          className="text-sm font-medium text-foreground"
        >
          與本次對象相關的公開來源（檢索層）
        </h3>
        {(report.signals.retrievalEvidence?.length ?? 0) > 0 ? (
          <ul className="space-y-2">
            {report.signals.retrievalEvidence!.map((item) => (
              <li
                key={item.url}
                className="rounded-lg border border-border bg-muted/20 px-3 py-2 text-sm"
              >
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-primary underline-offset-2 hover:underline break-all"
                >
                  {item.title || item.url}
                </a>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                  {item.snippetExcerpt}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  匹配依據：{matchReasonLabel(item.matchReason)}（
                  {item.matchedToken}）
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {discussionEmptyCopy(serpHits, boundHits)}
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          以上為本次搜尋結果中，摘要或標題出現與查詢對象相關字串的連結；不等同法律定論或完整討論內容。
        </p>
      </section>

      {highlights.length > 0 && (
        <section className="space-y-3" aria-labelledby="highlights-heading">
          <h3
            id="highlights-heading"
            className="text-sm font-medium text-foreground"
          >
            公開討論摘要（{report.signals.discussionCount} 則）
          </h3>
          <ul className="space-y-3">
            {highlights.map((h) => (
              <li
                key={h.url}
                className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm"
              >
                <p className="text-xs text-muted-foreground">
                  {[
                    h.sourceName,
                    h.dateHint,
                    h.approxYear ? `${h.approxYear} 年` : null,
                    h.incidentType
                      ? incidentTypeLabel(h.incidentType)
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ") || "公開來源"}
                </p>
                <p className="mt-1 leading-relaxed text-foreground">
                  {h.factSummary ?? h.summaryZh}
                </p>
                {h.factSummary && h.factSummary !== h.summaryZh && (
                  <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                    {h.summaryZh}
                  </p>
                )}
                <a
                  href={h.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs text-primary underline-offset-2 hover:underline"
                >
                  查看來源
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {highlights.length === 0 && (
        <section aria-labelledby="mentions-heading">
          <h3
            id="mentions-heading"
            className="text-sm font-medium text-foreground"
          >
            公開討論相關提及
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {report.signals.discussionCount} 則
            <span className="block mt-1 text-xs leading-relaxed">
              {discussionEmptyCopy(serpHits, boundHits)}
            </span>
          </p>
        </section>
      )}

      {report.signals.themes.length > 0 && (
        <p className="text-sm text-muted-foreground">
          主題：{report.signals.themes.join("、")}
        </p>
      )}

      {checklist.length > 0 && (
        <section aria-labelledby="checklist-heading">
          <h3
            id="checklist-heading"
            className="text-sm font-medium text-foreground"
          >
            {actionable.length > 0
              ? "通用簽約提問（兜底）"
              : "簽約前可參考提問"}
          </h3>
          <ul className="mt-2 list-disc pl-5 text-sm text-muted-foreground space-y-1">
            {checklist.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      )}

      {report.confidence === "medium" && highlights.length === 1 && (
        <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
          目前僅找到少量公開來源摘要，請自行核實是否與本次查詢對象為同一商號。
        </p>
      )}

      {report.confidence === "low" && (
        <p className="rounded-lg border border-warning/30 bg-warning-foreground px-3 py-2 text-sm text-warning">
          資料有限，請保持警惕並自行核實合約與來源。
        </p>
      )}

      {report.evaluation.riskBandZh === "未見負面摘要" && (
        <p className="rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          「未見負面摘要」僅表示在本次檢索範圍內的公開討論摘要中，出現讚揚相關表述且未見糾紛相關表述；不包括未收錄來源，並不構成品質保證或聘用建議。
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        本報告為公開資料摘要及風險參考分檔，非信貸報告，非對承辦商的推薦。{" "}
        <Link href="/legal/disclaimer" className="underline hover:text-foreground">
          免責聲明
        </Link>
        <br />
        報告 v{report.reportVersion} · 免責 v{report.disclaimerVersion} ·
        生成時間{" "}
        <time dateTime={report.generatedAt}>
          {formatGeneratedAtZhHk(report.generatedAt)}
        </time>
      </p>
    </article>
  );
}

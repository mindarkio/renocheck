import type { z } from "zod";
import type { RiskReport } from "./report-schema";
import { riskBandZhSchema } from "./report-schema";

export type RiskBandZh = z.infer<typeof riskBandZhSchema>;

/** Left (偏高) → right (未見負面摘要); not a quality score (DEC-0010). */
export const RISK_BAND_METER_LEVELS: readonly RiskBandZh[] = [
  "風險偏高",
  "風險中等",
  "中性",
  "未見負面摘要",
];

export const RISK_BAND_METER_SHORT_LABELS: Record<RiskBandZh, string> = {
  風險偏高: "偏高",
  風險中等: "中等",
  中性: "中性",
  未見負面摘要: "未見負面",
};

export function riskBandMeterIndex(bandZh: RiskBandZh): number {
  const idx = RISK_BAND_METER_LEVELS.indexOf(bandZh);
  return idx >= 0 ? idx : 1;
}

/** Active meter segment on navy hero vs light cards (no red/green “good company”). */
const METER_SEGMENT_ON_PRIMARY: Record<RiskBandZh, string> = {
  風險偏高: "bg-amber-300",
  風險中等: "bg-accent",
  中性: "bg-primary-foreground",
  未見負面摘要: "bg-sky-200",
};

const METER_SEGMENT_ON_LIGHT: Record<RiskBandZh, string> = {
  風險偏高: "bg-warning",
  風險中等: "bg-accent",
  中性: "bg-primary/70",
  未見負面摘要: "bg-primary/35",
};

const METER_POINTER_ON_PRIMARY: Record<RiskBandZh, string> = {
  風險偏高: "border-t-amber-300",
  風險中等: "border-t-accent",
  中性: "border-t-primary-foreground",
  未見負面摘要: "border-t-sky-200",
};

const METER_POINTER_ON_LIGHT: Record<RiskBandZh, string> = {
  風險偏高: "border-t-warning",
  風險中等: "border-t-accent",
  中性: "border-t-primary",
  未見負面摘要: "border-t-primary/50",
};

const METER_LABEL_ACTIVE_ON_PRIMARY: Record<RiskBandZh, string> = {
  風險偏高: "font-semibold text-amber-200",
  風險中等: "font-semibold text-accent",
  中性: "font-semibold text-primary-foreground",
  未見負面摘要: "font-semibold text-sky-200",
};

const METER_LABEL_ACTIVE_ON_LIGHT: Record<RiskBandZh, string> = {
  風險偏高: "font-semibold text-warning",
  風險中等: "font-semibold text-accent",
  中性: "font-semibold text-primary",
  未見負面摘要: "font-semibold text-primary/80",
};

export function riskBandMeterActiveSegmentClass(
  level: RiskBandZh,
  onPrimary: boolean,
): string {
  return onPrimary
    ? METER_SEGMENT_ON_PRIMARY[level]
    : METER_SEGMENT_ON_LIGHT[level];
}

export function riskBandMeterPointerClass(
  level: RiskBandZh,
  onPrimary: boolean,
): string {
  return onPrimary
    ? METER_POINTER_ON_PRIMARY[level]
    : METER_POINTER_ON_LIGHT[level];
}

export function riskBandMeterActiveLabelClass(
  level: RiskBandZh,
  onPrimary: boolean,
): string {
  return onPrimary
    ? METER_LABEL_ACTIVE_ON_PRIMARY[level]
    : METER_LABEL_ACTIVE_ON_LIGHT[level];
}

export function riskBandLabel(report: RiskReport): string {
  return report.evaluation.riskBandDetailZh ?? report.evaluation.riskBandZh;
}

/** Subtle surface accent on white (DEC-0010: no red/green “good/bad company”). */
export function riskBandSurfaceClass(bandZh: string): string {
  if (bandZh === "風險偏高") {
    return "border-warning/35 bg-warning-foreground/40";
  }
  if (bandZh === "風險中等") {
    return "border-border bg-muted/25";
  }
  if (bandZh === "未見負面摘要") {
    return "border-primary/20 bg-primary/[0.05]";
  }
  return "border-border/80 bg-muted/15";
}

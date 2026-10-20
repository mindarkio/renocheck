import {
  RISK_BAND_METER_LEVELS,
  RISK_BAND_METER_SHORT_LABELS,
  riskBandMeterActiveLabelClass,
  riskBandMeterActiveSegmentClass,
  riskBandMeterIndex,
  riskBandMeterPointerClass,
  type RiskBandZh,
} from "@/lib/risk-band-display";

type RiskBandMeterProps = {
  bandZh: RiskBandZh;
  /** On report hero (`bg-primary`); default false for light surfaces. */
  onPrimary?: boolean;
  /** Hero emphasis: thicker scale and labels. */
  emphasized?: boolean;
};

export function RiskBandMeter({
  bandZh,
  onPrimary = true,
  emphasized = false,
}: RiskBandMeterProps) {
  const activeIndex = riskBandMeterIndex(bandZh);
  const activeLevel = RISK_BAND_METER_LEVELS[activeIndex];
  const segmentCount = RISK_BAND_METER_LEVELS.length;
  const pointerLeftPercent = ((activeIndex + 0.5) / segmentCount) * 100;

  const trackInactive = onPrimary
    ? "bg-primary-foreground/22"
    : "bg-muted";
  const labelInactive = onPrimary
    ? "text-primary-foreground/50"
    : "text-muted-foreground";

  const pointerClass = riskBandMeterPointerClass(activeLevel, onPrimary);

  return (
    <div
      className={`w-full ${emphasized ? "mt-3" : "mt-4"}`}
      role="img"
      aria-label={`風險參考量表四級（由左至右：風險偏高、風險中等、中性、未見負面摘要）；本次：${bandZh}`}
    >
      <div className="relative pb-1 pt-2">
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 transition-[left] duration-300 ease-out"
          style={{ left: `${pointerLeftPercent}%` }}
          aria-hidden
        >
          <div
            className={`mx-auto size-0 border-x-[5px] border-x-transparent border-t-[6px] ${pointerClass}`}
          />
        </div>
        <div className="flex gap-1" aria-hidden>
          {RISK_BAND_METER_LEVELS.map((level, i) => (
            <div
              key={level}
              className={`${emphasized ? "h-2.5" : "h-1.5"} flex-1 rounded-full transition-colors ${
                i === activeIndex
                  ? riskBandMeterActiveSegmentClass(level, onPrimary)
                  : trackInactive
              }`}
            />
          ))}
        </div>
      </div>
      <div
        className={`mt-2.5 grid grid-cols-4 gap-1 text-center leading-snug ${
          emphasized ? "text-xs" : "text-xs sm:text-sm"
        }`}
        aria-hidden
      >
        {RISK_BAND_METER_LEVELS.map((level, i) => (
          <span
            key={level}
            className={
              i === activeIndex
                ? riskBandMeterActiveLabelClass(level, onPrimary)
                : labelInactive
            }
          >
            {RISK_BAND_METER_SHORT_LABELS[level]}
          </span>
        ))}
      </div>
    </div>
  );
}

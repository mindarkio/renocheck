import { describe, expect, it } from "vitest";
import {
  riskBandMeterActiveLabelClass,
  riskBandMeterActiveSegmentClass,
  riskBandMeterIndex,
  riskBandSurfaceClass,
} from "./risk-band-display";

describe("riskBandSurfaceClass", () => {
  it("returns distinct surfaces per band", () => {
    expect(riskBandSurfaceClass("風險偏高")).toContain("warning");
    expect(riskBandSurfaceClass("中性")).toContain("muted");
  });
});

describe("riskBandMeterIndex", () => {
  it("maps bands left-to-right on the concern scale", () => {
    expect(riskBandMeterIndex("風險偏高")).toBe(0);
    expect(riskBandMeterIndex("風險中等")).toBe(1);
    expect(riskBandMeterIndex("中性")).toBe(2);
    expect(riskBandMeterIndex("未見負面摘要")).toBe(3);
  });
});

describe("riskBandMeterActiveLabelClass", () => {
  it("keeps 風險中等 on text-accent for both surfaces", () => {
    expect(riskBandMeterActiveLabelClass("風險中等", true)).toContain(
      "text-accent",
    );
    expect(riskBandMeterActiveLabelClass("風險中等", false)).toContain(
      "text-accent",
    );
    expect(riskBandMeterActiveLabelClass("風險中等", true)).not.toContain(
      "text-primary-foreground",
    );
    expect(riskBandMeterActiveLabelClass("風險中等", false)).not.toContain(
      "text-primary-foreground",
    );
  });
});

describe("riskBandMeterActiveSegmentClass", () => {
  it("uses distinct tokens per band on primary hero", () => {
    expect(riskBandMeterActiveSegmentClass("風險偏高", true)).toContain(
      "amber",
    );
    expect(riskBandMeterActiveSegmentClass("風險中等", true)).toContain(
      "accent",
    );
    expect(riskBandMeterActiveSegmentClass("中性", true)).toContain(
      "primary-foreground",
    );
    expect(riskBandMeterActiveSegmentClass("未見負面摘要", true)).toContain(
      "sky",
    );
  });
});

// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { RiskBandMeter } from "./RiskBandMeter";

afterEach(() => cleanup());

describe("RiskBandMeter", () => {
  it("inactive labels use /80 and the active label stays semibold", () => {
    const { container } = render(
      <RiskBandMeter bandZh="風險中等" onPrimary emphasized />,
    );
    const spans = [...container.querySelectorAll("div.grid span")];
    expect(spans.length).toBeGreaterThan(0);
    for (const span of spans) {
      if (span.textContent === "中等") {
        expect(span.className).toContain("font-semibold");
        expect(span.className).toContain("text-accent");
      } else {
        expect(span.className).toContain("text-primary-foreground/80");
      }
    }
  });
});

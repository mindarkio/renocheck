import { describe, expect, it } from "vitest";
import {
  cdxCaptureWindow,
  isNoHearingPage,
  isTransientArchiveHtml,
  parseCdxJson,
  selectCauseListSnapshots,
  weekdayGapRanges,
} from "./cdx";
import { buildCdxSearchUrl, buildWaybackRawUrl, causeListPoliteDelayMs } from "./dcl-url";

describe("cause list CDX selection", () => {
  it("keeps the latest English snapshot per court and date", () => {
    const body = JSON.stringify([
      ["timestamp", "original", "statuscode"],
      [
        "20241105120000",
        "https://e-services.judiciary.hk/dcl/view.jsp?date=06112024&court=SMT",
        "200",
      ],
      [
        "20241106120000",
        "https://e-services.judiciary.hk/dcl/view.jsp?date=06112024&court=SMT",
        "200",
      ],
      [
        "20241105130000",
        "https://e-services.judiciary.hk/dcl/view.jsp?date=06112024&court=DC&lang=zh",
        "200",
      ],
      [
        "20241105140000",
        "https://e-services.judiciary.hk/dcl/view.jsp?date=06112024&court=DCMC",
        "200",
      ],
      [
        "20241001120000",
        "https://e-services.judiciary.hk/dcl/view.jsp?date=01102024&court=LANDS",
        "200",
      ],
      [
        "20241107120000",
        "https://e-services.judiciary.hk/dcl/view.jsp?lang=en&date=07112024&court=CACFI",
        "200",
      ],
    ]);
    const snaps = selectCauseListSnapshots(parseCdxJson(body), "2024-11-01", "2024-11-30");
    expect(snaps.map((snap) => `${snap.court}:${snap.dateDdMmYyyy}:${snap.timestamp}`)).toEqual([
      "SMT:06112024:20241106120000",
      "CACFI:07112024:20241107120000",
    ]);
    expect(
      buildWaybackRawUrl(snaps[0].timestamp, snaps[0].original),
    ).toBe(
      "https://web.archive.org/web/20241106120000id_/https://e-services.judiciary.hk/dcl/view.jsp?date=06112024&court=SMT",
    );
  });

  it("lists weekday gaps", () => {
    expect(weekdayGapRanges("2024-11-01", "2024-11-11", ["2024-11-01", "2024-11-11"])).toEqual([
      "2024-11-04..2024-11-08",
    ]);
  });

  it("builds a court-filtered CDX url and a 3–5s delay", () => {
    const url = buildCdxSearchUrl("20241101", "20241130");
    expect(url).toContain("url=e-services.judiciary.hk/dcl/view.jsp");
    expect(url).toContain("filter=statuscode:200");
    expect(url).not.toContain("court=");
    expect(causeListPoliteDelayMs(0)).toBe(3000);
    expect(causeListPoliteDelayMs(2000 / 2001)).toBe(5000);
  });

  it("does not treat a real cause-list page as a transient archive miss", () => {
    expect(isTransientArchiveHtml("The Wayback Machine has not archived that URL")).toBe(true);
    expect(isTransientArchiveHtml("<title>Daily List</title> DAILY CAUSE LIST")).toBe(false);
  });

  it("keeps a no-hearing page out of the transient bucket", () => {
    const html = "<html><body>There is no hearing on this day</body></html>";
    expect(isNoHearingPage(html)).toBe(true);
    expect(isTransientArchiveHtml(html)).toBe(false);
    expect(isNoHearingPage("<html>此日並無法庭聆訊</html>")).toBe(true);
  });

  it("selects a March list date captured in February, including escaped URLs", () => {
    const snaps = selectCauseListSnapshots(
      [
        {
          timestamp: "20250228120000",
          original:
            "https://e-services.judiciary.hk/dcl/view.jsp?lang=en&amp;date=03032025&amp;court=SMT",
          status: "200",
        },
      ],
      "2025-03-01",
      "2025-03-31",
    );
    expect(snaps.map((snap) => `${snap.court}:${snap.dateDdMmYyyy}:${snap.timestamp}`)).toEqual([
      "SMT:03032025:20250228120000",
    ]);
    const window = cdxCaptureWindow("2025-03-01", "2025-03-31", "2026-10-17");
    expect(window.fromIso <= "2025-02-28").toBe(true);
    expect(window.toIso >= "2025-03-31").toBe(true);
    expect(cdxCaptureWindow("2026-10-01", "2026-10-17", "2026-10-17").toIso).toBe("2026-10-17");
  });
});

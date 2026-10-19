// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { LegalEventsTable } from "./LegalEventsTable";
import type { OfficialLegalEvent } from "@/lib/legal-event-schema";
import {
  judgmentCategoryLabelZh,
  outcomeHintLabelZh,
  partyRoleLabelZh,
  LEGAL_EVENTS_SCOPE_ZH,
} from "@/lib/legal-event-display";
import { LEGAL_EVENT_SOURCE_LINK_LABEL_ZH } from "@/lib/report-trust-copy-zh";

afterEach(() => cleanup());

function synthEvent(
  partial: Partial<OfficialLegalEvent> & Pick<OfficialLegalEvent, "caseRef">,
): OfficialLegalEvent {
  return {
    sourceType: "court_judgment",
    court: "高等法院原訟法庭",
    eventDate: "2025-02-01",
    partyRole: "defendant",
    judgmentCategory: "employment_renovation",
    sourceUrl: "https://example.com/judgment",
    matchReasonZh: "合成匹配理由",
    hearingKeyPointsZh: ["合成要點"],
    hearingPointsSource: "ai_verified",
    ...partial,
  };
}

describe("LegalEventsTable", () => {
  const events: OfficialLegalEvent[] = [
    synthEvent({
      caseRef: "HCLA 99/2024",
      relatedCaseRefs: ["HCLA 98/2024"],
      neutralCitation: "[2025] HKCFI 9999",
      outcomeHint: "defendant_liable",
    }),
    synthEvent({
      caseRef: "HCLA 97/2024",
      neutralCitation: undefined,
      outcomeHint: undefined,
    }),
  ];

  it("desktop rows、mobile cards、表頭與欄位", () => {
    const { container } = render(<LegalEventsTable events={events} />);
    expect(screen.getAllByTestId("legal-event-row")).toHaveLength(2);
    expect(screen.getAllByTestId("legal-event-card")).toHaveLength(2);

    const row = screen.getAllByTestId("legal-event-row")[0];
    expect(row.textContent).toContain("HCLA 99/2024");
    expect(row.textContent).toContain("HCLA 98/2024");
    expect(container.textContent).toContain("[2025] HKCFI 9999");
    expect(container.textContent).toContain(
      partyRoleLabelZh("defendant"),
    );
    expect(container.textContent).toContain(
      judgmentCategoryLabelZh("employment_renovation"),
    );
    expect(container.textContent).toContain(
      outcomeHintLabelZh("defendant_liable"),
    );

    const headers = ["案件編號", "中立引用", "法院", "判決日期", "公司角色", "類別", "結果", "判詞"];
    for (const h of headers) {
      expect(screen.getAllByText(h).length).toBeGreaterThanOrEqual(1);
    }

    expect(container.textContent).toContain("—");
    expect(container.textContent).toContain(LEGAL_EVENTS_SCOPE_ZH);
    expect(container.textContent).toContain("合成匹配理由");
    expect(screen.getAllByText(LEGAL_EVENT_SOURCE_LINK_LABEL_ZH).length).toBeGreaterThanOrEqual(1);
  });

  it("lg 先出表、短欄不換行、類別只在標點處可斷行", () => {
    const { container } = render(<LegalEventsTable events={events} />);
    const table = container.querySelector("table");
    expect(table).toBeTruthy();
    expect(table?.className).toContain("w-full");
    const scroller = table?.parentElement;
    expect(scroller?.className).toContain("overflow-x-auto");
    expect(scroller?.className).toContain("lg:block");
    expect(scroller?.className).not.toMatch(/\bmd:block\b/);

    const cardList = screen.getAllByTestId("legal-event-card")[0]?.closest("ul");
    expect(cardList?.className).toContain("lg:hidden");
    expect(cardList?.className).not.toContain("md:hidden");

    const headers = table!.querySelectorAll("th");
    expect(headers).toHaveLength(8);
    for (const th of headers) {
      expect(th.getAttribute("scope")).toBe("col");
      expect(th.className).toContain("whitespace-nowrap");
    }
    expect(table?.querySelector("caption")?.textContent).toContain("公開判詞紀錄");

    const cells = [...table!.querySelectorAll("tbody tr:first-child td")];
    const roleCell = cells.find((td) => td.textContent?.includes("被告／答辯人"));
    const outcomeCell = cells.find((td) => td.textContent?.includes("裁定須負責"));
    const categoryCell = cells.find((td) =>
      td.textContent?.includes("勞資糾紛（裝修工程相關）"),
    );
    expect(roleCell?.className).toContain("whitespace-nowrap");
    expect(outcomeCell?.className).toContain("whitespace-nowrap");
    const categoryParts = categoryCell?.querySelectorAll("span.whitespace-nowrap");
    expect(categoryParts?.length).toBe(2);
    expect(categoryCell?.textContent).toContain("勞資糾紛");
    expect(categoryCell?.textContent).toContain("（裝修工程相關）");
  });
});

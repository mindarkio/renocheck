// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  QUOTE_COMPANY_CONFIRM_ZH,
  QUOTE_COMPANY_NEED_NAME_ZH,
  QUOTE_COMPANY_RESULT_HEADING_ZH,
} from "@/lib/quote-analysis/copy";
import {
  clearQuoteCompanyNamesForTests,
  holdQuoteCompanyName,
} from "@/lib/quote-analysis/company-name-handoff";
import { CONTINUE_AS_COMPANY_ZH } from "@/lib/search-disambiguation-copy";
import { QuoteCompanyConfirm } from "./QuoteCompanyConfirm";

vi.mock("./ReportCard", () => ({
  ReportCard: ({ report }: { report: { entity: { displayName: string } } }) => (
    <p>{report.entity.displayName}</p>
  ),
}));

vi.mock("./SearchProgress", () => ({
  SearchProgressModal: () => null,
}));

const ID = "22222222-2222-4222-8222-222222222222";
const COMPANY = "合成測試工程有限公司";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("quote company confirm", () => {
  afterEach(() => {
    cleanup();
    clearQuoteCompanyNamesForTests();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("does not search until the user confirms, then runs the company search", async () => {
    holdQuoteCompanyName(ID, COMPANY);
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        bodies.push(body);
        if (body.preview === "register") {
          return jsonResponse({ matchCount: 0, windowFull: false, candidates: [] });
        }
        return jsonResponse({
          fingerprint: "a".repeat(32),
          report: { entity: { displayName: COMPANY } },
        });
      }),
    );
    render(<QuoteCompanyConfirm analysisId={ID} />);
    expect(await screen.findByDisplayValue(COMPANY)).toBeTruthy();
    expect(bodies).toHaveLength(0);
    fireEvent.click(screen.getByRole("button", { name: QUOTE_COMPANY_CONFIRM_ZH }));
    expect(await screen.findByRole("heading", { name: QUOTE_COMPANY_RESULT_HEADING_ZH })).toBeTruthy();
    expect(bodies[0]).toEqual({ preview: "register", companyName: COMPANY });
    expect(bodies[1]?.companyName).toBe(COMPANY);
    expect(bodies[1]?.preview).toBeUndefined();
    const stored = Object.values(localStorage);
    expect(stored.some((value) => String(value).includes(COMPANY))).toBe(false);
    expect(sessionStorage.length).toBe(0);
  });

  it("shows the personal-name gate and does not search until the continue link", async () => {
    const fetchSpy = vi.fn(async () =>
      jsonResponse({ matchCount: 0, windowFull: false, candidates: [] }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    render(<QuoteCompanyConfirm analysisId={ID} />);
    const input = screen.getByRole("textbox", { name: "公司名稱" });
    fireEvent.change(input, { target: { value: "陳大文" } });
    fireEvent.click(screen.getByRole("button", { name: QUOTE_COMPANY_CONFIRM_ZH }));
    expect(await screen.findByRole("button", { name: CONTINUE_AS_COMPANY_ZH })).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: CONTINUE_AS_COMPANY_ZH }));
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
  });

  it("searches a three-character trade suffix without the personal-name stop", async () => {
    const bodies: Array<Record<string, unknown>> = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        bodies.push(body);
        return jsonResponse({ matchCount: 9, windowFull: false, candidates: [] });
      }),
    );
    render(<QuoteCompanyConfirm analysisId={ID} />);
    fireEvent.change(screen.getByRole("textbox", { name: "公司名稱" }), {
      target: { value: "合成號" },
    });
    fireEvent.click(screen.getByRole("button", { name: QUOTE_COMPANY_CONFIRM_ZH }));
    expect(await screen.findByRole("heading", { name: "請輸入公司全名" })).toBeTruthy();
    expect(bodies).toEqual([{ preview: "register", companyName: "合成號" }]);
  });

  it("does not search an empty name", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    render(<QuoteCompanyConfirm analysisId={ID} />);
    fireEvent.click(screen.getByRole("button", { name: QUOTE_COMPANY_CONFIRM_ZH }));
    expect(screen.getByText(QUOTE_COMPANY_NEED_NAME_ZH)).toBeTruthy();
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "公司名稱" }).getAttribute("maxlength")).toBe("100");
  });
});

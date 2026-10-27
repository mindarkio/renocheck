// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchForm } from "./SearchForm";
import { ServiceBanner } from "./ServiceBanner";
import { ANON_ID_STORAGE_KEY, isAnonId, resetAnonIdForTests } from "@/lib/anon-id";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const B1 = "用戶擁擠，系統暫停服務，請稍後再試";
const B6 = "報告未能顯示，請稍後再試。";

function jsonResponse(status: number, error: string) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => ({ error }),
  };
}

/** Company-name submit checks the register first. Zero rows then run today's report. */
function stubSearchFetch(
  search: () => ReturnType<typeof jsonResponse>,
) {
  const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as { preview?: string };
    if (body.preview === "register") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ matchCount: 0, windowFull: false, candidates: [] }),
      };
    }
    return search();
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  localStorage.clear();
  resetAnonIdForTests();
});

describe("ServiceBanner", () => {
  it("shows the approved pause text", () => {
    render(<ServiceBanner />);
    const banner = screen.getByRole("alert");
    expect(banner.textContent).toBe(B1);
    expect(banner.id).toBe("service-paused-banner");
  });
});

describe("SearchForm pause and errors", () => {
  it("keeps the card inputs enabled while the service is paused", () => {
    render(<SearchForm paused />);
    for (const id of ["companyName", "phone", "br"]) {
      expect((document.getElementById(id) as HTMLInputElement).disabled).toBe(false);
    }
    expect(
      (screen.getByRole("button", { name: "查閱公開資料摘要" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(document.body.textContent).not.toContain(B1);
  });

  it("keeps the landing search box enabled and points it at the banner", () => {
    render(
      <>
        <ServiceBanner />
        <SearchForm variant="landing" paused />
      </>,
    );
    const input = screen.getByRole("searchbox") as HTMLInputElement;
    expect(input.disabled).toBe(false);
    expect(input.getAttribute("aria-describedby")).toBe("service-paused-banner");
    expect(
      (screen.getByRole("button", { name: "查閱公開資料摘要" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it("has no aria-describedby on the search box when not paused", () => {
    render(<SearchForm variant="landing" />);
    expect(screen.getByRole("searchbox").hasAttribute("aria-describedby")).toBe(false);
  });

  it("shows B1 but keeps the search box enabled after 503 service_paused", async () => {
    stubSearchFetch(() => jsonResponse(503, "service_paused"));
    render(<SearchForm variant="landing" />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "示例裝修有限公司" },
    });
    fireEvent.click(screen.getByRole("button", { name: "查閱公開資料摘要" }));
    await waitFor(() => {
      expect(screen.getByRole("status").textContent).toBe(B1);
    });
    expect((screen.getByRole("searchbox") as HTMLInputElement).disabled).toBe(false);
    expect(
      (screen.getByRole("button", { name: "查閱公開資料摘要" }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it.each(["llm_busy"] as const)(
    "shows B1 and disables input after 503 %s",
    async (code) => {
      stubSearchFetch(() => jsonResponse(503, code));
      render(<SearchForm variant="landing" />);
      fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "示例裝修有限公司" },
      });
      fireEvent.click(screen.getByRole("button", { name: "查閱公開資料摘要" }));
      await waitFor(() => {
        expect(screen.getByRole("status").textContent).toBe(B1);
      });
      expect((screen.getByRole("searchbox") as HTMLInputElement).disabled).toBe(true);
    },
  );

  it.each(["llm_busy"] as const)(
    "re-enables the search box 120 seconds after 503 %s",
    async (code) => {
      vi.useFakeTimers();
      try {
      stubSearchFetch(() => jsonResponse(503, code));
        render(<SearchForm variant="landing" />);
        fireEvent.change(screen.getByRole("searchbox"), {
          target: { value: "示例裝修有限公司" },
        });
        await act(async () => {
          fireEvent.click(screen.getByRole("button", { name: "查閱公開資料摘要" }));
        });
        await act(async () => {
          await Promise.resolve();
        });
        expect(screen.getByRole("status").textContent).toBe(B1);
        expect((screen.getByRole("searchbox") as HTMLInputElement).disabled).toBe(true);
        await act(async () => {
          vi.advanceTimersByTime(119_000);
        });
        expect((screen.getByRole("searchbox") as HTMLInputElement).disabled).toBe(true);
        await act(async () => {
          vi.advanceTimersByTime(1_000);
        });
        expect((screen.getByRole("searchbox") as HTMLInputElement).disabled).toBe(false);
      } finally {
        vi.useRealTimers();
      }
    },
  );

  it.each(["supabase_unavailable", "serp_unavailable", "llm_unavailable"] as const)(
    "hides the %s env hint",
    async (code) => {
      stubSearchFetch(() => jsonResponse(503, code));
      render(<SearchForm variant="landing" />);
      fireEvent.change(screen.getByRole("searchbox"), {
        target: { value: "示例裝修有限公司" },
      });
      fireEvent.click(screen.getByRole("button", { name: "查閱公開資料摘要" }));
      await waitFor(() => {
        expect(screen.getByRole("status").textContent).toBe(B6);
      });
      const text = document.body.textContent ?? "";
      expect(text).not.toContain("SERPER");
      expect(text).not.toContain("Supabase");
      expect(text).not.toContain("環境變數");
      expect(text).not.toContain("AI Gateway");
    },
  );

  it("sends the localStorage anonymous id with the search and does not use a cookie", async () => {
    const fetchMock = stubSearchFetch(() => jsonResponse(400, "invalid_input"));
    render(<SearchForm variant="landing" />);
    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "示例裝修有限公司" },
    });
    fireEvent.click(screen.getByRole("button", { name: "查閱公開資料摘要" }));
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThan(1));
    const searchCall = fetchMock.mock.calls.find((call) => {
      const body = JSON.parse(String(call[1]?.body ?? "{}")) as { preview?: string };
      return body.preview !== "register";
    });
    const payload = JSON.parse(String(searchCall?.[1]?.body ?? "{}")) as {
      anonId?: string;
      companyName?: string;
      preview?: string;
    };
    expect(payload.preview).toBeUndefined();
    expect(isAnonId(payload.anonId)).toBe(true);
    expect(payload.companyName).toBe("示例裝修有限公司");
    expect(localStorage.getItem(ANON_ID_STORAGE_KEY)).toBe(payload.anonId);
    expect(document.cookie).not.toContain(payload.anonId ?? "");
  });
});

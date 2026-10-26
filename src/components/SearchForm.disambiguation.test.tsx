// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchForm } from "./SearchForm";
import {
  PICKER_GROUP_LABEL_ZH,
  personalNameMessageZh,
  shortCompanyNameMessageZh,
} from "@/lib/search-disambiguation-copy";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

type PreviewBody = {
  matchCount: number;
  windowFull: boolean;
  candidates: Array<{
    companyName: string;
    companyNameEn: string | null;
    registrationNo: string;
    exact: boolean;
  }>;
};

function candidate(
  companyName: string,
  registrationNo: string,
  exact = false,
  companyNameEn: string | null = null,
) {
  return { companyName, companyNameEn, registrationNo, exact };
}

function installFetch(preview: PreviewBody | "error") {
  const fetchMock = vi.fn(async (_url: unknown, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body ?? "{}")) as {
      preview?: string;
      companyName?: string;
      phone?: string;
      mwcRegistrationNo?: string;
    };
    if (body.preview === "register") {
      if (preview === "error") {
        return { ok: false, status: 503, json: async () => ({ error: "register_lookup_failed" }) };
      }
      return { ok: true, status: 200, json: async () => preview };
    }
    return {
      ok: true,
      status: 200,
      json: async () => ({
        fingerprint: "a".repeat(32),
        report: { entity: { displayName: body.companyName ?? "" } },
      }),
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function typeAndSearch(value: string) {
  fireEvent.change(screen.getByRole("searchbox"), { target: { value } });
  fireEvent.click(screen.getByRole("button", { name: "查閱公開資料摘要" }));
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SearchForm register gates", () => {
  it("shows the short-name status and does not look up the register", async () => {
    const fetchMock = installFetch({ matchCount: 0, windowFull: false, candidates: [] });
    render(<SearchForm variant="landing" />);
    typeAndSearch("南興");
    expect(screen.getByRole("status").textContent).toContain(shortCompanyNameMessageZh("南興"));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/將以/)).toBeNull();
  });

  it("blocks english personal names with no continue link", async () => {
    const fetchMock = installFetch({ matchCount: 0, windowFull: false, candidates: [] });
    render(<SearchForm variant="landing" />);
    typeAndSearch("alfred ho");
    const status = screen.getByRole("status");
    expect(status.textContent).toContain(personalNameMessageZh("alfred ho"));
    expect(screen.queryByRole("button", { name: "呢個係公司全名，繼續查" })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();

    cleanup();
    render(<SearchForm variant="landing" />);
    typeAndSearch("Tim Ho");
    expect(screen.getByRole("status").textContent).toContain(personalNameMessageZh("Tim Ho"));
    expect(screen.queryByRole("button", { name: "呢個係公司全名，繼續查" })).toBeNull();
  });

  it("offers 繼續查 only for a 3-character Chinese name", async () => {
    const fetchMock = installFetch({ matchCount: 0, windowFull: false, candidates: [] });
    render(<SearchForm variant="landing" />);
    typeAndSearch("何文軒");
    expect(screen.getByRole("status").textContent).toContain(personalNameMessageZh("何文軒"));
    expect(fetchMock).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "呢個係公司全名，繼續查" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as { preview?: string };
    expect(body.preview).toBe("register");
  });

  it("does not offer 繼續查 for 陳生", () => {
    installFetch({ matchCount: 0, windowFull: false, candidates: [] });
    render(<SearchForm variant="landing" />);
    typeAndSearch("陳生");
    expect(screen.getByRole("status").textContent).toContain("好似一個人名");
    expect(screen.queryByRole("button", { name: "呢個係公司全名，繼續查" })).toBeNull();
  });

  it("labels the picker as a radio group and tags the exact row", async () => {
    const fetchMock = installFetch({
      matchCount: 2,
      windowFull: false,
      candidates: [
        candidate("合成設計", "MWC(W) 1/2026", true),
        candidate("合成設計有限公司", "MWC 2/2026", false, "SYNTH DESIGN LIMITED"),
      ],
    });
    render(<SearchForm variant="landing" />);
    typeAndSearch("合成設計");
    const group = await screen.findByRole("radiogroup", { name: PICKER_GROUP_LABEL_ZH });
    expect(group).toBeTruthy();
    expect(
      screen.getByRole("radio", { name: "合成設計，註冊編號 MWC(W) 1/2026" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("radio", {
        name: "合成設計有限公司，英文名稱 SYNTH DESIGN LIMITED，註冊編號 MWC 2/2026",
      }),
    ).toBeTruthy();
    expect(screen.getByText("同你輸入一樣")).toBeTruthy();
    expect(screen.getByText("註冊編號 MWC(W) 1/2026")).toBeTruthy();
    expect(document.body.textContent).not.toContain("90000000");
    expect(document.body.textContent).not.toContain("授權");

    fireEvent.click(screen.getByRole("radio", { name: "合成設計，註冊編號 MWC(W) 1/2026" }));
    fireEvent.click(screen.getByRole("button", { name: "查呢間" }));
    await waitFor(() => {
      const report = fetchMock.mock.calls
        .map((call) => JSON.parse(String(call[1]?.body ?? "{}")) as { mwcRegistrationNo?: string })
        .find((body) => body.mwcRegistrationNo);
      expect(report?.mwcRegistrationNo).toBe("MWC(W) 1/2026");
    });
  });

  it("shows eight choices and no list for nine or a full window", async () => {
    installFetch({
      matchCount: 8,
      windowFull: false,
      candidates: Array.from({ length: 8 }, (_, i) =>
        candidate(`合成設計${i}有限公司`, `MWC ${i}/2026`),
      ),
    });
    render(<SearchForm variant="landing" />);
    typeAndSearch("合成設計");
    expect(await screen.findAllByRole("radio")).toHaveLength(8);

    cleanup();
    installFetch({ matchCount: 9, windowFull: false, candidates: [] });
    render(<SearchForm variant="landing" />);
    typeAndSearch("合成設計");
    expect(await screen.findByRole("heading", { name: "請輸入公司全名" })).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();

    cleanup();
    installFetch({
      matchCount: 20,
      windowFull: true,
      candidates: [candidate("不應列出有限公司", "MWC 99/2026", true)],
    });
    render(<SearchForm variant="landing" />);
    typeAndSearch("合成設計");
    expect(await screen.findByRole("heading", { name: "請輸入公司全名" })).toBeTruthy();
    expect(screen.queryByRole("radio")).toBeNull();
    expect(document.body.textContent).not.toContain("不應列出有限公司");
  });

  it("announces the register check and a register failure separately from the report", async () => {
    let release: (value: unknown) => void = () => {};
    const fetchMock = vi.fn(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);
    render(<SearchForm variant="landing" />);
    typeAndSearch("合成設計");
    expect(await screen.findByRole("status", { name: "正在對照屋宇署名冊" })).toBeTruthy();
    expect(screen.queryByRole("progressbar", { name: "查詢進度" })).toBeNull();
    release({
      ok: false,
      status: 503,
      json: async () => ({ error: "register_lookup_failed" }),
    });
    expect(await screen.findByText("名冊暫時對唔到，請稍後再試。")).toBeTruthy();
    expect(document.body.textContent).not.toContain("報告未能顯示");
    fireEvent.click(screen.getByRole("button", { name: "再試一次" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
  });

  it("skips the picker for a phone search", async () => {
    const fetchMock = installFetch({ matchCount: 2, windowFull: false, candidates: [] });
    render(<SearchForm variant="landing" />);
    typeAndSearch("9123 4567");
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const body = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
      preview?: string;
      phone?: string;
    };
    expect(body.preview).toBeUndefined();
    expect(body.phone).toBe("9123 4567");
  });
});

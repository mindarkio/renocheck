import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BD_REGISTERS_CSV_HEADER } from "./csv-header";
import { fetchBdRegisterCsv, sha256Hex, validateBdRegisterCsvBytes } from "./fetch-csv";

const FIXTURE = readFileSync(
  resolve(__dirname, "fixtures/registers.fixture.csv"),
  "utf8",
);

describe("validateBdRegisterCsvBytes", () => {
  it("accepts fixture bytes with official header", () => {
    const buf = Buffer.from(FIXTURE, "utf8");
    expect(() => validateBdRegisterCsvBytes(buf)).not.toThrow();
    expect(sha256Hex(buf)).toMatch(/^[a-f0-9]{64}$/);
  });

  it("rejects HTML/XML error body", () => {
    const buf = Buffer.from("<?xml version=\"1.0\"?><Error/>", "utf8");
    expect(() => validateBdRegisterCsvBytes(buf)).toThrow(/not a UTF-8 CSV/);
  });

  it("rejects wrong header line", () => {
    const buf = Buffer.from("NOT,A,VALID,HEADER\n", "utf8");
    expect(() => validateBdRegisterCsvBytes(buf)).toThrow(/unexpected content/);
  });

  it("accepts BOM-prefixed header", () => {
    const buf = Buffer.from("\uFEFF" + BD_REGISTERS_CSV_HEADER + "\n", "utf8");
    expect(() => validateBdRegisterCsvBytes(buf)).not.toThrow();
  });
});

function mockResponse(status: number, ok = status >= 200 && status < 300) {
  return {
    ok,
    status,
    headers: new Headers(),
    arrayBuffer: async () => new ArrayBuffer(0),
  };
}

describe("fetchBdRegisterCsv", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("does not retry on HTTP 403", async () => {
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(403, false));
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      fetchBdRegisterCsv("https://example.com/registers_full_list.csv", {
        userAgent: "RenocheckTest/0.1",
      }),
    ).rejects.toThrow(/fetch failed 403/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries HTTP 503 up to four attempts", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn().mockResolvedValue(mockResponse(503, false));
    vi.stubGlobal("fetch", fetchMock);
    const promise = fetchBdRegisterCsv("https://example.com/registers_full_list.csv", {
      userAgent: "RenocheckTest/0.1",
      maxRetries: 3,
    });
    const rejection = expect(promise).rejects.toThrow(/fetch failed 503/);
    await vi.runAllTimersAsync();
    await rejection;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

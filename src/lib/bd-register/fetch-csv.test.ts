import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { BD_REGISTERS_CSV_HEADER } from "./csv-header";
import { sha256Hex, validateBdRegisterCsvBytes } from "./fetch-csv";

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

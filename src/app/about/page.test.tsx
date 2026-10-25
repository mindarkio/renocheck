// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SITE_DISAMBIGUATION_LINE } from "@/lib/constants";
import AboutPage from "./page";

afterEach(() => {
  cleanup();
});

describe("About page disambiguation", () => {
  it("shows the HK/UK line as plain text", () => {
    const { container } = render(<AboutPage />);
    const line = screen.getByText(SITE_DISAMBIGUATION_LINE);
    expect(line.tagName).toBe("P");
    expect(line.closest("a")).toBeNull();
    for (const anchor of container.querySelectorAll("a")) {
      expect(anchor.getAttribute("href") ?? "").not.toMatch(/renocheck\.co\.uk/i);
      expect(anchor.textContent ?? "").not.toContain("renocheck.co.uk");
    }
  });
});

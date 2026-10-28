// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  LANDING_QUOTE_TITLE_ZH,
  LANDING_QUOTE_UNAVAILABLE_ZH,
  LANDING_SEARCH_TITLE_ZH,
} from "@/lib/quote-analysis/copy";
import { LandingChoices } from "./LandingChoices";

describe("landing path cards", () => {
  afterEach(() => cleanup());

  it("links the quote card to upload and focuses company search from the other card", () => {
    const input = document.createElement("input");
    input.id = "search-query";
    document.body.appendChild(input);
    render(<LandingChoices quoteOpen />);
    const quote = screen.getByRole("link", { name: new RegExp(LANDING_QUOTE_TITLE_ZH) });
    expect(quote.getAttribute("href")).toBe("/quote/upload");
    const search = screen.getByRole("link", { name: new RegExp(LANDING_SEARCH_TITLE_ZH) });
    expect(search.getAttribute("href")).toBe("/#company-search");
    fireEvent.click(search);
    expect(document.activeElement).toBe(input);
    input.remove();
  });

  it("disables the quote card when analysis is closed and keeps company search", () => {
    render(<LandingChoices quoteOpen={false} />);
    const closed = screen.getByRole("button", { name: new RegExp(LANDING_QUOTE_UNAVAILABLE_ZH) });
    expect((closed as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("link", { name: new RegExp(LANDING_QUOTE_TITLE_ZH) })).toBeNull();
    expect(screen.getByRole("link", { name: new RegExp(LANDING_SEARCH_TITLE_ZH) }).getAttribute("href")).toBe(
      "/#company-search",
    );
  });
});

// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: vi.fn(() => "/admin"),
}));

describe("SiteHeader on /admin", () => {
  it("does not render the mobile floating menu control", async () => {
    const { SiteHeader } = await import("@/components/SiteHeader");
    const { container } = render(<SiteHeader />);
    expect(container.innerHTML).toBe("");
  });
});

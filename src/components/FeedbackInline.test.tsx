// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { FeedbackInline } from "./FeedbackInline";
import {
  FEEDBACK_COMMENT_MAX,
  FEEDBACK_COMPANY_HEADING_ZH,
  FEEDBACK_DOWN_ZH,
  FEEDBACK_PLACEHOLDER_ZH,
  FEEDBACK_SUBMIT_ZH,
  FEEDBACK_THANKS_ZH,
  FEEDBACK_UP_ZH,
} from "@/lib/feedback-copy-zh";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function Harness({ initialDone = false }: { initialDone?: boolean }) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [comment, setComment] = useState("");
  const [done, setDone] = useState(initialDone);
  return (
    <FeedbackInline
      rating={rating}
      comment={comment}
      done={done}
      onRating={setRating}
      onComment={setComment}
      onSubmit={() => setDone(true)}
    />
  );
}

describe("FeedbackInline", () => {
  it("toggles aria-pressed, counts characters, and shows the done state", () => {
    render(<Harness />);

    expect(
      screen.getByRole("region", { name: FEEDBACK_COMPANY_HEADING_ZH }),
    ).toBeTruthy();
    expect(screen.queryByRole("textbox")).toBeNull();

    const up = screen.getByRole("button", { name: FEEDBACK_UP_ZH });
    const down = screen.getByRole("button", { name: FEEDBACK_DOWN_ZH });
    expect(up.getAttribute("aria-pressed")).toBe("false");
    expect(down.getAttribute("aria-pressed")).toBe("false");
    expect(up.className).toContain("min-h-11");
    expect(up.className).toContain("min-w-11");

    fireEvent.click(up);
    expect(up.getAttribute("aria-pressed")).toBe("true");
    expect(down.getAttribute("aria-pressed")).toBe("false");

    const field = screen.getByRole("textbox");
    expect(field.getAttribute("placeholder")).toBe(FEEDBACK_PLACEHOLDER_ZH);
    expect(field.getAttribute("maxlength")).toBe(String(FEEDBACK_COMMENT_MAX));
    fireEvent.change(field, { target: { value: "幾清楚" } });
    expect(screen.getByText(`3/${FEEDBACK_COMMENT_MAX}`)).toBeTruthy();

    fireEvent.click(down);
    expect(down.getAttribute("aria-pressed")).toBe("true");
    expect(up.getAttribute("aria-pressed")).toBe("false");

    fireEvent.click(up);
    expect(up.className).toContain("font-semibold");

    fireEvent.click(screen.getByRole("button", { name: FEEDBACK_SUBMIT_ZH }));
    const thanks = screen.getByText(FEEDBACK_THANKS_ZH);
    expect(thanks.closest("[aria-live]")?.getAttribute("aria-live")).toBe(
      "polite",
    );
    expect(document.activeElement).toBe(thanks);
    expect(screen.queryByRole("textbox")).toBeNull();
  });
});

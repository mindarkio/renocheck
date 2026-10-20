// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { FeedbackSlideIn } from "./FeedbackSlideIn";
import { ReportFeedback } from "./ReportFeedback";
import {
  FEEDBACK_CLOSE_LABEL_ZH,
  FEEDBACK_DISMISS_ZH,
  FEEDBACK_REGION_LABEL_ZH,
  FEEDBACK_THANKS_ZH,
  FEEDBACK_UP_ZH,
} from "@/lib/feedback-copy-zh";

const FP = "ab".repeat(16);

type Observed = {
  callback: IntersectionObserverCallback;
  elements: Element[];
};

const observers: Observed[] = [];

class MockIntersectionObserver implements IntersectionObserver {
  readonly root = null;
  readonly rootMargin = "";
  readonly thresholds = [0];
  readonly elements: Element[] = [];

  constructor(private readonly callback: IntersectionObserverCallback) {
    observers.push({ callback, elements: this.elements });
  }

  observe(target: Element) {
    this.elements.push(target);
  }

  unobserve(target: Element) {
    const index = this.elements.indexOf(target);
    if (index >= 0) this.elements.splice(index, 1);
  }

  disconnect() {
    this.elements.length = 0;
  }

  takeRecords(): IntersectionObserverEntry[] {
    return [];
  }
}

function emit(target: Element, ratio: number) {
  act(() => {
    for (const observer of observers) {
      if (!observer.elements.includes(target)) continue;
      observer.callback(
        [
          {
            isIntersecting: ratio > 0,
            intersectionRatio: ratio,
            target,
            boundingClientRect: target.getBoundingClientRect(),
            intersectionRect: target.getBoundingClientRect(),
            rootBounds: null,
            time: 0,
          },
        ],
        observers[0] as unknown as IntersectionObserver,
      );
    }
  });
}

function sentinel(): Element {
  const el = document.querySelector("[data-feedback-sentinel]");
  if (!el) throw new Error("missing sentinel");
  return el;
}

function inlineBox(): Element {
  const el = document.querySelector("[data-feedback-inline]");
  if (!el) throw new Error("missing inline");
  return el;
}

function slideOutOfView() {
  emit(inlineBox(), 0);
}

function showViaSentinel() {
  slideOutOfView();
  emit(sentinel(), 1);
}

beforeEach(() => {
  observers.length = 0;
  vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  localStorage.clear();
  sessionStorage.clear();
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(null, { status: 204 })),
  );
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => "visible",
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("FeedbackSlideIn", () => {
  it("does not steal focus, dismisses only from inside, and respects reduced motion", () => {
    const matchMedia = vi.fn().mockReturnValue({ matches: true });
    vi.stubGlobal("matchMedia", matchMedia);
    const onDismiss = vi.fn();
    const outside = document.createElement("button");
    outside.textContent = "外面";
    document.body.append(outside);
    outside.focus();

    render(
      <FeedbackSlideIn
        open
        rating={null}
        comment=""
        done={false}
        onRating={() => {}}
        onComment={() => {}}
        onSubmit={() => {}}
        onDismiss={onDismiss}
      />,
    );

    const region = screen.getByRole("region", { name: FEEDBACK_REGION_LABEL_ZH });
    expect(region.getAttribute("data-motion")).toBe("reduced");
    expect(document.activeElement).toBe(outside);
    expect(region.contains(document.activeElement)).toBe(false);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).not.toHaveBeenCalled();

    screen.getByRole("button", { name: FEEDBACK_CLOSE_LABEL_ZH }).focus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onDismiss).toHaveBeenCalledOnce();

    outside.remove();
  });

  it("dismisses from the close button and from 唔使喇", () => {
    const onDismiss = vi.fn();
    render(
      <FeedbackSlideIn
        open
        rating={null}
        comment=""
        done={false}
        onRating={() => {}}
        onComment={() => {}}
        onSubmit={() => {}}
        onDismiss={onDismiss}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: FEEDBACK_CLOSE_LABEL_ZH }));
    fireEvent.click(screen.getByRole("button", { name: FEEDBACK_DISMISS_ZH }));
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});

describe("ReportFeedback slide-in", () => {
  it("opens from the disclaimer sentinel or after 40s, once per report", () => {
    const { unmount } = render(<ReportFeedback fingerprint={FP} />);
    expect(screen.queryByRole("region", { name: FEEDBACK_REGION_LABEL_ZH })).toBeNull();
    expect(observers.length).toBeGreaterThan(0);

    showViaSentinel();
    expect(
      screen.getByRole("region", { name: FEEDBACK_REGION_LABEL_ZH }),
    ).toBeTruthy();
    expect(localStorage.getItem(`renocheck:fb:company_report:${FP}`)).toBe(
      "shown",
    );
    expect(document.activeElement === document.body || document.activeElement === null).toBe(
      true,
    );

    unmount();
    cleanup();
    observers.length = 0;
    localStorage.clear();

    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    render(<ReportFeedback fingerprint={FP} />);
    slideOutOfView();
    expect(screen.queryByRole("region", { name: FEEDBACK_REGION_LABEL_ZH })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(39_000);
    });
    expect(screen.queryByRole("region", { name: FEEDBACK_REGION_LABEL_ZH })).toBeNull();
    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(
      screen.getByRole("region", { name: FEEDBACK_REGION_LABEL_ZH }),
    ).toBeTruthy();
  });

  it("does not open again after shown, dismissed, or submitted", () => {
    for (const value of ["shown", "dismissed", "submitted"] as const) {
      localStorage.setItem(`renocheck:fb:company_report:${FP}`, value);
      const view = render(<ReportFeedback fingerprint={FP} />);
      showViaSentinel();
      expect(
        screen.queryByRole("region", { name: FEEDBACK_REGION_LABEL_ZH }),
      ).toBeNull();
      view.unmount();
      cleanup();
      observers.length = 0;
      localStorage.clear();
    }
  });

  it("pauses the 40s timer while the tab is hidden", () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
    let hidden = false;
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      get: () => (hidden ? "hidden" : "visible"),
    });
    render(<ReportFeedback fingerprint={FP} />);
    slideOutOfView();
    hidden = true;
    act(() => {
      vi.advanceTimersByTime(40_000);
    });
    expect(screen.queryByRole("region", { name: FEEDBACK_REGION_LABEL_ZH })).toBeNull();
    hidden = false;
    act(() => {
      vi.advanceTimersByTime(40_000);
    });
    expect(
      screen.getByRole("region", { name: FEEDBACK_REGION_LABEL_ZH }),
    ).toBeTruthy();
  });

  it("writes dismissed for ✕ and 唔使喇 and does not reopen", () => {
    render(<ReportFeedback fingerprint={FP} />);
    showViaSentinel();
    fireEvent.click(screen.getByRole("button", { name: FEEDBACK_CLOSE_LABEL_ZH }));
    expect(localStorage.getItem(`renocheck:fb:company_report:${FP}`)).toBe(
      "dismissed",
    );
    expect(screen.queryByRole("region", { name: FEEDBACK_REGION_LABEL_ZH })).toBeNull();

    localStorage.clear();
    cleanup();
    observers.length = 0;
    render(<ReportFeedback fingerprint={FP} />);
    showViaSentinel();
    fireEvent.click(screen.getByRole("button", { name: FEEDBACK_DISMISS_ZH }));
    expect(localStorage.getItem(`renocheck:fb:company_report:${FP}`)).toBe(
      "dismissed",
    );
  });

  it("hides the slide-in two seconds after a successful vote", async () => {
    render(<ReportFeedback fingerprint={FP} />);
    showViaSentinel();
    const region = screen.getByRole("region", { name: FEEDBACK_REGION_LABEL_ZH });
    expect(document.activeElement === document.body || !region.contains(document.activeElement)).toBe(
      true,
    );
    fireEvent.click(within(region).getByRole("button", { name: FEEDBACK_UP_ZH }));
    fireEvent.click(within(region).getByRole("button", { name: "送出" }));
    await waitFor(() => {
      expect(within(region).getByText(FEEDBACK_THANKS_ZH)).toBeTruthy();
    });
    expect(localStorage.getItem(`renocheck:fb:company_report:${FP}`)).toBe(
      "submitted",
    );
    await waitFor(
      () => {
        expect(
          screen.queryByRole("region", { name: FEEDBACK_REGION_LABEL_ZH }),
        ).toBeNull();
      },
      { timeout: 3_000 },
    );
    expect(screen.getByText(FEEDBACK_THANKS_ZH)).toBeTruthy();
  });

  it("falls back to sessionStorage when localStorage throws", () => {
    const denied = {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {
        throw new Error("denied");
      },
      removeItem: () => {
        throw new Error("denied");
      },
      clear: () => {},
      key: () => null,
      length: 0,
    };
    vi.stubGlobal("localStorage", denied);
    render(<ReportFeedback fingerprint={FP} />);
    showViaSentinel();
    expect(sessionStorage.getItem(`renocheck:fb:company_report:${FP}`)).toBe(
      "shown",
    );
    expect(
      screen.getByRole("region", { name: FEEDBACK_REGION_LABEL_ZH }),
    ).toBeTruthy();
  });
});

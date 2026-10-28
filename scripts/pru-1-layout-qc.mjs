#!/usr/bin/env node
/**
 * PRU-1 layout QC (local). Not part of `pnpm test`.
 * Usage: pnpm build && node scripts/pru-1-layout-qc.mjs
 * Output: .qc/pru-1/ (gitignored). Override with PRU_QC_OUT (must end in pru-1).
 * PRU_QC_BASE_URL must be localhost or 127.0.0.1.
 */
import { execSync, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, "..");
const defaultOut = path.join(repoRoot, ".qc", "pru-1");

function resolveOutDir() {
  const requested = process.env.PRU_QC_OUT
    ? path.resolve(process.env.PRU_QC_OUT)
    : defaultOut;
  if (path.basename(requested) !== "pru-1") {
    throw new Error(
      `QC output must be a directory named pru-1 (got ${requested})`,
    );
  }
  const home = process.env.HOME ? path.resolve(process.env.HOME) : "";
  if (home && (requested === home || requested.startsWith(path.join(home, "Desktop")))) {
    throw new Error(`refusing to use ${requested}`);
  }
  return requested;
}

const outDir = resolveOutDir();

const FIXTURES = [
  { id: "04272ad765a4dd910cf151aee5f04c23", file: "04272ad765a4dd910cf151aee5f04c23.json", label: "名富" },
  { id: "780b6902c105337959d12ec5464576d6", file: "780b6902c105337959d12ec5464576d6.json", label: "陳師傅" },
  { id: "a0000000000000000000000000000001", file: "HEAVY.json", label: "HEAVY" },
  { id: "b0000000000000000000000000000001", file: "DEGRADED.json", label: "DEGRADED" },
  { id: "c0000000000000000000000000000001", file: "MWC_MISS.json", label: "MWC_MISS" },
];

const VIEWPORTS = [
  { name: "1440x900", width: 1440, height: 900 },
  { name: "1280x800", width: 1280, height: 800 },
  { name: "1024x768", width: 1024, height: 768 },
  { name: "390x844", width: 390, height: 844 },
];

const STATIC_VIEWPORTS = VIEWPORTS.filter((vp) => vp.width !== 1024);

const STATIC_PAGES = [
  { name: "home", path: "/" },
  { name: "faq", path: "/faq" },
  { name: "about", path: "/about" },
  { name: "quote", path: "/quote" },
  {
    name: "guide-contract-clauses",
    path: "/guides/renovation-contract-clauses-hong-kong",
  },
  {
    name: "guide-compare-quotes",
    path: "/guides/renovation-quote-timing-compare-three",
  },
  {
    name: "guide-warning-signs",
    path: "/guides/renovation-warning-signs-without-blacklist",
  },
];

const CORAL = [255, 143, 125];

function assertLocalBase(baseUrl) {
  let url;
  try {
    url = new URL(baseUrl);
  } catch {
    throw new Error(`PRU_QC_BASE_URL is not a URL: ${baseUrl}`);
  }
  if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new Error(
      `PRU_QC_BASE_URL must be localhost or 127.0.0.1 (got ${url.hostname})`,
    );
  }
  return url.origin;
}

function loadFixture(file) {
  return JSON.parse(
    readFileSync(
      path.join(repoRoot, "src/test-fixtures/reports", file),
      "utf8",
    ),
  );
}

function qcEnv(port) {
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (value == null) continue;
    if (
      /KEY|SECRET|TOKEN|PASSWORD|SUPABASE|DATABASE|POSTGRES|SERPER|GEMINI|OPENAI|API|PIN|CREDENTIAL/i.test(
        key,
      )
    ) {
      continue;
    }
    env[key] = value;
  }
  env.PORT = String(port);
  env.FEEDBACK_ENABLED = "1";
  env.NEXT_PUBLIC_SITE_URL = `http://127.0.0.1:${port}`;
  return env;
}

function inRange(v, min, max) {
  return typeof v === "number" && v >= min && v <= max;
}

function record(criteria, key, pass, actual, expected) {
  criteria.push({ key, pass: Boolean(pass), actual, expected });
}

function clearOutDir() {
  const resolved = path.resolve(outDir);
  if (path.basename(resolved) !== "pru-1") {
    throw new Error(`refusing to clear ${resolved}`);
  }
  mkdirSync(resolved, { recursive: true });
  for (const name of readdirSync(resolved)) {
    rmSync(path.join(resolved, name), { recursive: true, force: true });
  }
}

function stopServer(child) {
  // pnpm does not forward SIGTERM to next-server; kill the whole group.
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    child.kill("SIGTERM");
  }
}

async function ensureServer(baseUrl, port) {
  try {
    const res = await fetch(`${baseUrl}/api/health`);
    if (res.ok) return null;
  } catch {
    // start below
  }
  const envFiles = [".env", ".env.local", ".env.production", ".env.production.local"]
    .filter((name) => existsSync(path.join(repoRoot, name)));
  if (envFiles.length) {
    // next start loads these itself, bypassing qcEnv(); never boot QC on real credentials.
    throw new Error(
      `refusing to start QC server: ${envFiles.join(", ")} present in ${repoRoot}`,
    );
  }
  const child = spawn("pnpm", ["start"], {
    cwd: repoRoot,
    stdio: "inherit",
    env: qcEnv(port),
    detached: true,
  });
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}/api/health`);
      if (res.ok) return child;
    } catch {
      // still booting
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  stopServer(child);
  throw new Error(`server did not become ready at ${baseUrl}`);
}

async function collectPage(page) {
  return page.evaluate(() => {
    const isSrOnly = (el) => {
      if (!el) return false;
      if (el.closest(".sr-only")) return true;
      const s = getComputedStyle(el);
      const w = parseFloat(s.width);
      const h = parseFloat(s.height);
      return s.position === "absolute" && w <= 1 && h <= 1;
    };

    const hidden = (el) => {
      const s = getComputedStyle(el);
      return (
        s.display === "none" ||
        s.visibility === "hidden" ||
        isSrOnly(el)
      );
    };

    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const resolveColor = (css) => {
      if (!css || css === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
      ctx.clearRect(0, 0, 1, 1);
      ctx.globalCompositeOperation = "source-over";
      ctx.fillStyle = "#010101";
      ctx.fillRect(0, 0, 1, 1);
      ctx.clearRect(0, 0, 1, 1);
      try {
        ctx.fillStyle = css;
      } catch {
        return null;
      }
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      return { r: d[0], g: d[1], b: d[2], a: d[3] / 255 };
    };

    const relL = ([r, g, b]) => {
      const srgb = [r, g, b].map((c) => {
        const v = c / 255;
        return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
    };

    const contrast = (fg, bg) => {
      const l1 = relL(fg);
      const l2 = relL(bg);
      const lighter = Math.max(l1, l2);
      const darker = Math.min(l1, l2);
      return (lighter + 0.05) / (darker + 0.05);
    };

    const ancestorOpacity = (el) => {
      let a = 1;
      for (let n = el; n; n = n.parentElement) {
        const o = parseFloat(getComputedStyle(n).opacity);
        if (Number.isFinite(o)) a *= o;
      }
      return a;
    };

    const blend = (fg, bg) => {
      const a = fg.a;
      return [
        fg.r * a + bg[0] * (1 - a),
        fg.g * a + bg[1] * (1 - a),
        fg.b * a + bg[2] * (1 - a),
      ];
    };

    const effectiveBg = (el) => {
      const layers = [];
      for (let n = el; n; n = n.parentElement) {
        const parsed = resolveColor(getComputedStyle(n).backgroundColor);
        if (parsed && parsed.a > 0.01) layers.push(parsed);
        if (parsed && parsed.a >= 0.99) break;
      }
      let acc = [255, 255, 255];
      for (let i = layers.length - 1; i >= 0; i--) {
        acc = blend(layers[i], acc);
      }
      return acc;
    };

    const sampleEl = (el, text) => {
      const s = getComputedStyle(el);
      const parsed = resolveColor(s.color);
      if (!parsed) return null;
      const opacity = ancestorOpacity(el);
      const fg = { ...parsed, a: parsed.a * opacity };
      const bg = effectiveBg(el);
      const shown = blend(fg, bg);
      const ratio = contrast(shown, bg);
      return {
        px: parseFloat(s.fontSize),
        ratio,
        text: text.trim().slice(0, 40),
        tag: el.tagName,
        rgb: shown.map((n) => Math.round(n)),
        cls: el.className?.toString?.().slice(0, 140) ?? "",
      };
    };

    const samples = [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent ?? "";
      if (!text.trim()) continue;
      const el = node.parentElement;
      if (!el || hidden(el)) continue;
      const sample = sampleEl(el, text);
      if (sample && Number.isFinite(sample.px)) samples.push(sample);
    }

    const fontOf = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      return { px: parseFloat(s.fontSize), line: parseFloat(s.lineHeight) };
    };

    const cw = (el) => {
      if (!el) return null;
      const s = getComputedStyle(el);
      return el.clientWidth - parseFloat(s.paddingLeft) - parseFloat(s.paddingRight);
    };

    const container = document.querySelector("[data-testid=report-layout-container]");
    const grid = document.querySelector("[data-testid=report-layout-grid]");
    const mainCol = document.querySelector("[data-testid=report-main-column]");
    const sidebar = document.querySelector("[data-testid=report-layout-sidebar]");
    const panel = document.querySelector("[data-testid=legal-events-panel]");
    const headerNav = document.querySelector("[data-testid=site-header-nav]");
    const logo = headerNav?.querySelector("img");
    const wordmark = document.querySelector("[data-testid=site-header-wordmark]");
    const navLinks = headerNav?.querySelector("[class*='sm:flex']");

    const highlightCards = [
      ...document.querySelectorAll("section[aria-labelledby^='highlight-title-']"),
    ];
    const highlightLefts = highlightCards.map((el) => el.getBoundingClientRect().left);
    const lastHighlight = highlightCards[highlightCards.length - 1];
    const lastSpanTwo = lastHighlight?.className.includes("lg:col-span-2") ?? false;
    const lastInner = lastHighlight
      ? [...lastHighlight.querySelectorAll("p")].find((p) =>
          (p.className?.toString?.() ?? "").includes("max-w-"),
        )
      : null;

    const legalCards = [...document.querySelectorAll("[data-testid=legal-event-card]")];
    const legalFieldCounts = legalCards.map(
      (card) => card.querySelectorAll("dl dt").length,
    );
    const legalCardHeights = legalCards.map(
      (card) => card.getBoundingClientRect().height,
    );

    const identitySection = document.querySelector("#cr-identity-heading")?.closest("section");
    const identityHeight = identitySection?.getBoundingClientRect().height ?? null;
    const dtDdPairs = identitySection
      ? [...identitySection.querySelectorAll("dl > div")]
          .filter((row) => {
            if (row.querySelector("button")) return false;
            const dd = row.querySelector("dd");
            if (!dd) return false;
            const lh = parseFloat(getComputedStyle(dd).lineHeight);
            return dd.getBoundingClientRect().height <= lh * 1.25;
          })
          .map((row) => {
            const dt = row.querySelector("dt");
            const dd = row.querySelector("dd");
            const dtTop = dt?.getBoundingClientRect().top ?? 0;
            const ddTop = dd?.getBoundingClientRect().top ?? dtTop;
            return Math.abs(dtTop - ddTop);
          })
      : [];

    const externalLinks = [...document.querySelectorAll("main a[target='_blank']")]
      .filter((a) => !hidden(a) && a.getAttribute("role") !== "button")
      .map((a) => a.getBoundingClientRect().height);

    const bodyPs = [...document.querySelectorAll("main p")]
      .filter((p) => !hidden(p))
      .map((p) => p.getBoundingClientRect().width);

    const checklist = document.querySelector("#checklist-heading")?.closest("section");
    const nextSteps = document.querySelector("#next-steps-heading")?.closest("section");
    const sectionGap =
      checklist && nextSteps
        ? nextSteps.getBoundingClientRect().top - checklist.getBoundingClientRect().bottom
        : null;

    const group = [...(mainCol?.children ?? [])].find((el) =>
      (el.className?.toString?.() ?? "").includes("space-y-10"),
    );
    const groupKids = group
      ? [...group.children].filter((el) => el.getBoundingClientRect().height > 0)
      : [];
    const groupGap =
      groupKids.length >= 2
        ? groupKids[1].getBoundingClientRect().top -
          groupKids[0].getBoundingClientRect().bottom
        : null;

    const rating = document.querySelector("[data-feedback-inline]");
    const slide = document.querySelector("#report-feedback-slide");
    const legalHeading = document.querySelector("#legal-events-heading");
    const tocLink = [
      ...document.querySelectorAll("[data-testid=report-sidebar-toc] a"),
    ].some((a) => (a.getAttribute("href") ?? "") === "#legal-events-heading");

    const vw = window.innerWidth;
    let overflowRight = null;
    for (const el of document.body.querySelectorAll("*")) {
      if (hidden(el)) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      if (r.right > vw + 1) {
        overflowRight = {
          tag: el.tagName,
          right: Math.round(r.right * 10) / 10,
          text: (el.textContent ?? "").trim().slice(0, 40),
        };
        break;
      }
    }

    const smallest = [...samples].sort((a, b) => a.px - b.px)[0] ?? null;
    const hero = document.querySelector("article header.bg-primary");
    const siteFooter = document.querySelector("body > footer");
    const regionOf = (el) => {
      if (hero && hero.contains(el)) return "hero";
      if (siteFooter && siteFooter.contains(el)) return "footer";
      if (el.closest("[role=img]")) return "meter";
      return "other";
    };

    const tagged = [];
    const walker2 = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (walker2.nextNode()) {
      const node = walker2.currentNode;
      const text = node.textContent ?? "";
      if (!text.trim()) continue;
      const el = node.parentElement;
      if (!el || hidden(el)) continue;
      const sample = samples.find(
        (s) => s.text === text.trim().slice(0, 40) && s.tag === el.tagName,
      );
      if (!sample) continue;
      tagged.push({ ...sample, region: regionOf(el) });
    }

    const logoLink = document.querySelector("[data-testid=site-header-logo]");
    const logoImg = logoLink?.querySelector("img");
    const logoA11y = logoLink
      ? {
          alt: logoImg?.getAttribute("alt") ?? null,
          ariaLabel: logoLink.getAttribute("aria-label"),
          text: (logoLink.innerText ?? "").replace(/\s+/g, " ").trim(),
        }
      : null;

    const logoBox = logo?.getBoundingClientRect();
    const navBox = headerNav?.getBoundingClientRect();
    const linksBox = navLinks?.getBoundingClientRect();
    const containerBox = container?.getBoundingClientRect();
    const mainBox = mainCol?.getBoundingClientRect();
    const sideBox = sidebar?.getBoundingClientRect();
    const wordBox = wordmark?.getBoundingClientRect();
    const wordSample = wordmark && !hidden(wordmark) ? sampleEl(wordmark, wordmark.textContent ?? "") : null;

    const sidebarStyle = sidebar ? getComputedStyle(sidebar) : null;

    return {
      containerContentWidth: grid?.getBoundingClientRect().width ?? cw(container),
      mainWidth: mainBox?.width ?? null,
      sidebarWidth: sideBox?.width ?? null,
      panelWidth: panel?.getBoundingClientRect().width ?? null,
      gutter:
        mainBox && sideBox ? sideBox.left - mainBox.right : null,
      headerNavLeft: navBox?.left ?? null,
      headerNavRight: navBox?.right ?? null,
      logoLeft: logoBox?.left ?? null,
      navRight: linksBox?.right ?? null,
      containerLeft: containerBox?.left ?? null,
      containerRight: containerBox?.right ?? null,
      logoHeight: logoBox?.height ?? null,
      logoA11y,
      wordmark: wordSample
        ? { ...wordSample, height: wordBox?.height ?? null }
        : null,
      h1: fontOf(document.querySelector("h1")),
      h2: fontOf(document.querySelector("#checklist-heading")),
      identityH2: fontOf(document.querySelector("#cr-identity-heading")),
      bodyP: fontOf(document.querySelector("article header p[class*='max-w-']")),
      h1Count: document.querySelectorAll("h1").length,
      scrollWidth: document.documentElement.scrollWidth,
      overflowRight,
      minFontPx: smallest?.px ?? null,
      smallestTextNode: smallest,
      highlightCount: highlightCards.length,
      highlightLefts,
      highlightSingleColumn:
        highlightLefts.length > 1
          ? highlightLefts.every((l) => Math.abs(l - highlightLefts[0]) < 1)
          : highlightLefts.length <= 1,
      lastHighlightSpansTwoCols: lastSpanTwo,
      lastHighlightWidth: lastHighlight?.getBoundingClientRect().width ?? null,
      lastHighlightInnerWidth: lastInner?.getBoundingClientRect().width ?? null,
      lastHighlightInnerFontPx: lastInner
        ? Number.parseFloat(getComputedStyle(lastInner).fontSize)
        : null,
      legalFieldCounts,
      legalCardHeights,
      identityHeight,
      dtDdTopDelta: dtDdPairs,
      externalLinkHeights: externalLinks,
      bodyPMaxWidth: bodyPs.length ? Math.max(...bodyPs) : null,
      sectionGap,
      groupGap,
      ratingLeft: rating?.getBoundingClientRect().left ?? null,
      mainLeft: mainBox?.left ?? null,
      slideWidth: slide ? slide.getBoundingClientRect().width : null,
      legalHeadingText: legalHeading?.textContent?.trim() ?? null,
      tocHasLegal: tocLink,
      samples: tagged,
      sidebarOverflowY: sidebarStyle?.overflowY ?? null,
      sidebarMaxHeight: sidebarStyle?.maxHeight ?? null,
    };
  });
}

function near(a, b, tol = 8) {
  return (
    Math.abs(a[0] - b[0]) <= tol &&
    Math.abs(a[1] - b[1]) <= tol &&
    Math.abs(a[2] - b[2]) <= tol
  );
}

function applyContrastCriteria(criteria, metrics) {
  const samples = metrics.samples ?? [];
  const groups = {
    hero: samples.filter((s) => s.region === "hero"),
    footer: samples.filter((s) => s.region === "footer"),
    meter: samples.filter((s) => s.region === "meter" || s.text === "中等" || s.text === "偏高" || s.text === "未見負面"),
    hashtag: samples.filter((s) => s.text.startsWith("#")),
    registry: samples.filter((s) => s.text.includes("名冊摘錄")),
  };

  const isCoral = (s) => near(s.rgb, CORAL, 18);
  const knownMeter = (s) => s.text === "中等" && isCoral(s) && s.px < 24;

  const worstOf = (list, pred) => {
    let worst = null;
    for (const s of list) {
      if (pred && !pred(s)) continue;
      if (knownMeter(s)) continue;
      const need = s.px >= 24 ? 3 : 4.5;
      if (!worst || s.ratio < worst.ratio) worst = { ...s, need };
    }
    return worst;
  };

  const heroSmall = worstOf(groups.hero, (s) => s.px < 24);
  const heroLarge = worstOf(groups.hero, (s) => s.px >= 24);
  if (heroSmall) {
    record(
      criteria,
      "heroContrastUnder24",
      heroSmall.ratio >= 4.5,
      { ratio: round2(heroSmall.ratio), px: heroSmall.px, text: heroSmall.text },
      "≥4.5:1",
    );
  }
  if (heroLarge) {
    record(
      criteria,
      "heroContrastAtLeast24",
      heroLarge.ratio >= 3,
      { ratio: round2(heroLarge.ratio), px: heroLarge.px, text: heroLarge.text },
      "≥3:1",
    );
  }

  for (const [key, list, label] of [
    ["footerContrast", groups.footer, "footer"],
    ["meterLabelContrast", groups.meter, "meter"],
    ["hashtagContrast", groups.hashtag, "hashtag"],
    ["registryDateContrast", groups.registry, "registry date"],
  ]) {
    const worst = worstOf(list);
    if (!worst && key !== "hashtagContrast" && key !== "registryDateContrast") continue;
    if (!worst) {
      record(criteria, key, true, "n/a", label);
      continue;
    }
    record(
      criteria,
      key,
      worst.ratio >= worst.need,
      { ratio: round2(worst.ratio), px: worst.px, text: worst.text, need: worst.need },
      `≥${worst.need}:1`,
    );
  }

  const coralSmall = samples.filter((s) => isCoral(s) && s.px < 24 && !knownMeter(s));
  record(
    criteria,
    "coralOnlyAtLeast24",
    coralSmall.length === 0,
    coralSmall.slice(0, 3).map((s) => ({ text: s.text, px: s.px, ratio: round2(s.ratio) })),
    "no coral text <24px except known meter exception",
  );

  const exception = samples.find(knownMeter);
  record(
    criteria,
    "coralMeterKnownException",
    true,
    exception
      ? { ratio: round2(exception.ratio), px: exception.px, text: exception.text, note: "Aaron 2026-10-21" }
      : "not on this page",
    "known exception, not a fail",
  );
}

function recordWordmark(criteria, metrics) {
  if (metrics.wordmark) {
    record(
      criteria,
      "wordmarkFont",
      metrics.wordmark.px >= 12,
      round2(metrics.wordmark.px),
      "≥12px",
    );
    record(
      criteria,
      "wordmarkContrast",
      metrics.wordmark.ratio >= (metrics.wordmark.px >= 24 ? 3 : 4.5),
      { ratio: round2(metrics.wordmark.ratio), text: metrics.wordmark.text },
      "≥4.5:1 under 24px",
    );
  }
  const a11y = metrics.logoA11y;
  if (a11y) {
    const once = a11y.text === "裝修點評";
    record(
      criteria,
      "logoAccessibleName",
      a11y.alt === "" && !a11y.ariaLabel && once,
      a11y,
      "visible 裝修點評 once; img alt empty; no aria-label",
    );
  }
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function applyLayoutCriteria(criteria, metrics, vp, fp) {
  const desktop = vp.width >= 1024;
  if (vp.width >= 1440) {
    record(criteria, "containerContentWidth", inRange(metrics.containerContentWidth, 1199, 1201), round2(metrics.containerContentWidth), "1200±1");
    record(criteria, "mainWidth", inRange(metrics.mainWidth, 784, 792), round2(metrics.mainWidth), "784–792");
    record(criteria, "sidebarWidth", inRange(metrics.sidebarWidth, 384, 392), round2(metrics.sidebarWidth), "384–392");
    record(criteria, "gutter", inRange(metrics.gutter, 23, 25), round2(metrics.gutter), "24");
  } else if (vp.width >= 1280) {
    record(criteria, "containerContentWidth", inRange(metrics.containerContentWidth, 1119, 1121), round2(metrics.containerContentWidth), "1120±1");
    record(criteria, "mainWidth", inRange(metrics.mainWidth, 730, 740), round2(metrics.mainWidth), "730–740");
    record(criteria, "sidebarWidth", inRange(metrics.sidebarWidth, 355, 365), round2(metrics.sidebarWidth), "355–365");
    record(criteria, "gutter", true, round2(metrics.gutter), "實數");
  } else if (vp.width >= 1024) {
    record(criteria, "containerContentWidth", Number.isFinite(metrics.containerContentWidth), round2(metrics.containerContentWidth), "1024 實數");
    record(criteria, "mainWidth", Number.isFinite(metrics.mainWidth), round2(metrics.mainWidth), "1024 實數");
    record(criteria, "sidebarWidth", Number.isFinite(metrics.sidebarWidth), round2(metrics.sidebarWidth), "1024 實數");
    record(criteria, "gutter", Number.isFinite(metrics.gutter), round2(metrics.gutter), "1024 實數");
  } else if (vp.width === 390) {
    record(criteria, "mainWidth", inRange(metrics.mainWidth, 357, 359), round2(metrics.mainWidth), "358");
    record(criteria, "scrollWidth", metrics.scrollWidth === 390, metrics.scrollWidth, "390");
    record(criteria, "noRightOverflow", metrics.overflowRight == null, metrics.overflowRight, "no element past right edge");
  }

  const alignTargetLeft = metrics.containerLeft ?? metrics.headerNavLeft;
  const alignTargetRight = metrics.containerRight ?? metrics.headerNavRight;
  const alignL = Math.abs((metrics.logoLeft ?? 0) - (alignTargetLeft ?? 0));
  const alignR = Math.abs((metrics.navRight ?? 0) - (alignTargetRight ?? 0));
  record(criteria, "headerAlignLeft", alignL <= 1, round2(alignL), "logo left = container ±1");
  if (desktop) {
    record(criteria, "headerAlignRight", alignR <= 1, round2(alignR), "nav right = container ±1");
    record(criteria, "logoHeightDesktop", inRange(metrics.logoHeight, 28, 32), round2(metrics.logoHeight), "28–32");
  } else {
    record(criteria, "logoHeightMobile", inRange(metrics.logoHeight, 24, 28), round2(metrics.logoHeight), "24–28");
  }
  recordWordmark(criteria, metrics);

  record(criteria, "h1Count", metrics.h1Count === 1, metrics.h1Count, "1");
  if (desktop) {
    record(criteria, "h1Font", metrics.h1?.px === 28, metrics.h1, "28px");
    record(criteria, "h2Font", metrics.h2?.px === 20, metrics.h2, "20px section heading");
    record(criteria, "bodyFont", metrics.bodyP?.px === 16, metrics.bodyP, "16px");
    record(criteria, "sectionGapDesktop", inRange(metrics.sectionGap, 46, 50), round2(metrics.sectionGap), "48±2");
    record(criteria, "groupGapDesktop", inRange(metrics.groupGap, 62, 66), round2(metrics.groupGap), "64±2");
  } else {
    record(criteria, "h1Font", metrics.h1?.px === 22, metrics.h1, "22px");
    record(criteria, "h2Font", metrics.h2?.px === 18, metrics.h2, "18px section heading");
    record(criteria, "bodyFont", metrics.bodyP?.px === 15, metrics.bodyP, "15px");
    record(criteria, "sectionGapMobile", inRange(metrics.sectionGap, 30, 34), round2(metrics.sectionGap), "32±2");
    record(criteria, "groupGapMobile", inRange(metrics.groupGap, 38, 42), round2(metrics.groupGap), "40±2");
  }
  record(
    criteria,
    "minFont12",
    metrics.minFontPx >= 12,
    { min: metrics.minFontPx, node: metrics.smallestTextNode },
    "≥12px excluding sr-only",
  );
  record(
    criteria,
    "bodyPMaxWidth",
    metrics.bodyPMaxWidth == null || metrics.bodyPMaxWidth <= 640,
    round2(metrics.bodyPMaxWidth),
    "≤640",
  );

  if (fp.label === "名富" && (vp.width === 1440 || vp.width === 1280)) {
    const diff = Math.abs((metrics.panelWidth ?? 0) - (metrics.mainWidth ?? 0));
    record(criteria, "legalPanelVsMain", diff <= 1, { panel: round2(metrics.panelWidth), main: round2(metrics.mainWidth) }, "±1px");
    record(
      criteria,
      "legalCard8Fields",
      metrics.legalFieldCounts.length > 0 && metrics.legalFieldCounts.every((n) => n === 8),
      metrics.legalFieldCounts,
      "each card 8 fields",
    );
  }

  if (fp.label === "HEAVY" && vp.width === 1440) {
    const maxH = Math.max(...(metrics.legalCardHeights ?? [0]));
    record(
      criteria,
      "heavyLegalCardHeight",
      metrics.legalCardHeights.length > 0 && metrics.legalCardHeights.every((h) => h <= 140),
      metrics.legalCardHeights.map(round2),
      "≤140px",
    );
    record(criteria, "highlightsTwoCol", metrics.highlightCount > 1 && !metrics.highlightSingleColumn, metrics.highlightLefts, "2 columns");
    const widthDiff = Math.abs((metrics.lastHighlightWidth ?? 0) - (metrics.mainWidth ?? 0));
    record(criteria, "highlightLastFullWidth", metrics.lastHighlightSpansTwoCols && widthDiff <= 1, { card: round2(metrics.lastHighlightWidth), main: round2(metrics.mainWidth), span: metrics.lastHighlightSpansTwoCols }, "width = main ±1");
    const innerW = metrics.lastHighlightInnerWidth;
    const em40 =
      metrics.lastHighlightInnerFontPx == null
        ? null
        : metrics.lastHighlightInnerFontPx * 40;
    record(
      criteria,
      "highlightInnerMax",
      innerW != null && em40 != null && innerW <= em40 + 0.5,
      innerW == null ? "none" : { width: round2(innerW), em40: round2(em40) },
      "body present and ≤40em",
    );
    void maxH;
  }
  if (fp.label === "HEAVY" && vp.width === 1280) {
    record(criteria, "highlightsTwoCol", metrics.highlightCount > 1 && !metrics.highlightSingleColumn, metrics.highlightLefts, "2 columns");
    const widthDiff = Math.abs((metrics.lastHighlightWidth ?? 0) - (metrics.mainWidth ?? 0));
    record(criteria, "highlightLastFullWidth", metrics.lastHighlightSpansTwoCols && widthDiff <= 1, { card: round2(metrics.lastHighlightWidth), main: round2(metrics.mainWidth) }, "width = main ±1");
  }
  if (fp.label === "HEAVY" && vp.width === 390) {
    record(criteria, "highlightsOneCol", metrics.highlightSingleColumn, metrics.highlightLefts, "same left");
  }

  if (fp.label === "名富" && vp.width === 390) {
    record(
      criteria,
      "identityDtDdAlign",
      metrics.dtDdTopDelta.length > 0 && metrics.dtDdTopDelta.every((d) => d <= 2),
      metrics.dtDdTopDelta.map(round2),
      "±2px",
    );
    record(criteria, "identityHeight", metrics.identityHeight != null && metrics.identityHeight <= 320, round2(metrics.identityHeight), "≤320");
  }

  if (vp.width === 390) {
    const heights = (metrics.externalLinkHeights ?? []).filter((h) => h > 0);
    const minLink = heights.length ? Math.min(...heights) : null;
    record(criteria, "externalLinkMinHeight", minLink != null && minLink >= 44, round2(minLink), "≥44px");
  }

  if (desktop && metrics.ratingLeft != null && metrics.mainLeft != null) {
    const diff = Math.abs(metrics.ratingLeft - metrics.mainLeft);
    record(criteria, "ratingCardLeft", diff <= 1, round2(diff), "rating left = main left ±1");
  } else if (desktop) {
    record(criteria, "ratingCardLeft", false, "rating card not rendered", "rating left = main left ±1");
  }

  if (fp.label === "DEGRADED") {
    const headingOk = (metrics.legalHeadingText ?? "").includes("公開判詞紀錄");
    record(criteria, "degradedLegalSection", headingOk, metrics.legalHeadingText, "公開判詞紀錄 section");
    record(criteria, "degradedTocItem", metrics.tocHasLegal === true, metrics.tocHasLegal, "ToC #legal-events-heading");
  }

  applyContrastCriteria(criteria, metrics);
}

async function measureSidebar(page, criteria) {
  for (const scrollY of [1500, null]) {
    if (scrollY !== null) {
      await page.evaluate((y) => window.scrollTo(0, y), scrollY);
    } else {
      const maxY = await page.evaluate(
        () => document.documentElement.scrollHeight - window.innerHeight - 300,
      );
      await page.evaluate((y) => window.scrollTo(0, Math.max(0, y)), maxY);
    }
    await page.waitForTimeout(50);
    const box = await page.evaluate(() => {
      const aside = document.querySelector("[data-testid=report-layout-sidebar]");
      const footer = document.querySelector("body > footer");
      if (!aside) return null;
      const a = aside.getBoundingClientRect();
      const f = footer?.getBoundingClientRect();
      const s = getComputedStyle(aside);
      const overlaps = f ? a.bottom > f.top + 1 && a.top < f.bottom : false;
      return {
        top: a.top,
        overflowY: s.overflowY,
        maxHeight: s.maxHeight,
        overlaps,
      };
    });
    const label = scrollY === 1500 ? "sidebarTopScroll1500" : "sidebarTopNearFooter";
    record(criteria, label, box && inRange(box.top, 86, 90), box?.top ?? null, "88±2");
    if (scrollY === null) {
      record(criteria, "sidebarNoFooterOverlap", box ? !box.overlaps : false, box, "does not cover footer");
      record(
        criteria,
        "sidebarInternalScroll",
        box ? (box.overflowY === "auto" || box.overflowY === "scroll") && box.maxHeight !== "none" : false,
        box ? { overflowY: box.overflowY, maxHeight: box.maxHeight } : null,
        "overflow-y auto and max-height set",
      );
    }
  }
}

async function measureReportPage(page, fp, vp, baseUrl) {
  const criteria = [];
  const payload = loadFixture(fp.file);
  await page.route(`**/api/report/${fp.id}`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(payload),
    });
  });
  await page.goto(`${baseUrl}/report/${fp.id}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForSelector("h1", { timeout: 20000 });

  const shot = path.join(outDir, `report-${fp.label}-${vp.name}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  const metrics = await collectPage(page);
  applyLayoutCriteria(criteria, metrics, vp, fp);
  if (vp.width >= 1024) await measureSidebar(page, criteria);

  return {
    fixture: fp.label,
    id: fp.id,
    viewport: vp.name,
    screenshot: shot,
    metrics,
    criteria,
  };
}

const QUOTE_NAV_LABEL = "報價內容指南";

async function quoteShellMetrics(page) {
  return page.evaluate((label) => {
    const headerNav = document.querySelector("[data-testid=site-header-nav]");
    const desktopRow = headerNav?.querySelector("[class*='sm:flex']") ?? null;
    const headerQuote = desktopRow
      ? [...desktopRow.querySelectorAll("a")].find((a) => a.getAttribute("href") === "/quote")
      : null;
    const footerQuote = [...document.querySelectorAll("footer a")].find(
      (a) => a.getAttribute("href") === "/quote",
    );
    const visible = (el) => {
      if (!el) return false;
      const s = getComputedStyle(el);
      return s.display !== "none" && s.visibility !== "hidden";
    };
    const rowLinks = desktopRow ? [...desktopRow.querySelectorAll("a")] : [];
    const visibleLinks = rowLinks.filter(visible);
    const tops = visibleLinks.map((a) => Math.round(a.getBoundingClientRect().top));
    const menuButton = headerNav?.querySelector("button[aria-label='開啟選單'], button[aria-expanded]");
    return {
      headerLabel: headerQuote?.textContent?.trim() ?? null,
      headerCurrent: headerQuote?.getAttribute("aria-current") ?? null,
      headerMinH: (headerQuote?.className ?? "").includes("min-h-11"),
      headerFocus: (headerQuote?.className ?? "").includes("focus-visible:ring-2"),
      desktopDisplay: desktopRow ? getComputedStyle(desktopRow).display : null,
      linkTops: tops,
      linkHeights: visibleLinks.map((a) => Math.round(a.getBoundingClientRect().height)),
      menuButtonVisible: visible(menuButton),
      footerLabel: footerQuote?.textContent?.trim() ?? null,
      footerCurrent: footerQuote?.getAttribute("aria-current") ?? null,
      footerHeight: footerQuote ? Math.round(footerQuote.getBoundingClientRect().height) : null,
      footerFocus: (footerQuote?.className ?? "").includes("focus-visible:ring-2"),
      expected: label,
    };
  }, QUOTE_NAV_LABEL);
}

function recordQuoteShell(criteria, shell, vp, path) {
  record(criteria, "quoteHeaderLabel", shell.headerLabel === shell.expected, shell.headerLabel, shell.expected);
  record(criteria, "quoteFooterLabel", shell.footerLabel === shell.expected, shell.footerLabel, shell.expected);
  record(criteria, "quoteHeaderFocus", shell.headerFocus, shell.headerFocus, "focus-visible ring");
  record(criteria, "quoteFooterFocus", shell.footerFocus, shell.footerFocus, "focus-visible ring");
  const onQuote = path === "/quote";
  record(
    criteria,
    "quoteHeaderCurrent",
    onQuote ? shell.headerCurrent === "page" : shell.headerCurrent == null,
    shell.headerCurrent,
    onQuote ? "page" : "absent",
  );
  record(
    criteria,
    "quoteFooterCurrent",
    onQuote ? shell.footerCurrent === "page" : shell.footerCurrent == null,
    shell.footerCurrent,
    onQuote ? "page" : "absent",
  );
  if (vp.width >= 1024) {
    const oneRow = shell.linkTops.length > 0 && shell.linkTops.every((top) => top === shell.linkTops[0]);
    const tall = shell.linkHeights.length > 0 && shell.linkHeights.every((h) => h >= 44);
    record(criteria, "headerNavOneRow", shell.desktopDisplay === "flex" && oneRow, shell.linkTops, "one row");
    record(criteria, "headerNavTap", shell.headerMinH && tall, shell.linkHeights, "≥44px");
    record(criteria, "mobileMenuButtonHidden", shell.menuButtonVisible === false, shell.menuButtonVisible, "hidden at desktop");
  } else if (vp.width === 390) {
    record(criteria, "desktopNavHidden", shell.desktopDisplay === "none", shell.desktopDisplay, "none");
    record(criteria, "mobileMenuButtonVisible", shell.menuButtonVisible === true, shell.menuButtonVisible, "hamburger");
    record(criteria, "footerQuoteTap", shell.footerHeight != null && shell.footerHeight >= 44, shell.footerHeight, "≥44px");
  }
}

async function measureStaticPage(page, sp, vp, baseUrl) {
  const criteria = [];
  await page.goto(`${baseUrl}${sp.path}`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForSelector("[data-testid=site-header-nav]", { timeout: 15000 });
  const shot = path.join(outDir, `static-${sp.name}-${vp.name}.png`);
  await page.screenshot({ path: shot, fullPage: true });
  const metrics = await collectPage(page);
  record(
    criteria,
    "scrollWidth",
    metrics.scrollWidth <= vp.width,
    metrics.scrollWidth,
    `≤${vp.width}`,
  );
  record(
    criteria,
    "noRightOverflow",
    metrics.overflowRight == null,
    metrics.overflowRight,
    "no element past right edge",
  );
  const alignL = Math.abs((metrics.logoLeft ?? 0) - (metrics.headerNavLeft ?? 0));
  const alignR = Math.abs((metrics.navRight ?? 0) - (metrics.headerNavRight ?? 0));
  record(criteria, "headerAlignLeft", alignL <= 1, round2(alignL), "logo left = header container ±1");
  if (vp.width >= 1024) {
    record(criteria, "headerAlignRight", alignR <= 1, round2(alignR), "nav right = header container ±1");
    record(criteria, "logoHeightDesktop", inRange(metrics.logoHeight, 28, 32), round2(metrics.logoHeight), "28–32");
  } else if (vp.width === 390) {
    record(criteria, "logoHeightMobile", inRange(metrics.logoHeight, 24, 28), round2(metrics.logoHeight), "24–28");
  }
  recordWordmark(criteria, metrics);
  recordQuoteShell(criteria, await quoteShellMetrics(page), vp, sp.path);
  return { page: sp.name, viewport: vp.name, screenshot: shot, metrics, criteria };
}

async function measureMobileMenu(page, baseUrl) {
  const criteria = [];
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${baseUrl}/`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.getByRole("button", { name: "開啟選單" }).click();
  const state = await page.evaluate(() => {
    const logo = document.querySelector("[data-testid=site-header-logo]");
    if (!logo) return { missing: true };
    const s = getComputedStyle(logo);
    const box = logo.getBoundingClientRect();
    return {
      visibility: s.visibility,
      opacity: s.opacity,
      width: box.width,
      text: (logo.textContent ?? "").trim(),
    };
  });
  const shot = path.join(outDir, "mobile-menu-open-390.png");
  await page.screenshot({ path: shot, fullPage: false });
  record(
    criteria,
    "menuOpenLogoHidden",
    state.visibility === "hidden",
    state,
    "logo link visibility hidden",
  );
  const menuQuote = await page.evaluate((label) => {
    const dialog = document.querySelector("[role=dialog][aria-label='網站選單']");
    const link = dialog
      ? [...dialog.querySelectorAll("a")].find((a) => a.getAttribute("href") === "/quote")
      : null;
    return {
      label: link?.textContent?.trim() ?? null,
      height: link ? Math.round(link.getBoundingClientRect().height) : null,
      expected: label,
    };
  }, QUOTE_NAV_LABEL);
  record(criteria, "menuQuoteLabel", menuQuote.label === menuQuote.expected, menuQuote.label, menuQuote.expected);
  record(criteria, "menuQuoteTap", menuQuote.height != null && menuQuote.height >= 44, menuQuote.height, "≥44px");
  return { page: "mobile-menu", viewport: "390x844", screenshot: shot, criteria };
}

function feedbackClassCriterion() {
  const src = readFileSync(
    path.join(repoRoot, "src/components/FeedbackSlideIn.tsx"),
    "utf8",
  );
  const pass =
    src.includes("mx-auto w-full max-w-[584px]") &&
    !src.includes("reportReadingColumnClass");
  return {
    key: "feedbackSlideInMaxWidth",
    pass,
    actual: pass ? "mx-auto w-full max-w-[584px]" : "class missing",
    expected: "≤584 via max-w-[584px]",
  };
}

async function main() {
  const baseUrl = assertLocalBase(
    process.env.PRU_QC_BASE_URL ?? "http://127.0.0.1:3000",
  );
  const port = Number(new URL(baseUrl).port || 3000);
  clearOutDir();
  const { chromium } = await import("playwright");
  const child = await ensureServer(baseUrl, port);
  const browser = await chromium.launch();
  const runs = [];

  for (const fp of FIXTURES) {
    for (const vp of VIEWPORTS) {
      const page = await browser.newPage({ viewport: vp });
      runs.push(await measureReportPage(page, fp, vp, baseUrl));
      await page.close();
    }
  }

  for (const sp of STATIC_PAGES) {
    for (const vp of STATIC_VIEWPORTS) {
      const page = await browser.newPage({ viewport: vp });
      runs.push(await measureStaticPage(page, sp, vp, baseUrl));
      await page.close();
    }
  }

  {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    runs.push(await measureMobileMenu(page, baseUrl));
    await page.close();
  }

  await browser.close();
  if (child) stopServer(child);

  const classCheck = feedbackClassCriterion();
  runs.push({
    page: "FeedbackSlideIn",
    viewport: "source",
    criteria: [classCheck],
  });

  const failures = runs.flatMap((r) =>
    (r.criteria ?? [])
      .filter((c) => !c.pass)
      .map((c) => ({
        ...c,
        fixture: r.fixture ?? r.page,
        viewport: r.viewport,
      })),
  );

  let gitHead = "";
  let gitDirty = null;
  try {
    gitHead = execSync("git rev-parse HEAD", {
      cwd: repoRoot,
      encoding: "utf8",
    }).trim();
    gitDirty =
      execSync("git status --porcelain --untracked-files=no", {
        cwd: repoRoot,
        encoding: "utf8",
      }).trim() !== "";
  } catch {
    gitHead = "unknown";
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    gitHead,
    gitDirty,
    totalCriteria: runs.reduce((n, r) => n + (r.criteria?.length ?? 0), 0),
    failed: failures.length,
    failures,
    runs,
  };

  writeFileSync(
    path.join(outDir, "measurements.json"),
    JSON.stringify(summary, null, 2),
  );
  console.log(`QC: ${summary.failed} failures / ${summary.totalCriteria} checks`);
  console.log(`gitHead: ${gitHead}`);
  console.log(`Output: ${outDir}`);
  if (failures.length) {
    for (const f of failures) {
      console.log(
        `FAIL [${f.fixture} ${f.viewport}] ${f.key}:`,
        JSON.stringify(f.actual),
      );
    }
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

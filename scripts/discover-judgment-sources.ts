/**
 * D1 (no Serp) — build LRS / HKLII search URLs for offline ops.
 *
 * Does NOT call Serp or user /api/search. Output URLs for browser or future fetch adapter.
 *
 * Usage:
 *   pnpm discover:judgments
 *   pnpm discover:judgments --open-hints
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildLrsDualFieldSearchResultUrl,
  buildLrsSearchResultUrl,
  type LrsSearchMode,
} from "../src/lib/lrs-search-url";

const CONFIG_PATH = resolve(
  process.cwd(),
  "scripts/config/judgment-discovery-queries.json",
);
const PROFILES_PATH = resolve(
  process.cwd(),
  "scripts/config/lrs-ingestion-profiles.json",
);
const OUT_DIR = resolve(process.cwd(), "scripts/output");
const OUT_PATH = resolve(OUT_DIR, "judgment-source-urls.json");

type DiscoveryConfig = {
  version: number;
  sites: string[];
  /** Legacy flat terms — still emitted as anywords JU if profiles absent */
  topicTerms?: string[];
  courtTerms?: string[];
};

type LrsProfile = {
  id: string;
  tier: string;
  mode: LrsSearchMode;
  keyword: string;
  secondKeyword?: string;
  maxPagesDefault?: number;
  note?: string;
  observedHitsJu?: number;
};

type ProfilesFile = {
  version: number;
  lrsProfiles: LrsProfile[];
};

type SourceUrlEntry = {
  provider: "lrs" | "hklii";
  profileId?: string;
  tier?: string;
  topicTerm: string;
  mode?: LrsSearchMode;
  url: string;
  note: string;
  maxPagesDefault?: number;
  observedHitsJu?: number;
};

function loadConfig(): DiscoveryConfig {
  return JSON.parse(readFileSync(CONFIG_PATH, "utf8")) as DiscoveryConfig;
}

function loadProfiles(): ProfilesFile | null {
  try {
    return JSON.parse(readFileSync(PROFILES_PATH, "utf8")) as ProfilesFile;
  } catch {
    return null;
  }
}

/** HKLII site search (public HTML; respect ToS). */
function hkliiSearchUrl(keyword: string): string {
  const q = encodeURIComponent(keyword);
  return `https://v2.hklii.hk/search?q=${q}`;
}

function buildFromProfiles(profiles: LrsProfile[]): SourceUrlEntry[] {
  const entries: SourceUrlEntry[] = [];
  for (const p of profiles) {
    const url = p.secondKeyword
      ? buildLrsDualFieldSearchResultUrl({
          txtSearch: p.keyword,
          txtSearch2: p.secondKeyword,
        })
      : buildLrsSearchResultUrl({
          keyword: p.keyword,
          mode: p.mode,
          databases: ["JU"],
        });
    entries.push({
      provider: "lrs",
      profileId: p.id,
      tier: p.tier,
      topicTerm: p.keyword,
      mode: p.mode,
      url,
      maxPagesDefault: p.maxPagesDefault,
      observedHitsJu: p.observedHitsJu,
      note:
        p.note ??
        `LRS tier ${p.tier} ${p.mode}; JU only — see docs/design/lrs-judgment-discovery-rules.md`,
    });
    entries.push({
      provider: "hklii",
      profileId: p.id,
      tier: p.tier,
      topicTerm: p.keyword,
      url: hkliiSearchUrl(p.keyword),
      note: "HKLII 站內搜尋；核對後 sourceUrl 優先改 LRS 刊憲鏈。",
    });
  }
  return entries;
}

function buildLegacyEntries(config: DiscoveryConfig): SourceUrlEntry[] {
  const entries: SourceUrlEntry[] = [];
  for (const term of config.topicTerms ?? []) {
    entries.push({
      provider: "lrs",
      topicTerm: term,
      mode: "anywords",
      url: buildLrsSearchResultUrl({ keyword: term, mode: "anywords" }),
      note: "Legacy anywords JU; prefer lrs-ingestion-profiles.json tiers.",
    });
    entries.push({
      provider: "hklii",
      topicTerm: term,
      url: hkliiSearchUrl(term),
      note: "HKLII 站內搜尋；核對後 sourceUrl 優先改 LRS 刊憲鏈。",
    });
  }
  return entries;
}

function buildEntries(
  config: DiscoveryConfig,
  profiles: ProfilesFile | null,
): SourceUrlEntry[] {
  if (profiles?.lrsProfiles?.length) {
    return buildFromProfiles(profiles.lrsProfiles);
  }
  return buildLegacyEntries(config);
}

function main() {
  const config = loadConfig();
  const profiles = loadProfiles();
  const entries = buildEntries(config, profiles);
  const generatedAt = new Date().toISOString();

  mkdirSync(OUT_DIR, { recursive: true });
  const payload = {
    generatedAt,
    policy: "no_serp_track1",
    configVersion: config.version,
    profilesVersion: profiles?.version ?? null,
    rulesDoc: "docs/design/lrs-judgment-discovery-rules.md",
    entryCount: entries.length,
    entries,
  };
  writeFileSync(OUT_PATH, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.info(
    JSON.stringify({
      event: "discover_judgment_sources_done",
      path: OUT_PATH,
      entries: entries.length,
      gitignored: true,
      exampleInRepo: "scripts/fixtures/judgment-source-urls.example.json",
    }),
  );

  if (process.argv.includes("--open-hints")) {
    const sample =
      entries.find((e) => e.provider === "lrs" && e.tier === "A") ??
      entries.find((e) => e.provider === "lrs");
    console.info("\nSample LRS URL (tier A or first):\n", sample?.url);
  }
}

main();

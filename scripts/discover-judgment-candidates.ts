/**
 * @deprecated Track 1 discovery must NOT use Serp (quota reserved for user search).
 * Use: pnpm discover:judgments  → scripts/discover-judgment-sources.ts
 */
console.error(
  JSON.stringify({
    event: "discover_judgments_serp_deprecated",
    message:
      "Serp is reserved for POST /api/search only. Run: pnpm discover:judgments",
    doc: "scripts/ingestion/SERP-RESERVED-FOR-USERS.md",
  }),
);
process.exit(1);

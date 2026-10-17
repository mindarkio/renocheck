# Generated ingestion output (local only)

此目錄內容 **唔 commit**（見根目錄 `.gitignore`）。

| 檔案 | 產生方式 |
|------|----------|
| `judgment-source-urls.json` | `pnpm discover:judgments` |
| `lrs-html/*.html` | `pnpm fetch:judgments`（要 Playwright + chromium） |
| `lrs-fetch-manifest.json` | 同上 |
| `judgment-candidates.json` | `pnpm build:judgment-candidates` |
| `judgment-summary-dryrun.csv` | `pnpm judgment:summary-dryrun`（預設 20 宗；唔寫 DB） |

格式範例（在 repo）：[`../fixtures/judgment-source-urls.example.json`](../fixtures/judgment-source-urls.example.json)

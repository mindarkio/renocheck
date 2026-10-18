# 本地開發

## 需求

- Node.js 20+
- pnpm 10+

## 首次設定

```bash
pnpm install
cp .env.example .env.local
# 填入 Supabase anon + service_role（勿 commit .env.local）
```

**必須同時有 `NEXT_PUBLIC_SUPABASE_URL` 同 `SUPABASE_SERVICE_ROLE_KEY`**（只填 anon + service role、漏 URL 會令 admin client 係 `null`，`/api/report/...` 503）。可用 `curl -s localhost:3000/api/health` 睇 `supabaseAdmin: true/false`。

`search_cache` 開咗 RLS 但 **冇 anon policy** 係刻意設計；server 用 **service role 會 bypass RLS**，唔係 RLS 擋你。若 URL + service role 齊仍 404，先查 migration 有冇 push、cache upsert 有冇 error log。

**LLM：** 設 `GOOGLE_GENERATIVE_AI_API_KEY`（或 `GOOGLE_GENERATIVE_AI_KEY`）；預設 **`gemini-3.5-flash`**（較 `gemini-flash-latest` 通常更快）。請刪 `.env.local` 內已停用的 `gemini-2.0-flash` 或慢的 `gemini-flash-latest`，除非刻意覆寫 `GEMINI_MODEL`。`GET /api/health` → `llmProvider`。

Supabase CLI 連結遠端 project：見 **[supabase.md](supabase.md)**（`pnpm db:link`）。

**正式域名：** 建議 Vercel primary 用 `https://renocheck.homes`，並在 `.env.local`／Vercel 設 `NEXT_PUBLIC_SITE_URL=https://renocheck.homes`（供 `metadataBase`、`/sitemap.xml`、`/robots.txt`）。詳見 [`plans/seo-aeo-geo-optimization.md`](plans/seo-aeo-geo-optimization.md)。

## 指令

| 指令 | 說明 |
|------|------|
| `pnpm dev` | 開發伺服器（預設 http://localhost:3000） |
| `pnpm build` | 正式建置 |
| `pnpm start` | 跑正式建置 |
| `pnpm lint` | ESLint |
| `pnpm test` | 預設唔會打 Supabase（admin client 已 mock，service-role key 會被清走） |
| `pnpm test:watch` | 監聽模式 |
| `pnpm test:d2` | D2 filter golden parity。唔讀 `.env.local`。prod anon 已經讀唔到 `mwc_contractors`，要用 local／dev DB（見下方）。打 prod ref 會拒絕 |
| `pnpm import:judgments` | 匯入 `official_legal_events`（見 [supabase.md](supabase.md)） |
| `pnpm legal:lookup-smoke` | 僅 DB 判詞 lookup（唔食 Serp／LLM） |
| `pnpm judgment:poc-smoke` | J3 PoC：10 條 local seed lookup + 可選 `--api-base=http://localhost:3000` 三場景 full search |
| `pnpm tsx scripts/cause-list/fetch-cause-list.ts --date DDMMYYYY --court SMT` | Phase 3a：抓取 DCL HTML 至 `.cache/cause-list/`（3–5s 間隔；可選 `--wayback`） |
| `pnpm tsx scripts/cause-list/dry-run-report.ts --from DDMMYYYY --to DDMMYYYY` | Phase 3a：解析 cache + fixture 公司名，輸出 A/B/C 摘要 CSV 至 `scripts/output/` |
| `pnpm cause-list:export-mwc` | Phase 3a（本地，可選）：MWC 快照供 `dry-run-report`；`.cache/cause-list/mwc-companies-verify.json`（gitignored；勿 commit） |
| `pnpm cause-list:verify-samples` | Phase 3a（本地）：解析 `~/renocheck-review/samples/view_en_*.html`；只印 rows／kept（裝修相關且含法人被告／答辯人）與案件編號 |
| `pnpm cause-list:backfill` | Phase 3a（本地）：Wayback CDX 回補 2024-11-01 至今 SMT／DC／CACFI／LANDS；法人被告列寫入 `scripts/output/cause-list-backfill.csv`（可續跑；唔寫 DB）。名冊讀 `.cache/bd-register/`（7 日 TTL，先 `pnpm bd-register:fetch`）；冇名冊就失敗，唔會靜默 unmatched |
| `pnpm bd-register:fetch` | Phase 4：下載屋宇署名冊 CSV → `.cache/bd-register/`（7 日 TTL） |
| `pnpm bd-register:dry-run` | Phase 4：`.cache` baseline vs candidate MWC 比對 → `scripts/output/`（見 [bd-register/sources.md](bd-register/sources.md)） |

### `pnpm test:d2`

Prod 嘅 anon 已經讀唔到 `mwc_contractors`（migration `20261018140000`，未 apply 之前以 Aaron 批核為準；apply 之後 prod anon 冇 select）。D2 golden、`scripts/write-judgment-d2-filter-golden.ts`、`scripts/filter-judgment-candidates-d2.ts` 都用 anon key，而且用同一個 prod gate：打 prod project ref 就拒絕。三個都唔會自動讀 `.env.local`。冇 `RUN_D2_GOLDEN=1` 時，`pnpm test` 會 skip golden。

用 local Supabase，或者一個 dev project。Export **嗰個** DB 嘅 URL 同 anon key：

```bash
pnpm supabase start
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<local-service-role> pnpm import:mwc
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon> pnpm test:d2
```

`import:mwc` 會讀 `.env.local`，而且 `NEXT_PUBLIC_SUPABASE_URL` 優先；一定要喺命令前面 export local 嘅 URL 同 key，否則會寫入 `.env.local` 指住嘅 project（通常係 prod）。

Dev project 就換嗰個 project 嘅 URL 同 anon key。Local DB 由自己控制，可以對 local 嘅 anon 開 select。

`supabase start` 會套用 `20261018140000`，local anon 會讀唔到。用 [`scripts/sql/d2-local-anon-read.sql`](../scripts/sql/d2-local-anon-read.sql)，永遠唔好喺 prod 跑，亦唔好搬入 `supabase/`：

```bash
PGOPTIONS='-c renocheck.d2_local_grant=yes' psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f scripts/sql/d2-local-anon-read.sql
```

直接貼入 SQL editor 會被拒；只開 id/company_name/registration_no；唔好將呢個檔搬入 supabase/。

42501／permission denied 會顯示「anon 讀唔到 mwc_contractors：D2 要用 local／dev DB」，唔會 log row。唔好 `source .env.local`（會把 `SUPABASE_SERVICE_ROLE_KEY` 帶入 shell）。

`.cache/cause-list/` 內 DCL 原始 HTML 與 `mwc-companies-verify.json` 含當事人／公司名；僅供離線開發，**7 日 TTL**（`cache-ttl.ts`；過期需重新 fetch／`pnpm cause-list:export-mwc`），勿 commit。

## 健康檢查

```bash
curl -s http://localhost:3000/api/health
```

## 搜尋 API

```bash
curl -s -X POST http://localhost:3000/api/search \
  -H 'Content-Type: application/json' \
  -d '{"phone":"91234567"}'
```

契約見 `docs/MVP.md` §6。Track 2 **檢索設計**（query pack、可靠來源定義、評估集）見 [`design/search-evidence.md`](design/search-evidence.md)——實作大改前先跑評估。冷查詢 **必須** Supabase + Serp + LLM 全部成功才會出報告；**無 heuristic 降級**，失敗時 API 返 `503` 及 `error` code（如 `llm_failed`），前端顯示「報告未能顯示」。

評估 Serp 寫法：`pnpm eval:search-evidence`（見 `docs/design/search-evidence-fixtures.md`）。報告質量：`pnpm eval:report-quality`（golden，CI 友好）；`pnpm eval:report-quality --live`（讀 [`report-quality-live.json`](../scripts/fixtures/report-quality-live.json)，需 **`pnpm dev`** + `.env.local`，`refresh: true`）。發布前人工 10 條：[`docs/checklists/report-quality-human-signoff.md`](checklists/report-quality-human-signoff.md)。

名冊對照：`pnpm mwc:spot-check`（P2-C0，唔食 Serp quota）。單案 Serp/L1：`pnpm tsx scripts/diagnose-retrieval-case.ts <fixture-id>`。

### Retrieval KPI 記錄（內部，建議每週）

| 週次 | 日期 | `eval:search-evidence` Prod mustInclude | gold URL 備註 |
|------|------|----------------------------------------|---------------|
| — | — | — | 例：`1/2`；良心／源始 |

觸發：連兩周 Prod &lt;1/2 → 查 DEC-0002 調 retrieval（唔開 L0→LLM）。

### MWC 與 fixture（P2-C0，2026-10-13）

`mwc_contractors` 約 **15558** 行。`pnpm mwc:spot-check` 結果摘要：

| Fixture | 名冊 hit |
|---------|----------|
| 良心裝修顧問、源始（國際）、虛構 | **否**（`mwc:false` 屬預期，非 lookup bug） |
| 輝煌設計工程、偉景工程、深德(香港)工程 | 是 |

**電話 smoke（名冊路徑）：** `92805455` → 輝煌設計工程有限公司；預期 `searchLabelUsed` = 該登記名、`nameAlignment` = `match`（僅電話輸入時）。

### Smoke（電話 / BR / 公司名）

`pnpm dev` 運行中，用 `refresh: true` 略過 cache；報告應含 `reportVersion` `2.4.1`、`evaluation`（雙軌骨架，DEC-0007）、`entity.searchLabelUsed`、`signals.boundHitCount`、`signals.retrievalEvidence`（檢索層 SSOT，DEC-0006）、`signals.contractChecklist`（即使零討論）。

**Track 1 判詞（DEC-0012）：** 本地 `pnpm dev` **預設開啟** lookup（除非 `LEGAL_EVENTS_ENABLED=0`）；Vercel 正式環境須設 `LEGAL_EVENTS_ENABLED=1`。先 `pnpm import:judgments`。改 env 後要**重啟** dev server。Lookup 自測：`pnpm legal:lookup-smoke "示例裝修工程有限公司"`（預期 1 宗 `DCCJ 9001/2020`）。完整報告 smoke：`POST /api/search` + `{"companyName":"示例裝修工程有限公司","refresh":true}` — 回應為 `{ report, fingerprint, cacheHit, meta }`；讀 `report.official.legalEvents`（非空）、`report.evaluation.riskBandZh`（合成 fixture 至少「風險中等」）。真實 seed 一鍵（與 `judgments-seed.local.json` 行數同步）：`pnpm judgment:poc-smoke --api-base=http://localhost:3000`（預期 `lookupAllHit` + `apiAllHaveLegalEvents`；輸出 `scripts/output/judgment-poc-smoke-2026-10-16.json`）。

**判詞建庫（離線 D1，唔用 Serp）：** 見 [`judgment-ingestion-execution.md`](plans/judgment-ingestion-execution.md)。單案號發現（唔在 keyword 分頁內時）：`pnpm lrs:discover-case --case=HCSA59/2014`（可 `--write-candidates` 合併入 `judgment-candidates.json`）。**Lookup 別名／MWC BR：** `pnpm enrich:judgments-seed`（`--write` 更新 `lookupAliases`；MWC 0 hit 時靠商號／parties 別名）→ `pnpm import:judgments`。Tier A 候選池（≥50 `caseRef`）：`pnpm d1:tier-a`（= `discover` + `lrs:save-search-pages --tier=A --max-pages=6` + `build:judgment-candidates`；LRS 慢時用 `lrs:save-search-pages`，唔靠 `fetch:judgments` 短 timeout）。人手 D2 編 `scripts/fixtures/judgments-seed.local.json` → `pnpm validate:judgments-seed --min-renovation=5` → `pnpm import:judgments --file=...`。

**Release gold（DEC-0009）：** `docs/design/release-gold-set.md`；發版前 `pnpm eval:report-quality --live --gate`（blocking 8 條）。

**網搜供應商（DEC-0008）：** 優先 **Serper**（`SERPER_API_KEY`）；無則 **SerpAPI**（`SERPAPI_KEY`）。可設 `SERP_PROVIDER=serper|serpapi` 強制。切換後請跑 `pnpm eval:search-evidence` 對照召回（唔保證與 SerpAPI 逐條相同）。

**源始／品牌 host retry：** Q1+Q2 後若 L1 `bound=0` 且為 源始 品牌，會多跑 `buildBrandHostForumQuery`（+1 次查詢）。`SERP_GL`/`SERP_HL` 預設 `hk`/`zh-HK`。

```bash
# 電話（名冊 hit：輝煌 92805455）
curl -s -X POST http://localhost:3000/api/search \
  -H 'Content-Type: application/json' \
  -d '{"phone":"92805455","refresh":true}'

# 公司名
curl -s -X POST http://localhost:3000/api/search \
  -H 'Content-Type: application/json' \
  -d '{"companyName":"良心裝修顧問有限公司","refresh":true}'

# BR（若有名冊資料）
curl -s -X POST http://localhost:3000/api/search \
  -H 'Content-Type: application/json' \
  -d '{"br":"MWC","refresh":true}'
```

對照 terminal：`search_evidence`（`raw_hits` / `llm_hits`）、`search_timing`。名冊未 import 時 MWC 路徑僅能測「user_only」。

每次冷查詢預設 **3 次 Serp**（Q1 × `SERP_PAGE_COUNT` 頁，預設 2；Q2 loose × `SERP_Q2_PAGES` 頁，預設 1 — DEC-0003）。`SERP_PAGE_COUNT=2` 且 `SERP_Q2_PAGES=2` 時最多 4 次。Q2 為 **無引號短 entity**；eval 舊欄 Q2 仍為引號全名。送 LLM 前 L1 + `SERP_LLM_HIT_CAP`（15）；`serpHitCount` = raw 合併數。`refresh: true` 略過 cache。`pnpm eval:search-evidence`：**Prod** = API；Q1/Q2 對照用 `EVAL_SERP_PAGES`。冷查詢後 terminal 可睇 `search_timing`（mwc/serp/llm ms）、`search_evidence`（raw vs llm hits；`l1_no_match_sample_hosts` = L1 全滅時前 3 個 host）。Serp 韌性（DEC-0005）：`serp_page_failed` / `serp_partial`（部分頁失敗仍繼續）；`serp_query_failed`（整條 Q1 或 Q2 全頁失敗）；API `error` 為 `serp_failed` vs `llm_failed` 時前端文案不同（見 `SearchForm`）。

## UI

設計 token 與原則見 [`ui-principles.md`](ui-principles.md)。

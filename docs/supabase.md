# Supabase（renocheck）

| 項目 | 值 |
|------|-----|
| **Project ref** | `lvrasvtilgzwtfsfjbzd` |
| **API URL** | `https://lvrasvtilgzwtfsfjbzd.supabase.co` |
| **Region** | `ap-southeast-1` |
| **Postgres** | 17（`supabase/config.toml` → `[db] major_version = 17`） |

## CLI（repo 內）

```bash
pnpm install          # 已含 devDependency `supabase`
pnpm supabase --help
```

## 連結遠端 project（`supabase link`）

本機 CLI 必須登入 **擁有 renocheck project 的 Supabase 帳號**（Dashboard 能開上述 URL 的那個）。

```bash
# 若 `pnpm db:link` 報 privileges 錯誤，先換帳號：
pnpm supabase logout
pnpm supabase login

# 連結（會問 Database password — Dashboard → Project Settings → Database）
pnpm db:link
# 或：pnpm supabase link --project-ref lvrasvtilgzwtfsfjbzd -p 'YOUR_DB_PASSWORD'
```

成功後會在 `supabase/.temp/` 寫入連線資料（已在 `supabase/.gitignore`，勿 commit）。

## 環境變數（`.env.local`）

從 [Dashboard → API](https://supabase.com/dashboard/project/lvrasvtilgzwtfsfjbzd/settings/api) 複製：

| 變數 | 用途 |
|------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://lvrasvtilgzwtfsfjbzd.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 瀏覽器用（publishable / anon） |
| `SUPABASE_SERVICE_ROLE_KEY` | **僅伺服器**（Route Handlers、scripts） |

勿 commit `.env.local`。`service_role` 不可放 `NEXT_PUBLIC_*`。

## Migrations

**治理：** 任何新 migration 須先經 **Aaron** 批准再 `db push`／套用 remote（`hearing_key_point_quotes_zh` 2026-10-17 為事後補批）。

**Track 1 判詞欄位（remote 版本號）：** `20261017101908`（`hearing_points_source`）、`20261017110920`（`hearing_key_point_quotes_zh`）、`20261017114049`（`(source_catalog_id, case_ref)` unique + `ai_verified` 降級 trigger）、`20261017145500`（trigger function `set search_path = ''`）。`pnpm supabase migration list --linked` 應 local = remote。

### `hearing_points_source = ai_verified` 降級（runbook）

Trigger `official_legal_events_hearing_source_downgrade` 會 **拒絕** 將已 `ai_verified` 嘅行改做 `placeholder`／`manual`／其他值（exception：`hearing_points_source_downgrade_blocked`）。

**正常操作：** 用 `pnpm import:judgment-verified-summaries --apply` 或人手 SQL **只升級** 至 `ai_verified`；`import:judgments` 對現有 `ai_verified` 行會保留 hearing 欄位。

**若必須撤回核對（罕有，需 Aaron／法務 sign-off）：**

1. 記低 `case_ref` 與原因（audit trail）。
2. 暫停寫入：唔跑 `import:judgments` 針對該案。
3. 在 Dashboard SQL（service role）**先** `drop trigger official_legal_events_hearing_source_downgrade on public.official_legal_events;`，再 `update` 目標行（例如改 `hearing_points_source`、要點／引文），最後 `create trigger … execute function public.block_official_legal_events_hearing_source_downgrade();`（定義同 migration `20261017114049`／`20261017145500`）。
4. 勿用 `migration repair` 掩蓋；若改 function 定義，走新 migration + `db:push`。

**`case_ref` 正規化：** 入庫前統一 `normalizeJudgmentCaseRefForStorage`（與 `judgmentImportRowKey` 共用 `judgmentCaseRefKey`）。`pnpm import:judgments` **必須** `--file=…`；開跑前會 audit remote 所有 allowlist 行，若 `case_ref` 與正規化結果唔同會 **exit 1** 並列出 drift。

已套用（remote）：

- `20261012202411_initial_schema.sql` — placeholder（remote `statements` 為空；無 DDL）
- `20261012202625_initial_mvp_schema.sql` — `mwc_contractors`, `search_cache`, `search_events` + RLS
- `20261016120000_official_legal_events.sql` — `official_legal_events`（DEC-0012；僅 service_role）

```bash
pnpm supabase migration new your_change
pnpm db:push
pnpm supabase migration list --linked   # local vs remote
```

**Rollbacks（唔會被 `db push` 套用）：** 手動 down SQL 在 `supabase/rollbacks/`（見該目錄 `README.md`）。

表設計見 `docs/MVP.md` §4。

## MWC 名冊匯入

1. `pnpm bd-register:fetch`（寫入 `.cache/bd-register/registers_full_list.csv`；見 [`bd-register/sources.md`](bd-register/sources.md)）。
2. `.env.local` 設好 `SUPABASE_SERVICE_ROLE_KEY`。
3. 套用 unique index migration（若尚未）：`pnpm db:push`
4. 執行：

```bash
pnpm import:mwc
```

腳本會篩選 `MWC` / `MWC(W)`，按 `REGISTRATION_NUMBER` 去重後 upsert 至 `mwc_contractors`（含 `expiry_date`、`primary_signatory_name` 供報告「政府名冊」展示）。

## 司法判詞匯入（DEC-0012）

**Remote `official_legal_events`（cloud）：** 僅保留 D2 keep **`legalref-lrs-ju`（70 行）**。曾誤入嘅合成測試 catalog `judiciary-lrs-fixture`（`DCCJ 9001/2020`、`HCSA 42/2019`）已自 remote 刪除；唔會再經匯入腳本寫回。

1. `pnpm db:push`（含 `official_legal_events` migration）。
2. **Production / remote 匯入：** 用 `scripts/fixtures/judgments-seed.local.json`（gitignore）；`sourceCatalogId` 必須屬 **`OFFICIAL_LEGAL_EVENT_SOURCE_CATALOG_ALLOWLIST`**（現僅 `legalref-lrs-ju`，與 `lookupLegalJudgments` 共用，見 `src/lib/legal-event-catalog-allowlist.ts`）。`import:judgments`、`d2:import-keep`、`prune:*`、`purge:*`、`mwc:bilingual-legal-match` 均經 `judgment-import-catalog-guard`。
3. **Fixture only：** [`scripts/fixtures/judgments-seed.json`](../scripts/fixtures/judgments-seed.json) 內 `judiciary-lrs-fixture` 兩行僅供 **單元測試／本地 fixture**，不可 `--file` 指向 cloud。
4. 來源說明見 [`docs/sourcedata/judgments-sources.md`](sourcedata/judgments-sources.md)。
5. 執行：

```bash
pnpm import:judgments --file=scripts/fixtures/judgments-seed.local.json
# 預覽：pnpm import:judgments --dry-run --file=...
```

6. 在 Vercel／`.env.local` 設 `LEGAL_EVENTS_ENABLED=1` 後，`POST /api/search` 才會 lookup 並在報告顯示 `official.legalEvents`。

## 本地 Supabase（可選）

```bash
pnpm supabase start   # Docker；與 cloud 分開
```

MVP 可直接對 cloud dev project 做 `db push`；本地 stack 非必須。

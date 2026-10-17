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

1. 將屋宇署 **Registers full list** CSV 放在 [`docs/sourcedata/registers_full_list.csv`](sourcedata/registers_full_list.csv)（見 [`sourcedata/README.md`](sourcedata/README.md)）。
2. `.env.local` 設好 `SUPABASE_SERVICE_ROLE_KEY`。
3. 套用 unique index migration（若尚未）：`pnpm db:push`
4. 執行：

```bash
pnpm import:mwc
```

腳本會篩選 `MWC` / `MWC(W)`，按 `REGISTRATION_NUMBER` 去重後 upsert 至 `mwc_contractors`（含 `expiry_date`、`primary_signatory_name` 供報告「政府名冊」展示）。

## 司法判詞匯入（DEC-0012）

1. `pnpm db:push`（含 `official_legal_events` migration）。
2. 編輯或擴充 [`scripts/fixtures/judgments-seed.json`](../scripts/fixtures/judgments-seed.json)；真實案可放 `scripts/fixtures/judgments-seed.local.json`（勿 commit 未授權內容）。
3. 來源說明見 [`docs/sourcedata/judgments-sources.md`](sourcedata/judgments-sources.md)。
4. 執行：

```bash
pnpm import:judgments
# 預覽：pnpm import:judgments --dry-run
```

5. 在 Vercel／`.env.local` 設 `LEGAL_EVENTS_ENABLED=1` 後，`POST /api/search` 才會 lookup 並在報告顯示 `official.legalEvents`。

## 本地 Supabase（可選）

```bash
pnpm supabase start   # Docker；與 cloud 分開
```

MVP 可直接對 cloud dev project 做 `db push`；本地 stack 非必須。

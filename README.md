# Renocheck

裝修公司風險參考搜尋（MVP）— 業主防禦向、聚合官方牌照與公開討論摘要。

## Docs

- **[MVP 設計書](docs/MVP.md)** — 範圍、架構、資料模型、API  
- **[開發指南](docs/development.md)** — `pnpm dev` / test / env  
- **[UI 原則](docs/ui-principles.md)**  
- **[AGENTS.md](AGENTS.md)** — Cursor / agent 入口  
- **[V2 roadmap](docs/phases/V2-roadmap.md)**  
- **Notion：** [MVP project-裝修點評](https://app.notion.com/p/3f63e97febe9809ebb29c1fb43c3c331)

## Status

Next.js scaffold、主題與頁面殼已就緒。**搜尋 API / Supabase 待下一階段。**

## Setup

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Tests

`pnpm test` runs Vitest and does not call Supabase. The D2 filter golden parity check is opt-in and skips when `RUN_D2_GOLDEN` is unset.

Production anon can no longer read `mwc_contractors`. `pnpm test:d2` does not read `.env.local`. Use a local Supabase stack (`pnpm supabase start`, then `pnpm import:mwc` with that stack's service role) or a dev project, and export **that** database's URL and anon key:

```bash
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=<local-anon> pnpm test:d2
```

A production project ref is refused. `scripts/write-judgment-d2-filter-golden.ts` and `scripts/filter-judgment-candidates-d2.ts` use the same gate and do not read `.env.local`.

`supabase start` applies `20261018140000`, so local anon cannot read until you run this **local-only** SQL on the database you control. Never run it on production. RLS stays enabled, so `GRANT` alone still returns no rows; the policy is what lets local anon `SELECT`.

```sql
-- LOCAL / DEV ONLY. Never run on production.
grant select on table public.mwc_contractors to anon;
drop policy if exists mwc_contractors_select_anon on public.mwc_contractors;
create policy mwc_contractors_select_anon
  on public.mwc_contractors
  for select
  to anon
  using (true);
```

Do not `source .env.local` for this; it would also export `SUPABASE_SERVICE_ROLE_KEY` into the shell. See [docs/development.md](docs/development.md).

## Agent setup

See [AGENTS.md](AGENTS.md) and `.cursor/rules/`.

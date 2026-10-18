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

`pnpm test` runs Vitest and does not call Supabase. The D2 filter golden parity check is opt-in.

`pnpm test:d2` does not read `.env.local`. Export a non-production project explicitly:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<dev-ref>.supabase.co NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon> pnpm test:d2
```

Production (`lvrasvtilgzwtfsfjbzd`) is refused unless `D2_GOLDEN_ALLOW_PROD_READONLY=1` (anon key only).

Do not `source .env.local` for this; it would also export `SUPABASE_SERVICE_ROLE_KEY` into the shell. See [docs/development.md](docs/development.md).

## Agent setup

See [AGENTS.md](AGENTS.md) and `.cursor/rules/`.

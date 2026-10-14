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

## Agent setup

See [AGENTS.md](AGENTS.md) and `.cursor/rules/`.

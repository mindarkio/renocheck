# Sourcedata

此目錄存放**來源說明**與非 CSV 參考（例如 [`judgments-sources.md`](judgments-sources.md)）。

## 屋宇署 Registers full list CSV

**唔**再 commit 完整名冊 CSV（含個人姓名）。本地使用：

1. `pnpm bd-register:fetch` → `.cache/bd-register/registers_full_list.csv`（gitignored；**7 日 TTL**，見 `src/lib/cause-list/cache-ttl.ts`）
2. `pnpm import:mwc` 讀同上路徑
3. Dry-run baseline：`.cache/bd-register/registers_full_list.baseline.csv`（由 candidate 複製；見 [`bd-register/sources.md`](../bd-register/sources.md)）

單元測試用合成 fixture：`src/lib/bd-register/fixtures/registers.fixture.csv`（官方 23 欄 header，假公司名）。

勿將此檔當作商業登記（BR）或工程紀錄（BRAVO）資料。

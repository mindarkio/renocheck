# D2 漏網 review（2026-10-17 dry-run）

## 點解會入咗 keep（根因）

| 機制 | 說明 |
|------|------|
| `company_defendant` | 英文自然人被誤分類為 `company`（`及另一人`／無 LTD 尾綴仍當公司） |
| `force_keep_allowlist` | CACV 131/2005 免閘；移除後需 OC v 承建商路徑 |
| `renovationRelevantSuggested` + profile | LRS profile（如 `anywords-翻新`）令 DCCJ 跳過被告工程字檢查 |
| 缺行業排除 | 車輛／地產／物管／工傷／業權租務未 drop |

## 本輪 11 單（新規則 drop reason）

見 `scripts/output/d2-prior-keep-drops.json` 內對應 `caseRef`。

## 重跑結果（dry-run，未 prune）

- 原 keep：**167**
- 新 keep：**78**
- 從舊 keep 跌出：**89** 宗（`--report-prior-keep-drops`）

```bash
pnpm d2:filter-candidates --dry-run --report-prior-keep-drops
```

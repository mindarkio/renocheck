# 屋宇署紀律處分即時查詢（B.2a.1）可行性報告

- **狀態：** PR-BC 交付（文件 only）；**待 Aaron／合規 sign-off** 後決定是否開 **PR-BD-LIVE**
- **日期：** 2026-10-18
- **相關：** [`report-trust-plan.md`](report-trust-plan.md) B.2a、[`docs/bd-register/sources.md`](../bd-register/sources.md)

## 1. 目標

評估 Renocheck 可否以 **server-side** 請求屋宇署「註冊專業人士或承建商搜尋」結果頁，解析 **`%` 紀律處分標記**（唔解析處分正文／人名），並在 MWC **有限公司** 報告當次展示；失敗時 **只** 顯示 PR-BC 已實作嘅 **官方查證連結**（`official-verify-links`）。

## 2. 條款與 robots（待法務摘錄確認）

| 來源 | URL | 初步觀察（2026-10-18） |
|------|-----|------------------------|
| 屋宇署名冊搜尋 | `https://www.bd.gov.hk/tc/resources/online-tools/registers-search/registrationsearch.html` | HTTP **200**；表單式搜尋，**未**在本報告內做自動 POST／爬取 |
| DATA.GOV 開放 CSV | 見 `sources.md` | 離線 `FLAG` 僅 `@`／空白；**唔**含 `%` 紀律標記 |
| `robots.txt` | `https://www.bd.gov.hk/robots.txt` | **`robots.txt` 200**，只有 `Disallow: /ecard/`；**robots 冇禁止唔等於使用條款准許** |

**必須由 Aaron／合規完成：** 摘錄屋宇署網站 **使用條款** 相關段落，判斷「為用戶代查一次搜尋結果」是否允許；若禁止自動化或僅限瀏覽器互動 → **no-go**，維持官方連結 only。

## 3. 技術面（待 PR-BD-LIVE spike）

| 問題 | 現況 |
|------|------|
| HTTP 方法 | 搜尋結果 **唔喺 HTML 入面**；係由頁面 JS 喺瀏覽器 **POST JSON** 去屋宇署內部 API，request 帶住寫死喺 JS 入面嘅 **token**。冇公開 API 文件，亦冇授權；server-side 重用呢個 endpoint／token 屬 **未經准許使用** → **未有屋宇署書面准許之前係 no-go** |
| Captcha／WAF | **未知**；若出現 captcha 或 403 → 必須 **降級**（唔顯示「未見標記」） |
| `%` 標記 DOM | **未**鎖定穩定 selector；需用 **fixture HTML**（合成）單測 parser，**唔** commit 真實頁面 |
| 速率 | 建議 ≤ **1 req/s** 對 `bd.gov.hk`；in-memory cache TTL ≤ **10 分鐘**；**唔**寫入 `RiskReport`／`search_cache` |

## 4. 風險結論（建議）

| 結論 | 條件 |
|------|------|
| **僅官方連結（現狀）** | PR-BC 已上線；**無**即時查詢 code |
| **go → PR-BD-LIVE** | **屋宇署書面准許**（或者提供正式 API／開放數據欄位）＋合規確認 ToS＋parser 穩定讀到 `%` |
| **no-go** | ToS 禁止 server 代查、或必須 captcha／登入 → **唔開** PR-BD-LIVE |

**本報告建議：** 在合規 **未** 書面確認前，標為 **no-go（實作）**／**官方連結 only**；合規 go 後再開 PR-BD-LIVE，並建議 **DEC 附錄**（唔入 RiskReport、降級規則）。

**% 標記局限：** 只覆蓋最近三年或者命令期限內；「未見標記」**永遠唔可以**顯示成正面結論。

**替代方案：** 要求屋宇署／DATA.GOV.HK 喺開放數據 CSV **加紀律標記欄**。

## 5. PR-BD-LIVE 開工檢查清單

- [ ] Aaron 批准 ToS／robots 摘錄
- [ ] Spike：單次 regNo 查詢 + 合成 HTML fixture
- [ ] Route + 降級測試（degraded **唔**顯示「未見標記」）
- [ ] `sources.md` 更新 UA／`verified_at`

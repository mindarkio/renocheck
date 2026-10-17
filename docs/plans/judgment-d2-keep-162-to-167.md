# D2 keep 162 → 167（2026-10-16）

**原因：** `mwc_plaintiff_only_pass` 改為僅在「原告側 MWC hit **且** 被告標籤**無**工程字眼」時 drop；被告有工程字眼則繼續走 sole prop / company keep 規則（commit `cdbc85c`）。

**新增 5 宗**（舊規則會在 `mwcLeft` hit 時直接 drop，新規則保留）：

| caseRef | 被告（工程相關） | 原告側 MWC 命中（`mwcLeft`） | 現時 keep reason |
|---------|------------------|------------------------------|------------------|
| HCSA 13/2024 | 楊國聰經營新寶燈飾裝修工程公司 | 新寶燈飾裝修工程公司 | `sole_proprietor_engineering_keep` |
| HCSA 57/2024 | 陳國新經營燊記裝修水電工程 | 燊記裝修水電工程 | `sole_proprietor_engineering_keep` |
| HCSA 28/2016 | 謝天健經營天穎裝修工程公司 | 天穎裝修工程公司 | `sole_proprietor_engineering_keep` |
| HCSA 62/2012 | 謝卓男經營卓男工程顧問及裝修公司 | 卓男工程顧問及裝修公司 | `sole_proprietor_engineering_keep` |
| DCCJ 3352/2015 | 和田工程有限公司 | 周奈長（MWC 個人承建商標籤） | `company_defendant_mwc_enrich` |

驗證方式（本機，需 Supabase + candidates）：對 `judgment-d2-keep.json` 重播 `lookupMwcForPartyLabel`（原告）+ `defendantHasEngineeringKeyword`（被告），上表 5 宗為 `mwcLeft` 非 ambiguous 且被告含工程字眼之全集。

---

## 生記 / 燊記 / 富記 vs v3e（對照）

| 案號 | 商號關鍵字 | 角色 | v3e / D2 結果 | 說明 |
|------|------------|------|---------------|------|
| HCSA 39/2017 | 生記**工程**公司 | 原告（被告自然人 YIU CHOR LIN） | **drop** `natural_person_defendant` | 工程字眼在**原告**；被告非公司，唔入庫 |
| HCSA 4/2017 | 富記**裝修工程**公司 | 原告（被告梁新琼） | **drop** `natural_person_defendant` | 同上 |
| HCSA 59/2014 | 燊記**裝修水電工程** | **原告**（被告徐益民） | **drop** `mwc_plaintiff_only_pass`（被告無工程字眼） | 原告側 MWC／工程商；DEC 被告 only |
| HCSA 57/2024 | 燊記**裝修水電工程** | **被告**（原告郭振強及另一人） | **keep** `sole_proprietor_engineering_keep` | 被告商號含工程；不再因原告側 MWC 誤 drop |
| HCSA 13/2024 | 新寶燈飾**裝修工程** | 被告 | **keep** | 同上（162→167 新增之一） |

**規則摘要（v3e）：**

- 被告 **自然人** → drop（生記／富記案）。
- 原告 **公司／独资工程商**、被告自然人 → drop（59/2014 燊記原告）。
- 被告 **独资／商號含工程字** + 小額/區院等 → `sole_proprietor_engineering_keep`（57/2024、13/2024）。
- `mwc_plaintiff_only_pass` 僅阻擋「原告 MWC hit **且** 被告**無**工程字眼」之 keep。

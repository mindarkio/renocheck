# Sourcedata

## `registers_full_list.csv`

- **來源：** [DATA.GOV.HK — Registers of Buildings Department](https://data.gov.hk/tc-data/dataset/hk-bd-opendata-registers-of-buildings-department)（屋宇署註冊名冊完整列表）
- **欄位說明：** [data_dictionary_registers.docx](https://static.data.gov.hk/bd/opendata/registers/data_dictionary_registers.docx)
- **Renocheck 使用：** `REGISTRATION_TYPE` 為 `MWC` 或 `MWC(W)` 的行 → `pnpm import:mwc` → `mwc_contractors`

勿將此檔當作商業登記（BR）或工程紀錄（BRAVO）資料。

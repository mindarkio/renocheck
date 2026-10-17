# 判詞要點核對（verified SSOT）

**Fixture：** `scripts/fixtures/judgment-summaries-verified.json`（70 宗）  
**不在 fixture 的 keep（2026-10-17）：** 下列 9 宗自 D2 keep 剔除，理由為案情／程序，唔係「無 JSON」。

## 79 − 9 = 70

| caseRef | D2 drop reason | 核對備註 |
|---------|----------------|----------|
| CACV 131/2005 | `manual_triage_io_maintenance_fee_recovery_from_owners` | 法團向業主徵收維修費爭議，非裝修承建商風險查證軸 |
| DCCJ 3800/2013 | `manual_triage_defendant_mainland_geotech_not_renovation` | 被告武漢科島地理信息，非本港住宅裝修承建商 |
| DCCJ 18510/2001 | `manual_triage_general_contractor_as_plaintiff` | 豪昌工程（原告）追分判商號，非業主查證被告場景 |
| DCCJ 2220/2002 | `manual_triage_defendant_marine_freight_not_renovation` | 船廠诉貨運工程，海事／貨運，非住宅裝修 |
| HCA 2269/2007 | `manual_triage_individual_plaintiff_vs_contractor` | 個人原告 LIN ZHEN 诉承建商，非業主立案法團抗辯軸 |
| LDBM 6/1998 | `manual_triage_defendant_contractor_is_owner_in_case` | 成龍工程有限公司於案中為業主一方，非本產品被告承建商查證軸 |
| HCSA 40/2023 | `manual_triage_hcsa_appeal_leave_order_only` | 高院上訴許可／程序裁決為主（HKCFI 207），非審裁處實體要點 |
| HCA 714/2007 | `manual_triage_defendant_developer_contractor_out_of_scope` | 五億發展诉大型承建商，集團工程民事，非 MVP 裝修商號查證 |
| DCCJ 3255/2004 | `manual_triage_defendant_interior_design_not_renovation` | 室內設計獨資商號互诉，非工程承建糾紛 |

> LDBM 6/1998 曾為 D2 keep（商號含「工程」）；核對後剔除因成龍工程於案中屬業主身份。若日後補核對可再加回 fixture。

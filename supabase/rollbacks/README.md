# Manual rollbacks (not applied by `supabase db push`)

Pair each file with the matching migration under `supabase/migrations/`. Run on the database only after explicit approval.

20261018140000 嘅 down 係完全還原，會重新公開 phone 同 signatory，只限緊急用；任何 down 檔都唔可以 revoke service_role。

20261020180000 嘅 down 會刪走 `report_feedback` 全部列（EMERGENCY／資料損失），只限緊急用。

| Rollback file | Up migration |
|---------------|----------------|
| `20261016120000_official_legal_events.down.sql` | `20261016120000_official_legal_events.sql` |
| `20261016143000_official_legal_events_lookup_aliases.down.sql` | `20261016143000_official_legal_events_lookup_aliases.sql` |
| `20261016184025_official_legal_events_review_status.down.sql` | `20261016184025_official_legal_events_review_status.sql` |
| `20261016220000_official_legal_events_service_role_grants.down.sql` | `20261016220000_official_legal_events_service_role_grants.sql` |
| `20261017101908_official_legal_events_hearing_points_source.down.sql` | `20261017101908_official_legal_events_hearing_points_source.sql` |
| `20261017110920_official_legal_events_hearing_key_point_quotes_zh.down.sql` | `20261017110920_official_legal_events_hearing_key_point_quotes_zh.sql` |
| `20261017114049_official_legal_events_catalog_case_ref_and_hearing_guard.down.sql` | `20261017114049_official_legal_events_catalog_case_ref_and_hearing_guard.sql` |
| `20261017145500_official_legal_events_hearing_guard_search_path.down.sql` | `20261017145500_official_legal_events_hearing_guard_search_path.sql` |
| `20261018140000_mwc_contractors_service_role_only.down.sql` | `20261018140000_mwc_contractors_service_role_only.sql` |
| `20261020180000_report_feedback.down.sql` | `20261020180000_report_feedback.sql` |
| `20261023180000_mwc_company_name_en.down.sql` | `20261023180000_mwc_company_name_en.sql` |
| `20261023203000_returning_user_analytics.down.sql` | `20261023203000_returning_user_analytics.sql` |
| `20261023220000_quote_analysis.down.sql` | `20261023220000_quote_analysis.sql` |

20261023220000 嘅 down 會刪走 `quote_analyses`、`quote_analysis_claims`、`quote_spend_daily` 同 `auth_otp_rate_limits` 全部列（EMERGENCY／資料損失），只限緊急用。同一份 up 有 `purge_quote_analysis_retention()`：分析、claims 同 metadata 180 日後刪，用量／費用列 30 日後刪；down 會一併 drop 呢個 function。

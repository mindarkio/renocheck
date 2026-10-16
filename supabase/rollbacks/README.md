# Manual rollbacks (not applied by `supabase db push`)

Pair each file with the matching migration under `supabase/migrations/`. Run on the database only after explicit approval.

| Rollback file | Up migration |
|---------------|----------------|
| `20261016120000_official_legal_events.down.sql` | `20261016120000_official_legal_events.sql` |
| `20261016143000_official_legal_events_lookup_aliases.down.sql` | `20261016143000_official_legal_events_lookup_aliases.sql` |
| `20261016184025_official_legal_events_review_status.down.sql` | `20261016184025_official_legal_events_review_status.sql` |
| `20261016220000_official_legal_events_service_role_grants.down.sql` | `20261016220000_official_legal_events_service_role_grants.sql` |

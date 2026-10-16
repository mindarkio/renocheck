-- Rollback: 20261016143000_official_legal_events_lookup_aliases.sql

drop index if exists public.official_legal_events_lookup_aliases_gin;

alter table public.official_legal_events
  drop column if exists lookup_aliases;

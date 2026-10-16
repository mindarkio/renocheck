-- Rollback: 20261016120000_official_legal_events.sql

drop index if exists public.official_legal_events_event_date_idx;
drop index if exists public.official_legal_events_company_name_idx;
drop index if exists public.official_legal_events_br_idx;
drop table if exists public.official_legal_events;

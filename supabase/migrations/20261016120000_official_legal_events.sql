-- Track 1 court judgments (DEC-0012) — server-only read via service_role

create table public.official_legal_events (
  id uuid primary key default gen_random_uuid(),
  source_type text not null default 'court_judgment',
  source_catalog_id text not null,
  case_ref text not null,
  court text not null,
  event_date date not null,
  party_names jsonb not null default '[]'::jsonb,
  hearing_key_points_zh jsonb not null default '[]'::jsonb,
  source_url text not null,
  source_published_at timestamptz,
  br_normalized text,
  company_name_normalized text not null,
  judgment_category text not null,
  party_role text not null,
  outcome_hint text,
  procedure_stage text,
  renovation_relevant boolean not null default true,
  topic_tags jsonb not null default '[]'::jsonb,
  source_content_hash text not null unique,
  imported_at timestamptz not null default now()
);

create index official_legal_events_br_idx
  on public.official_legal_events (br_normalized)
  where br_normalized is not null;

-- Trade name (獨資商號) or company defendant label; sole prop owner names live in party_names only.
create index official_legal_events_company_name_idx
  on public.official_legal_events (company_name_normalized);

create index official_legal_events_event_date_idx
  on public.official_legal_events (event_date desc);

alter table public.official_legal_events enable row level security;

-- No anon/authenticated policies — pipeline + import use service_role only (like search_cache).

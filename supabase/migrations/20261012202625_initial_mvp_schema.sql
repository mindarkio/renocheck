-- Renocheck MVP schema (docs/MVP.md §4)

-- Track 1: MWC contractors (public registry; readable via anon)
create table public.mwc_contractors (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  phone text,
  registration_no text,
  source_updated_at timestamptz,
  created_at timestamptz not null default now()
);

create index mwc_contractors_company_name_idx on public.mwc_contractors (company_name);
create index mwc_contractors_phone_idx on public.mwc_contractors (phone)
  where phone is not null;
create index mwc_contractors_registration_no_idx on public.mwc_contractors (registration_no)
  where registration_no is not null;

alter table public.mwc_contractors enable row level security;

create policy mwc_contractors_select_anon
  on public.mwc_contractors
  for select
  to anon, authenticated
  using (true);

-- Track 2 cache: server (service_role) only — no anon/authenticated policies
create table public.search_cache (
  fingerprint text primary key,
  query_input jsonb not null,
  report jsonb not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);

create index search_cache_expires_at_idx on public.search_cache (expires_at);

alter table public.search_cache enable row level security;

-- Analytics: server writes only
create table public.search_events (
  id uuid primary key default gen_random_uuid(),
  fingerprint text not null,
  cache_hit boolean not null,
  created_at timestamptz not null default now()
);

create index search_events_created_at_idx on public.search_events (created_at desc);
create index search_events_fingerprint_idx on public.search_events (fingerprint);

alter table public.search_events enable row level security;

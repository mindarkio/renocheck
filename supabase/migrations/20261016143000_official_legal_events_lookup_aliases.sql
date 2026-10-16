-- Optional alternate search labels (MWC name, trade name, parties line) for judgment lookup.

alter table public.official_legal_events
  add column if not exists lookup_aliases text[] not null default '{}';

create index if not exists official_legal_events_lookup_aliases_gin
  on public.official_legal_events using gin (lookup_aliases);

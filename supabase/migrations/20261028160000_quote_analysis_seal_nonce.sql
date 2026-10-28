-- One row per sealed result. The claim route stores the seal nonce (random
-- 16 bytes, hex) with the checklist, so two claims of the same blob cannot
-- both insert: the second gets 23505 and the route answers 409. A failed
-- quota check or insert leaves nothing behind, so the blob can be retried.
-- The nonce is random and carries no personal data; it ends with the row
-- (180-day purge or account deletion). Re-runnable.

alter table public.quote_analyses
  add column if not exists seal_nonce text;

do $$
begin
  if not exists (
    select 1
    from pg_catalog.pg_constraint
    where conname = 'quote_analyses_seal_nonce_format'
      and conrelid = 'public.quote_analyses'::regclass
  ) then
    alter table public.quote_analyses
      add constraint quote_analyses_seal_nonce_format
      check (seal_nonce is null or seal_nonce ~ '^[0-9a-f]{32}$');
  end if;
end
$$;

create unique index if not exists quote_analyses_seal_nonce_key
  on public.quote_analyses (seal_nonce)
  where seal_nonce is not null;

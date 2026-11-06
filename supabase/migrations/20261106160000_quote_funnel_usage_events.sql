-- Quote upload funnel on usage_events.
-- File only — do not apply from this change. Aaron applies it.
-- Until this is applied, new event types fail the old check and are skipped.
-- quote_page, quote_all_ticked, quote_copy_reply, report_official_link, and
-- report_share keep inserting, because detail is omitted when empty.
-- Rollback: supabase/rollbacks/20261106160000_quote_funnel_usage_events.down.sql
--
-- detail is a short reason code. It is not a name, email, phone, filename, or free text.

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint as con
    join pg_class as rel on rel.oid = con.conrelid
    join pg_namespace as nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'usage_events'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%event_type%'
  loop
    execute format('alter table public.usage_events drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.usage_events
  add constraint usage_events_event_type_check
  check (event_type in (
    'quote_page',
    'quote_upload_open',
    'quote_upload_unavailable',
    'quote_file_pick',
    'quote_extract_start',
    'quote_extract_ok',
    'quote_extract_fail',
    'quote_otp_start',
    'quote_otp_success',
    'quote_otp_fail',
    'quote_analyze_start',
    'quote_analyze_ok',
    'quote_analyze_fail',
    'quote_all_ticked',
    'quote_copy_reply',
    'report_official_link',
    'report_share'
  ));

alter table public.usage_events
  add column if not exists detail text;

alter table public.usage_events drop constraint if exists usage_events_detail_check;

alter table public.usage_events
  add constraint usage_events_detail_check
  check (detail is null or detail ~ '^[a-z][a-z0-9_]{0,31}$');

comment on column public.usage_events.detail is
  'Short reason code for a failed quote-upload step. Not a name, email, phone, filename, or free text.';

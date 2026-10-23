-- Drops the retention function, usage_events, and search_events.anon_id.
-- Rows stored there are lost.
-- Not applied by supabase db push. Run only after explicit approval.

drop function if exists public.purge_returning_user_anon_ids();

drop table if exists public.usage_events;

drop index if exists public.search_events_anon_id_created_at_idx;

alter table public.search_events
  drop column if exists anon_id;

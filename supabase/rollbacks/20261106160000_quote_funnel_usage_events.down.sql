-- Reverses 20261106160000_quote_funnel_usage_events.sql.
-- Deletes funnel rows whose event_type is not in the previous allow-list,
-- then restores that check and drops detail. Anonymous counts only.
-- Run only after explicit approval.

delete from public.usage_events
 where event_type not in (
   'quote_page',
   'quote_all_ticked',
   'quote_copy_reply',
   'report_official_link',
   'report_share'
 );

alter table public.usage_events drop constraint if exists usage_events_detail_check;
alter table public.usage_events drop column if exists detail;

alter table public.usage_events drop constraint if exists usage_events_event_type_check;

alter table public.usage_events
  add constraint usage_events_event_type_check
  check (event_type in (
    'quote_page',
    'quote_all_ticked',
    'quote_copy_reply',
    'report_official_link',
    'report_share'
  ));

-- EMERGENCY: data loss. Drops quote analysis tables, functions, and every row.
-- Not applied by supabase db push. Run only after explicit approval.
-- Does not revoke service_role.

drop function if exists public.take_auth_rate_limit(text, integer, integer, integer);
drop function if exists public.finish_quote_analysis(uuid, text, bigint, smallint, jsonb, integer, integer, text);
drop function if exists public.begin_quote_analysis(uuid, bigint, integer, bigint);
drop table if exists public.auth_otp_rate_limits;
drop table if exists public.quote_analysis_claims;
drop table if exists public.quote_analyses;
drop table if exists public.quote_spend_daily;

-- ============================================================================
-- 20260420010000_shadowban_via_user_settings.sql
--
-- Hotfix to 20260420000000_consolidated_security_perf_fixes.sql.
--
-- The existing `enforce_profile_show_in_discover` BEFORE trigger on
-- public.profiles forces show_in_discover to mirror
-- user_settings.profile_visible on every write. That means the previous
-- shadowban function (which wrote directly to profiles.show_in_discover)
-- was being silently negated, and a profile with 3 distinct reporters
-- stayed discoverable.
--
-- Fix: write to user_settings.profile_visible instead. The
-- sync_profile_show_in_discover AFTER trigger on user_settings then
-- propagates the change back down to profiles. This respects the established
-- single-source-of-truth pattern.
--
-- Also drops the duplicate trigger added in the previous migration; the
-- existing `auto_shadowban_on_report` trigger remains and now does the
-- right thing.
-- ============================================================================

drop trigger if exists trg_auto_shadowban_after_report_insert on public.reports;

create or replace function public.auto_shadowban_reported_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  distinct_reporter_count int;
  shadowban_threshold constant int := 3;
begin
  select count(distinct reporter_id)
    into distinct_reporter_count
  from public.reports
  where reported_id = new.reported_id;

  if distinct_reporter_count >= shadowban_threshold then
    update public.user_settings
       set profile_visible = false
     where user_id = new.reported_id
       and profile_visible is distinct from false;
  end if;

  return new;
end;
$$;

-- Backfill: historical reports never re-fire the trigger, so flip the
-- visibility flag for anyone already past the threshold.
update public.user_settings
set profile_visible = false
where user_id in (
  select reported_id
  from public.reports
  group by reported_id
  having count(distinct reporter_id) >= 3
)
and profile_visible is distinct from false;

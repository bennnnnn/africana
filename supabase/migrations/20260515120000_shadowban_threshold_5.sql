-- ============================================================================
-- 20260515120000_shadowban_threshold_5.sql
--
-- UX review: increase shadowban threshold from 3 to 5 distinct reporters.
-- 3 is too low — a small coordinated group can silently nuke any profile.
-- ============================================================================

create or replace function public.auto_shadowban_reported_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  distinct_reporter_count int;
  shadowban_threshold constant int := 5;
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

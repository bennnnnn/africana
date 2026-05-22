-- Prevent shadowbanned users from re-enabling discover visibility from the client.

alter table public.user_settings
  add column if not exists moderation_locked boolean not null default false;

comment on column public.user_settings.moderation_locked is
  'When true, profile_visible cannot be turned back on by the user (set by auto-shadowban).';

-- Shadowban: hide profile and lock visibility toggle.
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
       set profile_visible = false,
           moderation_locked = true
     where user_id = new.reported_id
       and (profile_visible is distinct from false or moderation_locked is distinct from true);
  end if;

  return new;
end;
$$;

revoke all on function public.auto_shadowban_reported_profile() from public;
revoke execute on function public.auto_shadowban_reported_profile() from anon, authenticated;

-- Users cannot clear moderation_lock or re-enable profile_visible while locked.
create or replace function public.enforce_user_settings_moderation_lock()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if coalesce(old.moderation_locked, false) then
    if new.moderation_locked is distinct from old.moderation_locked
       and new.moderation_locked = false then
      raise exception 'Moderation lock cannot be cleared by users'
        using errcode = '42501';
    end if;
    if new.profile_visible is distinct from old.profile_visible
       and new.profile_visible = true then
      raise exception 'Profile visibility is restricted by moderation'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_user_settings_moderation_lock() from public;
revoke execute on function public.enforce_user_settings_moderation_lock() from anon, authenticated;

drop trigger if exists trg_user_settings_moderation_lock on public.user_settings;
create trigger trg_user_settings_moderation_lock
  before update on public.user_settings
  for each row
  execute function public.enforce_user_settings_moderation_lock();

-- Backfill lock for users already hidden by prior shadowban reports.
update public.user_settings us
set moderation_locked = true
where profile_visible = false
  and moderation_locked = false
  and exists (
    select 1
    from public.reports r
    where r.reported_id = us.user_id
    group by r.reported_id
    having count(distinct r.reporter_id) >= 5
  );

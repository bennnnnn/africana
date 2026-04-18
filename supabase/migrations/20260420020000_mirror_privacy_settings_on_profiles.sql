-- ============================================================================
-- 20260420020000_mirror_privacy_settings_on_profiles.sql
--
-- Two columns are referenced all over the client (chat, profile, online tab,
-- discover store) on public.profiles but were never actually added to the
-- table:
--   * accepts_messages   -- mirror of user_settings.receive_messages
--   * online_visible     -- mirror of user_settings.show_online_status
--
-- The existing pattern for cross-table privacy is the show_in_discover mirror
-- (enforce_profile_show_in_discover BEFORE trigger on profiles +
--  sync_profile_show_in_discover AFTER trigger on user_settings). We extend
-- that same pattern so other authenticated users — who can't read another
-- user_settings row — can still respect the owner's preferences.
--
-- Without these columns, every chat thread open and online-tab fetch was
-- returning HTTP 400 from PostgREST.
-- ============================================================================

-- 1. Columns
alter table public.profiles
  add column if not exists accepts_messages boolean not null default true,
  add column if not exists online_visible   boolean not null default true;

-- 2. Replace the BEFORE INSERT/UPDATE enforcement on profiles to cover all
--    three mirrored fields in a single trigger pass.
create or replace function public.enforce_profile_privacy_mirror()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  s_visible boolean;
  s_accepts boolean;
  s_online  boolean;
begin
  select s.profile_visible,
         s.receive_messages,
         s.show_online_status
    into s_visible, s_accepts, s_online
  from public.user_settings s
  where s.user_id = new.id;

  if found then
    new.show_in_discover := coalesce(s_visible, true);
    new.accepts_messages := coalesce(s_accepts, true);
    new.online_visible   := coalesce(s_online,  true);
  else
    new.show_in_discover := true;
    new.accepts_messages := true;
    new.online_visible   := true;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_enforce_show_in_discover on public.profiles;
drop trigger if exists profiles_enforce_privacy_mirror on public.profiles;
create trigger profiles_enforce_privacy_mirror
  before insert or update on public.profiles
  for each row execute function public.enforce_profile_privacy_mirror();

-- 3. Replace the AFTER INSERT/UPDATE sync on user_settings so changes to any
--    of the three privacy columns propagate to public.profiles.
create or replace function public.sync_profile_privacy_mirror()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
     set show_in_discover = coalesce(new.profile_visible, true),
         accepts_messages = coalesce(new.receive_messages, true),
         online_visible   = coalesce(new.show_online_status, true)
   where id = new.user_id;
  return new;
end;
$$;

drop trigger if exists user_settings_sync_show_in_discover on public.user_settings;
drop trigger if exists user_settings_sync_privacy_mirror on public.user_settings;
create trigger user_settings_sync_privacy_mirror
  after insert or update of profile_visible, receive_messages, show_online_status
  on public.user_settings
  for each row execute function public.sync_profile_privacy_mirror();

-- 4. Backfill: copy current user_settings values into the new profile columns.
update public.profiles p
set accepts_messages = coalesce(s.receive_messages, true),
    online_visible   = coalesce(s.show_online_status, true)
from public.user_settings s
where s.user_id = p.id
  and (
    p.accepts_messages is distinct from coalesce(s.receive_messages, true) or
    p.online_visible   is distinct from coalesce(s.show_online_status, true)
  );

-- 5. Index online_visible — the online tab filters on it, and discover uses it
--    to gate "online_status" rendering. Cheap to add.
create index if not exists profiles_online_visible_idx
  on public.profiles (online_visible)
  where online_visible = true;

-- Tighten profiles SELECT: honor blocks + show_in_discover.
--
-- Goals:
--  - A blocked user cannot enumerate/view the blocker's profile row.
--  - A hidden profile (show_in_discover=false) is not readable via direct UUID lookup,
--    except by the profile owner themselves.
--
-- NOTE: This intentionally does not special-case "matched" / "conversation participants".
-- If you want hidden users to remain viewable to prior matches, add an allow-list clause.

drop policy if exists "Public profiles are viewable by authenticated users" on public.profiles;

create policy "Profiles are viewable when visible and not blocked"
  on public.profiles
  for select
  to authenticated
  using (
    -- Always allow reading your own profile.
    id = (select auth.uid())
    or (
      -- Otherwise, only visible profiles…
      coalesce(show_in_discover, true) = true
      -- …and never across a symmetric block relationship.
      and not exists (
        select 1
        from public.blocks b
        where
          (b.blocker_id = public.profiles.id and b.blocked_id = (select auth.uid()))
          or
          (b.blocker_id = (select auth.uid()) and b.blocked_id = public.profiles.id)
      )
    )
  );


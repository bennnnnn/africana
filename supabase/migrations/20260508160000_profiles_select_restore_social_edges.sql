-- Restore profile visibility for messaging and existing social edges.
--
-- 20260508032309 required show_in_discover=true for all other users, which
-- removed the ability to read a peer’s row when they hide from Discover —
-- breaking inbox avatars, chat headers, and any flow that needs photos for
-- someone you already message / like / favourite.

-- Replace whichever SELECT policy is current (tightened name vs older migration name).
drop policy if exists "Profiles are viewable when visible and not blocked" on public.profiles;
drop policy if exists "Profiles viewable with visibility rules" on public.profiles;

create policy "Profiles viewable with visibility rules"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (
      not exists (
        select 1
        from public.blocks b
        where
          (b.blocker_id = public.profiles.id and b.blocked_id = (select auth.uid()))
          or
          (b.blocker_id = (select auth.uid()) and b.blocked_id = public.profiles.id)
      )
      and (
        coalesce(show_in_discover, true) = true
        or exists (
          select 1
          from public.likes l
          where
            (l.from_user_id = (select auth.uid()) and l.to_user_id = profiles.id)
            or
            (l.to_user_id = (select auth.uid()) and l.from_user_id = profiles.id)
        )
        or exists (
          select 1
          from public.favourites f
          where
            (f.user_id = (select auth.uid()) and f.favourited_id = profiles.id)
            or
            (f.favourited_id = (select auth.uid()) and f.user_id = profiles.id)
        )
        or exists (
          select 1
          from public.conversations c
          where
            (select auth.uid()) = any (c.participant_ids)
            and profiles.id = any (c.participant_ids)
        )
      )
    )
  );

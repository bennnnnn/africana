-- Prevent new likes / favourites when a symmetric block exists (matches message guard).

create or replace function public.enforce_likes_respect_blocks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = new.from_user_id and b.blocked_id = new.to_user_id)
       or (b.blocker_id = new.to_user_id and b.blocked_id = new.from_user_id)
  ) then
    raise exception 'interaction blocked between participants'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists likes_enforce_blocks on public.likes;
create trigger likes_enforce_blocks
  before insert on public.likes
  for each row
  execute function public.enforce_likes_respect_blocks();

create or replace function public.enforce_favourites_respect_blocks()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = new.user_id and b.blocked_id = new.favourited_id)
       or (b.blocker_id = new.favourited_id and b.blocked_id = new.user_id)
  ) then
    raise exception 'interaction blocked between participants'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists favourites_enforce_blocks on public.favourites;
create trigger favourites_enforce_blocks
  before insert on public.favourites
  for each row
  execute function public.enforce_favourites_respect_blocks();

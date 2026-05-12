-- Account deletion: move SECURITY DEFINER + auth.users/storage deletes off the public
-- PostgREST RPC surface (linter 0029). Clients call Edge Function `delete-account`, which
-- verifies the JWT then invokes this with the service role.

create or replace function public.delete_user_by_id(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  delete from storage.objects
  where bucket_id in ('avatars', 'profile-photos', 'verification-photos')
    and (storage.foldername(name))[1] = p_user_id::text;

  delete from public.profiles where id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.delete_user_by_id(uuid) from public;
revoke execute on function public.delete_user_by_id(uuid) from anon, authenticated;
grant execute on function public.delete_user_by_id(uuid) to service_role;

drop function if exists public.delete_user();

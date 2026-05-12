-- Supabase blocks direct deletes from storage.objects. The Edge Function deletes
-- user-owned storage files via the Storage API before calling this RPC.

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

  delete from public.profiles where id = p_user_id;
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.delete_user_by_id(uuid) from public;
revoke execute on function public.delete_user_by_id(uuid) from anon, authenticated;
grant execute on function public.delete_user_by_id(uuid) to service_role;

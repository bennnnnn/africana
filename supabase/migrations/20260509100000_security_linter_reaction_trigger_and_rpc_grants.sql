-- Database linter (Supabase advisors):
--   0011 — set_message_reaction_conversation_id: SET search_path
--   0028 — anon must not EXECUTE SECURITY DEFINER functions exposed via PostgREST
--
-- Note: soft_delete_message_for_self is INVOKER as of 20260509150000. delete_user was
-- removed in 20260509200000 (Edge Function delete-account + delete_user_by_id for service_role).

-- ── Trigger helper: immutable search_path; not a user-callable RPC ───────────
create or replace function public.set_message_reaction_conversation_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select m.conversation_id into new.conversation_id
  from public.messages m
  where m.id = new.message_id;
  return new;
end;
$$;

revoke all on function public.set_message_reaction_conversation_id() from public;
revoke execute on function public.set_message_reaction_conversation_id() from anon, authenticated;

-- ── Soft-delete for self: ensure anon cannot call (0028) ────────────────────
revoke execute on function public.soft_delete_message_for_self(uuid) from public, anon;
grant execute on function public.soft_delete_message_for_self(uuid) to authenticated;

-- ── Account deletion RPC: re-assert grants after CREATE OR REPLACE elsewhere ─
revoke execute on function public.delete_user() from public, anon;
grant execute on function public.delete_user() to authenticated;

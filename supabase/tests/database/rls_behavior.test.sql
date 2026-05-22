-- pgTAP: behavioral RLS / triggers (blocks, message delete, discover visibility).
-- Run: supabase test db
begin;

create extension if not exists pgtap with schema extensions;
create extension if not exists pgcrypto with schema extensions;

select plan(6);

-- Fixed test user ids
do $setup$
declare
  alice uuid := 'a0000000-0000-4000-8000-000000000001';
  bob uuid := 'b0000000-0000-4000-8000-000000000002';
  hidden uuid := 'c0000000-0000-4000-8000-000000000003';
  conv_id uuid := 'd0000000-0000-4000-8000-000000000004';
  msg_alice uuid := 'e0000000-0000-4000-8000-000000000001';
  inst uuid := '00000000-0000-0000-0000-000000000000';
begin
  -- Fixtures as superuser (bypass RLS)
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, email_change, email_change_token_new, recovery_token
  )
  values
    (alice, inst, 'authenticated', 'authenticated', 'alice@test.local', crypt('pw', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    (bob, inst, 'authenticated', 'authenticated', 'bob@test.local', crypt('pw', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
    (hidden, inst, 'authenticated', 'authenticated', 'hidden@test.local', crypt('pw', gen_salt('bf')), now(),
     '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
  on conflict (id) do nothing;

  insert into public.profiles (
    id, full_name, username, birthdate, gender, country, looking_for, favorite_interests,
    profile_photos, avatar_url, show_in_discover, online_status, last_seen, verification_status, verified
  )
  values
    (alice, 'Alice', 'alice', '1995-01-01', 'female', 'US', '{}', '{}',
     array['https://example.com/a.jpg'], 'https://example.com/a.jpg', true, 'offline', now(), 'none', false),
    (bob, 'Bob', 'bob', '1995-01-01', 'male', 'US', '{}', '{}',
     array['https://example.com/b.jpg'], 'https://example.com/b.jpg', true, 'offline', now(), 'none', false),
    (hidden, 'Hidden', 'hidden', '1995-01-01', 'female', 'US', '{}', '{}',
     array['https://example.com/h.jpg'], 'https://example.com/h.jpg', false, 'offline', now(), 'none', false)
  on conflict (id) do update set
    show_in_discover = excluded.show_in_discover,
    avatar_url = excluded.avatar_url,
    profile_photos = excluded.profile_photos;

  insert into public.user_settings (user_id, profile_visible, receive_messages)
  values (alice, true, true), (bob, true, true), (hidden, true, true)
  on conflict (user_id) do update set receive_messages = true, profile_visible = true;

  insert into public.conversations (id, participant_ids, last_message, last_message_at)
  values (conv_id, array[alice, bob], 'hi', now())
  on conflict (id) do nothing;

  insert into public.messages (id, conversation_id, sender_id, content, created_at)
  values (msg_alice, conv_id, alice, 'hello from alice', now())
  on conflict (id) do nothing;

  insert into public.blocks (blocker_id, blocked_id)
  values (bob, hidden)
  on conflict do nothing;
end;
$setup$;

-- Helper: act as authenticated user (Supabase auth.uid() reads jwt sub claim)
create or replace function pg_temp.test_auth_as(p_uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config('request.jwt.claim.role', 'authenticated', true);
  execute 'set local role authenticated';
end;
$$;

-- Bob cannot hard-delete Alice's message
select pg_temp.test_auth_as('b0000000-0000-4000-8000-000000000002'::uuid);
delete from public.messages where id = 'e0000000-0000-4000-8000-000000000001'::uuid;

select is(
  (select count(*)::bigint from public.messages where id = 'e0000000-0000-4000-8000-000000000001'::uuid),
  1::bigint,
  'non-sender cannot hard-delete another user message'
);

-- Alice can hard-delete her own message
select pg_temp.test_auth_as('a0000000-0000-4000-8000-000000000001'::uuid);
delete from public.messages
where id = 'e0000000-0000-4000-8000-000000000001'::uuid
  and sender_id = 'a0000000-0000-4000-8000-000000000001'::uuid;

select is(
  (select count(*)::bigint from public.messages where id = 'e0000000-0000-4000-8000-000000000001'::uuid),
  0::bigint,
  'sender can hard-delete own message'
);

-- Re-insert message for block test
insert into public.messages (id, conversation_id, sender_id, content, created_at)
values (
  'e0000000-0000-4000-8000-000000000002'::uuid,
  'd0000000-0000-4000-8000-000000000004'::uuid,
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'blocked attempt',
  now()
)
on conflict (id) do nothing;

insert into public.blocks (blocker_id, blocked_id)
values (
  'a0000000-0000-4000-8000-000000000001'::uuid,
  'b0000000-0000-4000-8000-000000000002'::uuid
)
on conflict do nothing;

select pg_temp.test_auth_as('a0000000-0000-4000-8000-000000000001'::uuid);

select throws_ok(
  $$
    insert into public.messages (conversation_id, sender_id, content)
    values (
      'd0000000-0000-4000-8000-000000000004'::uuid,
      'a0000000-0000-4000-8000-000000000001'::uuid,
      'should fail'
    );
  $$,
  '23514',
  'message insert blocked when symmetric block exists'
);

-- Hidden profile not returned in discover RPC for Bob
select pg_temp.test_auth_as('b0000000-0000-4000-8000-000000000002'::uuid);

select is(
  (
    select count(*)::bigint
    from public.fetch_discover_profiles_page(
      'b0000000-0000-4000-8000-000000000002'::uuid,
      null, 18, 100, null, null, null, null, false, false, true, 50, 0
    ) p
    where p.id = 'c0000000-0000-4000-8000-000000000003'::uuid
  ),
  0::bigint,
  'profiles with show_in_discover=false are excluded from discover RPC'
);

-- Bob cannot SELECT hidden profile (blocked + not in discover, no social edge)
select is(
  (
    select count(*)::bigint
    from public.profiles
    where id = 'c0000000-0000-4000-8000-000000000003'::uuid
  ),
  0::bigint,
  'blocked hidden profile is not visible to viewer'
);

select * from finish();
rollback;

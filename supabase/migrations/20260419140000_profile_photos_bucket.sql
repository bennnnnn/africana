-- `profile-photos` storage bucket + RLS.
--
-- The client uploads verification selfies (app/(settings)/verify.tsx) and
-- additional profile photos to this bucket using the pattern
--   `${userId}/<filename>`
-- `src/lib/storage-image-upload.ts` has shipped against it for a while, and
-- `delete_user()` in 20260417000000 already wipes it on account deletion, but
-- the bucket row and storage-policies were never committed as a migration —
-- so in any environment where they weren't added manually, uploads fail with
-- "new row violates row-level security policy". This migration makes the
-- setup reproducible and idempotent.

-- ── Bucket ──────────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('profile-photos', 'profile-photos', true)
on conflict (id) do update
  set public = excluded.public,
      name   = excluded.name;

-- ── RLS policies (mirrors the `avatars` bucket pattern) ────────────────────
-- Drop-and-recreate so re-runs converge even if a policy with the same name
-- already exists with slightly different predicates.

drop policy if exists "Profile photos are publicly accessible"
  on storage.objects;
create policy "Profile photos are publicly accessible"
  on storage.objects for select
  using (bucket_id = 'profile-photos');

drop policy if exists "Users can upload own profile photos"
  on storage.objects;
create policy "Users can upload own profile photos"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'profile-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update own profile photos"
  on storage.objects;
create policy "Users can update own profile photos"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete own profile photos"
  on storage.objects;
create policy "Users can delete own profile photos"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'profile-photos'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

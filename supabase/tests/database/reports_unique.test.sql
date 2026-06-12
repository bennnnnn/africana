-- pgTAP: one report per reporter → reported profile.
-- Run: supabase test db
begin;

create extension if not exists pgtap with schema extensions;

select plan(1);

select ok(
  exists (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'reports'
      AND c.contype = 'u'
      AND pg_get_constraintdef(c.oid) LIKE '%(reporter_id, reported_id)%'
  ),
  'reports has UNIQUE(reporter_id, reported_id)'
);

select * from finish();
rollback;

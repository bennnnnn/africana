# Database migrations

**Source of truth:** every file in this folder, applied in timestamp order via `supabase db reset` or `supabase db push`.

## Fresh local database

```bash
# Requires Docker Desktop running
supabase db reset
```

Then run app tests:

```bash
npm run typecheck
npm test
supabase test db
```

Database tests live in `supabase/tests/database/`:

- `rls_policies.test.sql` — policy / RPC presence
- `rls_behavior.test.sql` — block, message delete, discover visibility (uses jwt simulation)
- `discover_feed_rpc.test.sql` — discover RPC filter predicates
- `conversation_messages_security.test.sql` — messages/conversation security objects

## `00000000000000_initial_schema.sql`

This is a **no-op placeholder**, not a full schema dump. The real schema is created by later migrations (from `20240101000001` onward). Do not expect a single-file rebuild from that file alone.

To generate a **reference dump** from production (optional, for audits or squashes):

```bash
npm run db:dump-schema
```

That requires Docker (Supabase CLI runs `pg_dump` in a container). Without Docker, use the Dashboard SQL editor or `pg_dump` with your database connection string.

## Squashing migrations

If you replace history with one baseline file, coordinate a **migration squash** on all environments. Until then, keep adding new dated migrations for every change.

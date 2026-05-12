# Africana — Supabase Edge Functions

## Deploy

```bash
# Install the Supabase CLI first (if not already installed)
brew install supabase/tap/supabase

# Log in
supabase login

# Link to your project (find Project Ref in Supabase dashboard → Settings → General)
supabase link --project-ref <YOUR_PROJECT_REF>

# Deploy the notify function
supabase functions deploy notify

# Deploy the daily away-email sweep
supabase functions deploy email-lifecycle-sweep

# Account deletion (calls service-only RPC; JWT verified in-function)
supabase functions deploy delete-account

# Set Edge Function secrets (Dashboard → Edge Functions → Secrets, or `supabase secrets set`):
#   RESEND_API_KEY   — Resend API key (emails are skipped if unset)
#   RESEND_FROM      — optional, default `Africana <noreply@africana.app>` (use your verified domain)
```

## Functions

### `notify`
Sends push notifications, optional activity emails, and lifecycle emails.

**Called by the client after:**
- New message sent
- User is liked
- Mutual match detected
- Profile viewed (if the viewer has view notifications ON)
- Welcome email check after sign-in
- First message email check
- First like email check

**Payload:**
```json
{
  "type": "message" | "like" | "match" | "view",
  "recipientId": "uuid",
  "senderId": "uuid",
  "senderName": "Amara Osei",
  "extra": { "conversationId": "..." }
}
```

### `email-lifecycle-sweep`
Runs daily **re-engagement** milestones for users whose `profiles.last_seen` is older than **7, 14, or 30 days**. Each milestone sends an **Expo push first** (if the user has a stored push token); a **Resend email** is sent only when **Settings → Email updates** is on. Welcome / first-message / first-like campaigns are triggered from the client via `notify`, not this sweep.

### `delete-account`
**POST** with the user’s `Authorization: Bearer` session. Verifies the JWT, then runs `delete_user_by_id` with the **service role** (not exposed as a public `delete_user` RPC). Used from **Settings → Delete account** after re-auth.

## Environment Variables

Auto-injected on every function (see [Supabase docs](https://supabase.com/docs/guides/functions/secrets)):
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEYS` (JSON; use `['default']` for the publishable key string)
- `SUPABASE_SERVICE_ROLE_KEY`

Email (set manually):
- `RESEND_API_KEY` — required for any Resend delivery
- `RESEND_FROM` — optional verified sender

Sweep security (set manually — **required before deploying email-lifecycle-sweep**):
- `SWEEP_SECRET` — random shared secret that the cron job must pass via `x-sweep-secret` header.
  Without this the function returns 401 to every request.

  Generate one:
  ```bash
  openssl rand -hex 32
  ```
  Set it:
  ```bash
  supabase secrets set SWEEP_SECRET=<your-value>
  ```
  Then replace `<YOUR_SWEEP_SECRET>` in migration `20260511053313_sweep_secret_cron_header.sql`
  with the same value and apply the migration (`supabase db push`).

Activity and lifecycle pushes use [Expo’s push API](https://docs.expo.dev/push-notifications/sending-notifications/); ensure the project’s FCM credentials are configured for Android.

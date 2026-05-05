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

# Set the required env vars (only service_role key is needed — SUPABASE_URL is auto-set)
# No extra secrets needed; the function uses SUPABASE_SERVICE_ROLE_KEY which is auto-injected.
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
Runs the daily away-email milestones for users who have not opened the app for 3, 7, 14, 21, or 30 days.

## Environment Variables

The function uses:
- `SUPABASE_URL` — auto-injected
- `SUPABASE_SERVICE_ROLE_KEY` — auto-injected (used to bypass RLS for reading user settings)

No additional configuration needed.

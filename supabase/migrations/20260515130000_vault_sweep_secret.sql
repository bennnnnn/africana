-- Replace hardcoded sweep secret with Supabase Vault lookup.
--
-- Before applying this migration:
--   1. Generate a new random secret:  openssl rand -hex 32
--   2. Store it in the Supabase Vault via Dashboard → Secrets, or:
--        SELECT vault.create_secret('NEW_SECRET_VALUE', 'SWEEP_SECRET');
--   3. Store the anon key the same way:
--        SELECT vault.create_secret('YOUR_ANON_KEY', 'ANON_KEY');
--      (The anon key is in Project Settings → API → anon/public key)
--   4. The old hardcoded secret in migration 20260511053313 is now rotated.
--
-- This function runs with SECURITY DEFINER so cron can access vault secrets.

CREATE OR REPLACE FUNCTION get_sweep_secret()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  secret text;
BEGIN
  SELECT decrypted_secret INTO secret
  FROM vault.decrypted_secrets
  WHERE name = 'SWEEP_SECRET';

  IF secret IS NULL THEN
    RAISE EXCEPTION 'SWEEP_SECRET not found in vault. Run: SELECT vault.create_secret(''<value>'', ''SWEEP_SECRET'');';
  END IF;

  RETURN secret;
END;
$$;

CREATE OR REPLACE FUNCTION get_anon_key()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  key text;
BEGIN
  SELECT decrypted_secret INTO key
  FROM vault.decrypted_secrets
  WHERE name = 'ANON_KEY';

  IF key IS NULL THEN
    RAISE EXCEPTION 'ANON_KEY not found in vault. Run: SELECT vault.create_secret(''<value>'', ''ANON_KEY'');';
  END IF;

  RETURN key;
END;
$$;

-- Reschedule the cron job to use the vault-backed functions.
-- We unschedule the old one (with hardcoded secret) and create a fresh one.
DO $$
DECLARE
  existing_job_id bigint;
BEGIN
  SELECT jobid INTO existing_job_id
  FROM cron.job
  WHERE jobname = 'daily-email-lifecycle-sweep';

  IF existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(existing_job_id);
  END IF;
END
$$;

SELECT cron.schedule(
  'daily-email-lifecycle-sweep',
  '15 9 * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://smosvscutnzrrqgyqzhd.supabase.co/functions/v1/email-lifecycle-sweep',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || get_anon_key(),
        'apikey', get_anon_key(),
        'x-sweep-secret', get_sweep_secret()
      ),
      body := '{}'::jsonb
    );
  $$
);

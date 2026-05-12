-- Reschedule the daily email sweep cron to include the x-sweep-secret header.
--
-- Before applying this migration:
--   1. Generate a random secret:  openssl rand -hex 32
--   2. Set it as an Edge Function secret:
--        supabase secrets set SWEEP_SECRET=<your-value>
--   3. Replace <YOUR_SWEEP_SECRET> below with the same value.
--
-- The Edge Function now returns 401 for any call that omits or mismatches
-- this header, blocking abuse via the public anon key.

do $$
declare
  existing_job_id bigint;
begin
  select jobid into existing_job_id
  from cron.job
  where jobname = 'daily-email-lifecycle-sweep';

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;
end
$$;

select cron.schedule(
  'daily-email-lifecycle-sweep',
  '15 9 * * *',
  $$
  select
    net.http_post(
      url := 'https://smosvscutnzrrqgyqzhd.supabase.co/functions/v1/email-lifecycle-sweep',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtb3N2c2N1dG56cnJxZ3lxemhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTg4NjMsImV4cCI6MjA5MDU5NDg2M30.DPkvFGiTDesKuNCr1ypBRswDXLfSrB6UhlIN262LIMA',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtb3N2c2N1dG56cnJxZ3lxemhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTg4NjMsImV4cCI6MjA5MDU5NDg2M30.DPkvFGiTDesKuNCr1ypBRswDXLfSrB6UhlIN262LIMA',
        'x-sweep-secret', '04937d2d40181fce5e23f49f7423900a37e88a0849c6fd1bca85d1659697f3e0'
      ),
      body := '{}'::jsonb
    );
  $$
);

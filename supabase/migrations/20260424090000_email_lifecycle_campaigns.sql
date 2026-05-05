create extension if not exists pg_cron with schema extensions;
create extension if not exists pg_net with schema extensions;

create table if not exists public.email_campaign_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  campaign_key text not null,
  sent_at timestamptz not null default timezone('utc', now()),
  trigger_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint email_campaign_events_user_campaign_key_key unique (user_id, campaign_key)
);

alter table public.email_campaign_events enable row level security;

create index if not exists email_campaign_events_campaign_sent_idx
  on public.email_campaign_events (campaign_key, sent_at desc);

revoke all on public.email_campaign_events from anon, authenticated;

create or replace function public.claim_email_campaign_event(
  p_user_id uuid,
  p_campaign_key text,
  p_trigger_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
set search_path = public
as $$
begin
  insert into public.email_campaign_events (user_id, campaign_key, trigger_metadata)
  values (p_user_id, p_campaign_key, coalesce(p_trigger_metadata, '{}'::jsonb))
  on conflict (user_id, campaign_key) do nothing;

  return found;
end;
$$;

create or replace function public.get_email_campaign_candidates(
  p_campaign_key text,
  p_last_seen_before timestamptz,
  p_limit integer default 500
)
returns table (
  user_id uuid,
  full_name text,
  last_seen timestamptz
)
language sql
set search_path = public
as $$
  select
    profiles.id as user_id,
    profiles.full_name,
    profiles.last_seen
  from public.profiles
  where profiles.last_seen is not null
    and profiles.last_seen <= p_last_seen_before
    and not exists (
      select 1
      from public.email_campaign_events events
      where events.user_id = profiles.id
        and events.campaign_key = p_campaign_key
    )
  order by profiles.last_seen asc
  limit greatest(coalesce(p_limit, 500), 1)
$$;

revoke all on function public.claim_email_campaign_event(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.get_email_campaign_candidates(text, timestamptz, integer) from public, anon, authenticated;

do $$
declare
  existing_job_id bigint;
begin
  select jobid
  into existing_job_id
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
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNtb3N2c2N1dG56cnJxZ3lxemhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTg4NjMsImV4cCI6MjA5MDU5NDg2M30.DPkvFGiTDesKuNCr1ypBRswDXLfSrB6UhlIN262LIMA'
      ),
      body := '{}'::jsonb
    );
  $$
);

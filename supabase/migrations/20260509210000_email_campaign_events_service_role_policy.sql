do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'email_campaign_events'
      and policyname = 'service_role_manage_email_campaign_events'
  ) then
    create policy "service_role_manage_email_campaign_events"
      on public.email_campaign_events
      as permissive
      for all
      to service_role
      using (true)
      with check (true);
  end if;
end
$$;


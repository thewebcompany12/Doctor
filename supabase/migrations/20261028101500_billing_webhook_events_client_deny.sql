drop policy if exists billing_webhook_events_client_deny on public.billing_webhook_events;
create policy billing_webhook_events_client_deny on public.billing_webhook_events as restrictive for all to anon, authenticated using (false) with check (false);
revoke all on public.billing_webhook_events from anon, authenticated;

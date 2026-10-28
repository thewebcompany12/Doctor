-- Explicitly document the deny-by-default policy for privileged webhook event data.
-- Only trusted service_role code has table grants; client roles are denied at both grants and RLS.
create policy billing_webhook_events_deny_client_roles
on public.billing_webhook_events
as restrictive
for all
to anon, authenticated
using (false)
with check (false);

revoke all on table public.billing_webhook_events from public, anon, authenticated;

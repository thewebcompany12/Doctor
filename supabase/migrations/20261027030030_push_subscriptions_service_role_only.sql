-- Push subscription records contain browser endpoints and cryptographic keys.
-- Keep them server-only; no anon or authenticated policy is intentionally provided.
create policy push_subscriptions_service_role_only
on public.push_subscriptions
for all
to service_role
using (true)
with check (true);

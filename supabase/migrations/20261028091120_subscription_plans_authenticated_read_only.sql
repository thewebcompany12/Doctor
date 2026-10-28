-- Keep plan catalog reads authenticated-only. The public website does not
-- need direct anonymous access to the billing catalog; public content is served
-- only through explicit clinic/queue projections.
revoke select on public.subscription_plans from anon;
drop policy if exists subscription_plans_public_read on public.subscription_plans;
drop policy if exists subscription_plans_authenticated_read on public.subscription_plans;
create policy subscription_plans_authenticated_read on public.subscription_plans
 for select to authenticated using (is_public and is_active);
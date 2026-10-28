create index if not exists billing_invoices_clinic_id_idx on public.billing_invoices(clinic_id);
create index if not exists billing_invoices_subscription_id_idx on public.billing_invoices(subscription_id);
create index if not exists billing_payments_plan_id_idx on public.billing_payments(plan_id);
create index if not exists billing_subscription_history_actor_user_id_idx on public.billing_subscription_history(actor_user_id);
create index if not exists billing_subscription_history_subscription_id_idx on public.billing_subscription_history(subscription_id);
create index if not exists clinic_subscriptions_created_by_idx on public.clinic_subscriptions(created_by);
create index if not exists clinic_subscriptions_plan_id_idx on public.clinic_subscriptions(plan_id);
create index if not exists subscription_plans_created_by_idx on public.subscription_plans(created_by);

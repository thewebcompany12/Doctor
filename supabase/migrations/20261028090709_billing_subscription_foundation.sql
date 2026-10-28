-- Reproducible source for billing_subscription_foundation, originally applied
-- to the connected project before its source file was checked into GitHub.
-- This migration is additive and safe to run against an empty database. The
-- production database already records this version as applied; do not reapply
-- or reset production to reconcile history.

create table if not exists public.subscription_plans (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check (code ~ '^[a-z0-9][a-z0-9_-]{1,47}$'),
 name text not null check (length(trim(name)) between 2 and 100),
 description text,
 monthly_price_paise bigint not null check (monthly_price_paise >= 0),
 annual_price_paise bigint not null check (annual_price_paise >= 0),
 currency text not null default 'INR' check (currency = 'INR'),
 limits jsonb not null default '{}'::jsonb check (jsonb_typeof(limits) = 'object'),
 features jsonb not null default '{}'::jsonb check (jsonb_typeof(features) = 'object'),
 trial_days integer not null default 0 check (trial_days between 0 and 90),
 is_public boolean not null default false,
 is_active boolean not null default true,
 razorpay_plan_monthly_id text unique,
 razorpay_plan_annual_id text unique,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.clinic_subscriptions (
 id uuid primary key default gen_random_uuid(),
 clinic_id uuid not null references public.clinics(id),
 plan_id uuid not null references public.subscription_plans(id),
 status text not null default 'pending' check (status in ('pending','trialing','active','past_due','cancelled','expired','suspended')),
 billing_interval text not null check (billing_interval in ('monthly','annual')),
 currency text not null default 'INR' check (currency = 'INR'),
 price_paise bigint not null check (price_paise >= 0),
 provider text not null default 'razorpay' check (provider in ('razorpay','manual')),
 provider_subscription_id text unique,
 current_period_start timestamptz,
 current_period_end timestamptz,
 cancel_at_period_end boolean not null default false,
 cancelled_at timestamptz,
 suspended_at timestamptz,
 suspension_reason text,
 last_event_created_at timestamptz,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.billing_payments (
 id uuid primary key default gen_random_uuid(),
 clinic_id uuid not null references public.clinics(id),
 subscription_id uuid not null references public.clinic_subscriptions(id),
 plan_id uuid not null references public.subscription_plans(id),
 provider text not null default 'razorpay' check (provider in ('razorpay','manual')),
 provider_payment_id text unique,
 provider_order_id text,
 amount_paise bigint not null check (amount_paise >= 0),
 currency text not null default 'INR' check (currency = 'INR'),
 status text not null default 'pending' check (status in ('pending','authorized','captured','failed','refunded','disputed','cancelled')),
 billing_interval text not null check (billing_interval in ('monthly','annual')),
 idempotency_key text not null unique,
 invoice_number text unique,
 receipt_url text,
 failure_code text,
 failure_description text,
 provider_created_at timestamptz,
 captured_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);

create table if not exists public.billing_invoices (
 id uuid primary key default gen_random_uuid(),
 clinic_id uuid not null references public.clinics(id),
 subscription_id uuid not null references public.clinic_subscriptions(id),
 payment_id uuid not null unique references public.billing_payments(id),
 invoice_number text not null unique,
 currency text not null default 'INR' check (currency = 'INR'),
 amount_paise bigint not null check (amount_paise >= 0),
 issued_at timestamptz not null default now(),
 metadata jsonb not null default '{}'::jsonb
);

create table if not exists public.billing_subscription_history (
 id uuid primary key default gen_random_uuid(),
 clinic_id uuid not null references public.clinics(id),
 subscription_id uuid references public.clinic_subscriptions(id),
 actor_user_id uuid references auth.users(id),
 action text not null,
 reason text not null check (length(trim(reason)) between 3 and 1000),
 previous_state jsonb not null default '{}'::jsonb,
 new_state jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);

create table if not exists public.billing_webhook_events (
 id uuid primary key default gen_random_uuid(),
 provider text not null default 'razorpay' check (provider = 'razorpay'),
 provider_event_id text not null unique,
 event_type text not null,
 payload_sha256 text not null,
 processing_status text not null default 'received' check (processing_status in ('received','processed','ignored','failed')),
 error_code text,
 received_at timestamptz not null default now(),
 processed_at timestamptz
);

create unique index if not exists subscription_plans_code_key on public.subscription_plans(code);
create unique index if not exists subscription_plans_razorpay_plan_monthly_id_key on public.subscription_plans(razorpay_plan_monthly_id);
create unique index if not exists subscription_plans_razorpay_plan_annual_id_key on public.subscription_plans(razorpay_plan_annual_id);
create unique index if not exists clinic_one_current_subscription_idx on public.clinic_subscriptions(clinic_id) where status in ('pending','trialing','active','past_due','suspended');
create index if not exists clinic_subscriptions_clinic_status_idx on public.clinic_subscriptions(clinic_id,status);
create index if not exists clinic_subscriptions_period_end_idx on public.clinic_subscriptions(status,current_period_end);
create index if not exists billing_payments_clinic_created_idx on public.billing_payments(clinic_id,created_at desc);
create index if not exists billing_payments_subscription_idx on public.billing_payments(subscription_id,created_at desc);
create index if not exists billing_payments_status_created_idx on public.billing_payments(status,created_at desc);
create index if not exists billing_history_clinic_created_idx on public.billing_subscription_history(clinic_id,created_at desc);
create index if not exists billing_webhook_events_status_idx on public.billing_webhook_events(processing_status,received_at);

alter table public.subscription_plans enable row level security;
alter table public.clinic_subscriptions enable row level security;
alter table public.billing_payments enable row level security;
alter table public.billing_invoices enable row level security;
alter table public.billing_subscription_history enable row level security;
alter table public.billing_webhook_events enable row level security;

drop policy if exists subscription_plans_public_read on public.subscription_plans;
create policy subscription_plans_public_read on public.subscription_plans
 for select to anon, authenticated using (is_public and is_active);
drop policy if exists clinic_subscriptions_owner_read on public.clinic_subscriptions;
create policy clinic_subscriptions_owner_read on public.clinic_subscriptions
 for select to authenticated using (private.has_clinic_role(clinic_id,array['owner']));
drop policy if exists billing_payments_owner_read on public.billing_payments;
create policy billing_payments_owner_read on public.billing_payments
 for select to authenticated using (private.has_clinic_role(clinic_id,array['owner']));
drop policy if exists billing_invoices_owner_read on public.billing_invoices;
create policy billing_invoices_owner_read on public.billing_invoices
 for select to authenticated using (private.has_clinic_role(clinic_id,array['owner']));
drop policy if exists billing_history_owner_read on public.billing_subscription_history;
create policy billing_history_owner_read on public.billing_subscription_history
 for select to authenticated using (private.has_clinic_role(clinic_id,array['owner']));

revoke all on public.subscription_plans,public.clinic_subscriptions,public.billing_payments,
 public.billing_invoices,public.billing_subscription_history,public.billing_webhook_events from anon,authenticated;
grant select on public.subscription_plans to anon,authenticated;
grant select on public.clinic_subscriptions,public.billing_payments,public.billing_invoices,public.billing_subscription_history to authenticated;
grant all on public.subscription_plans,public.clinic_subscriptions,public.billing_payments,
 public.billing_invoices,public.billing_subscription_history,public.billing_webhook_events to service_role;

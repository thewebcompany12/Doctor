-- Doctor Queue schema baseline.
-- Reconstructed from the connected project's catalog on 2026-10-26.
-- Safe for a clean database. Existing deployments should use Supabase migration history and must not reset production.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  preferred_language text not null default 'en' check (preferred_language in ('en','hi')),
  must_change_password boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.platform_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role = 'super_admin'),
  created_at timestamptz not null default now()
);
create table if not exists public.clinics (
  id uuid primary key default gen_random_uuid(),
  clinic_code text not null unique,
  name text not null,
  slug text unique,
  description text,
  address text,
  city text,
  state text,
  postal_code text,
  phone text,
  timezone text not null default 'Asia/Kolkata',
  is_active boolean not null default true,
  is_public boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.clinic_memberships (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','doctor','receptionist','compounder','manager')),
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (clinic_id,user_id)
);
create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  specialty text,
  consultation_minutes integer not null default 10 check (consultation_minutes between 1 and 240),
  is_active boolean not null default true,
  is_public boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id,id)
);
create table if not exists public.clinic_hours (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time,
  closes_at time,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  check (is_closed or (opens_at is not null and closes_at is not null and closes_at > opens_at))
);
create table if not exists public.queues (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  doctor_id uuid not null,
  service_date date not null default (timezone('Asia/Kolkata', now()))::date,
  status text not null default 'not_started' check (status in ('not_started','open','paused','closed')),
  token_prefix text not null default 'T',
  next_token_number integer not null default 1 check (next_token_number > 0),
  current_token_id uuid,
  online_booking_enabled boolean not null default false,
  walk_in_enabled boolean not null default true,
  max_tokens integer check (max_tokens is null or max_tokens > 0),
  average_consultation_minutes integer not null default 10 check (average_consultation_minutes between 1 and 240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (clinic_id,doctor_id,service_date),
  foreign key (clinic_id,doctor_id) references public.doctors(clinic_id,id) on delete cascade
);
create table if not exists public.queue_tokens (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  queue_id uuid not null references public.queues(id) on delete cascade,
  service_date date not null,
  token_number integer not null check (token_number > 0),
  display_token text not null,
  patient_label text not null default 'Patient',
  patient_phone_hash text,
  status text not null default 'waiting' check (status in ('waiting','called','in_consultation','completed','skipped','absent','cancelled')),
  booking_source text not null default 'walk_in' check (booking_source in ('walk_in','online','staff')),
  idempotency_key text,
  tracking_secret_hash text unique,
  tracking_expires_at timestamptz,
  tracking_revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  called_at timestamptz,
  completed_at timestamptz,
  unique (queue_id,service_date,token_number),
  unique (queue_id,idempotency_key)
);
alter table public.queues drop constraint if exists queues_current_token_id_fkey;
alter table public.queues add constraint queues_current_token_id_fkey
  foreign key (current_token_id) references public.queue_tokens(id) on delete set null;
create table if not exists public.queue_events (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid not null references public.clinics(id) on delete cascade,
  queue_id uuid not null references public.queues(id) on delete cascade,
  token_id uuid references public.queue_tokens(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  previous_status text,
  new_status text,
  reason text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (clinic_id,idempotency_key)
);
create table if not exists public.clinic_settings (
  clinic_id uuid primary key references public.clinics(id) on delete cascade,
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references public.clinics(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.notification_preferences (
  id uuid primary key default gen_random_uuid(),
  token_id uuid not null references public.queue_tokens(id) on delete cascade,
  channel text not null check (channel in ('web_push','browser','whatsapp')),
  enabled boolean not null default false,
  endpoint_hash text,
  preferences jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (token_id,channel,endpoint_hash)
);
create table if not exists public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  token_id uuid references public.queue_tokens(id) on delete set null,
  channel text not null,
  event_key text not null,
  status text not null default 'queued' check (status in ('queued','sent','failed','expired')),
  attempts integer not null default 0,
  last_error_code text,
  scheduled_at timestamptz not null default now(),
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  unique (token_id,channel,event_key)
);

create index if not exists clinic_memberships_user_idx on public.clinic_memberships(user_id,is_active);
create index if not exists doctors_clinic_active_idx on public.doctors(clinic_id,is_active,is_public);
create index if not exists queues_clinic_date_idx on public.queues(clinic_id,service_date,status);
create index if not exists queue_tokens_queue_status_idx on public.queue_tokens(queue_id,service_date,status,token_number);
create index if not exists queue_events_queue_created_idx on public.queue_events(queue_id,created_at desc);
create index if not exists audit_logs_clinic_created_idx on public.audit_logs(clinic_id,created_at desc);

create or replace function public.has_clinic_role(target_clinic uuid, allowed_roles text[] default null)
returns boolean language sql stable security definer set search_path=public
as $$
  select exists (
    select 1 from public.clinic_memberships m
    where m.clinic_id=target_clinic and m.user_id=auth.uid() and m.is_active
      and (allowed_roles is null or m.role=any(allowed_roles))
  );
$$;
create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path=public
as $$
  select exists (select 1 from public.platform_roles r where r.user_id=auth.uid() and r.role='super_admin');
$$;

alter table public.profiles enable row level security;
alter table public.platform_roles enable row level security;
alter table public.clinics enable row level security;
alter table public.clinic_memberships enable row level security;
alter table public.doctors enable row level security;
alter table public.clinic_hours enable row level security;
alter table public.queues enable row level security;
alter table public.queue_tokens enable row level security;
alter table public.queue_events enable row level security;
alter table public.clinic_settings enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notification_deliveries enable row level security;

drop policy if exists profiles_read_self on public.profiles;
create policy profiles_read_self on public.profiles for select to authenticated using (id=auth.uid() or public.is_platform_admin());
drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated using (id=auth.uid()) with check (id=auth.uid());
drop policy if exists platform_roles_admin_only on public.platform_roles;
create policy platform_roles_admin_only on public.platform_roles for select to authenticated using (public.is_platform_admin() or user_id=auth.uid());
drop policy if exists clinics_admin_manage on public.clinics;
create policy clinics_admin_manage on public.clinics for all to authenticated using (public.is_platform_admin()) with check (public.is_platform_admin());
drop policy if exists clinics_public_read on public.clinics;
create policy clinics_public_read on public.clinics for select to anon,authenticated using (is_active and is_public);
drop policy if exists memberships_member_or_admin_read on public.clinic_memberships;
create policy memberships_member_or_admin_read on public.clinic_memberships for select to authenticated using (user_id=auth.uid() or public.has_clinic_role(clinic_id,array['owner','manager']));
drop policy if exists memberships_owner_manage on public.clinic_memberships;
create policy memberships_owner_manage on public.clinic_memberships for all to authenticated using (public.has_clinic_role(clinic_id,array['owner']) or public.is_platform_admin()) with check (public.has_clinic_role(clinic_id,array['owner']) or public.is_platform_admin());
drop policy if exists doctors_clinic_manage on public.doctors;
create policy doctors_clinic_manage on public.doctors for all to authenticated using (public.has_clinic_role(clinic_id,array['owner','manager','doctor'])) with check (public.has_clinic_role(clinic_id,array['owner','manager','doctor']));
drop policy if exists doctors_public_read on public.doctors;
create policy doctors_public_read on public.doctors for select to anon,authenticated using (is_public and is_active and exists(select 1 from public.clinics c where c.id=clinic_id and c.is_active and c.is_public));
drop policy if exists clinic_hours_manage on public.clinic_hours;
create policy clinic_hours_manage on public.clinic_hours for all to authenticated using (public.has_clinic_role(clinic_id,array['owner','manager','doctor'])) with check (public.has_clinic_role(clinic_id,array['owner','manager','doctor']));
drop policy if exists clinic_hours_public_read on public.clinic_hours;
create policy clinic_hours_public_read on public.clinic_hours for select to anon,authenticated using (exists(select 1 from public.clinics c where c.id=clinic_id and c.is_active and c.is_public));
drop policy if exists queues_staff_manage on public.queues;
create policy queues_staff_manage on public.queues for all to authenticated using (public.has_clinic_role(clinic_id,array['owner','manager','doctor','receptionist','compounder'])) with check (public.has_clinic_role(clinic_id,array['owner','manager','doctor','receptionist','compounder']));
drop policy if exists tokens_staff_only on public.queue_tokens;
create policy tokens_staff_only on public.queue_tokens for all to authenticated using (public.has_clinic_role(clinic_id,array['owner','manager','doctor','receptionist','compounder'])) with check (public.has_clinic_role(clinic_id,array['owner','manager','doctor','receptionist','compounder']));
drop policy if exists events_staff_read on public.queue_events;
create policy events_staff_read on public.queue_events for select to authenticated using (public.has_clinic_role(clinic_id,array['owner','manager','doctor','receptionist','compounder']));
drop policy if exists events_staff_insert on public.queue_events;
create policy events_staff_insert on public.queue_events for insert to authenticated with check (public.has_clinic_role(clinic_id,array['owner','manager','doctor','receptionist','compounder']) and actor_user_id=auth.uid());
drop policy if exists settings_owner_manage on public.clinic_settings;
create policy settings_owner_manage on public.clinic_settings for all to authenticated using (public.has_clinic_role(clinic_id,array['owner','manager'])) with check (public.has_clinic_role(clinic_id,array['owner','manager']));
drop policy if exists settings_staff_read on public.clinic_settings;
create policy settings_staff_read on public.clinic_settings for select to authenticated using (public.has_clinic_role(clinic_id));
drop policy if exists audit_admin_read on public.audit_logs;
create policy audit_admin_read on public.audit_logs for select to authenticated using (public.is_platform_admin() or (clinic_id is not null and public.has_clinic_role(clinic_id,array['owner','manager'])));
drop policy if exists audit_staff_insert on public.audit_logs;
create policy audit_staff_insert on public.audit_logs for insert to authenticated with check (actor_user_id=auth.uid() and (clinic_id is null or public.has_clinic_role(clinic_id)));
drop policy if exists notification_prefs_staff_read on public.notification_preferences;
create policy notification_prefs_staff_read on public.notification_preferences for select to authenticated using (exists(select 1 from public.queue_tokens t where t.id=token_id and public.has_clinic_role(t.clinic_id)));
drop policy if exists notification_deliveries_staff_read on public.notification_deliveries;
create policy notification_deliveries_staff_read on public.notification_deliveries for select to authenticated using (exists(select 1 from public.queue_tokens t where t.id=token_id and public.has_clinic_role(t.clinic_id)));

grant usage on schema public to anon,authenticated;
grant select,insert,update,delete on all tables in schema public to authenticated;
grant select on public.clinics,public.doctors,public.clinic_hours to anon;
grant execute on function public.has_clinic_role(uuid,text[]) to authenticated;
grant execute on function public.is_platform_admin() to authenticated;

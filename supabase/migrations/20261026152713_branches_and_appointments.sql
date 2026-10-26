create table if not exists public.clinic_branches (
  id uuid primary key default gen_random_uuid(), clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_code text not null, name text not null, address text, city text, state text, postal_code text, phone text,
  is_active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique (clinic_id,branch_code), unique (clinic_id,id)
);
create index if not exists clinic_branches_clinic_active_idx on public.clinic_branches(clinic_id,is_active);
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(), clinic_id uuid not null references public.clinics(id) on delete cascade,
  branch_id uuid, doctor_id uuid not null, patient_user_id uuid references auth.users(id) on delete set null,
  patient_name text not null, patient_phone_hash text, appointment_date date not null, appointment_time time not null,
  status text not null default 'booked' check (status in ('booked','confirmed','checked_in','completed','cancelled','no_show')),
  booking_source text not null default 'staff' check (booking_source in ('staff','online')),
  created_by uuid references auth.users(id) on delete set null, idempotency_key text,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (clinic_id,doctor_id) references public.doctors(clinic_id,id) on delete cascade,
  foreign key (clinic_id,branch_id) references public.clinic_branches(clinic_id,id) on delete cascade,
  unique (clinic_id,doctor_id,appointment_date,appointment_time), unique (clinic_id,idempotency_key)
);
create index if not exists appointments_clinic_date_status_idx on public.appointments(clinic_id,appointment_date,status);
create index if not exists appointments_doctor_date_idx on public.appointments(doctor_id,appointment_date,appointment_time);
create index if not exists appointments_patient_idx on public.appointments(patient_user_id,appointment_date desc);
alter table public.clinic_branches enable row level security;
alter table public.appointments enable row level security;
grant select,insert,update,delete on public.clinic_branches,public.appointments to authenticated;
drop policy if exists clinic_branches_member_read on public.clinic_branches;
create policy clinic_branches_member_read on public.clinic_branches for select to authenticated using (public.is_platform_admin() or public.has_clinic_role(clinic_id));
drop policy if exists clinic_branches_owner_manage on public.clinic_branches;
create policy clinic_branches_owner_manage on public.clinic_branches for all to authenticated using (public.is_platform_admin() or public.has_clinic_role(clinic_id,array['owner','manager'])) with check (public.is_platform_admin() or public.has_clinic_role(clinic_id,array['owner','manager']));
drop policy if exists appointments_patient_or_staff_read on public.appointments;
create policy appointments_patient_or_staff_read on public.appointments for select to authenticated using (patient_user_id=auth.uid() or public.is_platform_admin() or public.has_clinic_role(clinic_id,array['owner','manager','doctor','receptionist','compounder']));
drop policy if exists appointments_staff_create on public.appointments;
create policy appointments_staff_create on public.appointments for insert to authenticated with check (created_by=auth.uid() and public.has_clinic_role(clinic_id,array['owner','manager','doctor','receptionist']));
drop policy if exists appointments_staff_update on public.appointments;
create policy appointments_staff_update on public.appointments for update to authenticated using (public.has_clinic_role(clinic_id,array['owner','manager','doctor','receptionist'])) with check (public.has_clinic_role(clinic_id,array['owner','manager','doctor','receptionist']));
drop policy if exists appointments_owner_delete on public.appointments;
create policy appointments_owner_delete on public.appointments for delete to authenticated using (public.has_clinic_role(clinic_id,array['owner','manager']));

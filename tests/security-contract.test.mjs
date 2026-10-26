import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const file = (path) => readFile(new URL(path, import.meta.url), "utf8");

test("public queue view excludes private patient fields", async () => {
  const sql = await file("../supabase/migrations/20261026144629_public_queue_privacy_view.sql");
  assert.match(sql, /current_display_token/);
  assert.match(sql, /waiting_count/);
  assert.match(sql, /completed_count/);
  for (const privateField of ["patient_label", "patient_phone_hash", "tracking_secret_hash", "medical_details", "appointment_id"]) {
    assert.doesNotMatch(sql, new RegExp("\\b" + privateField + "\\b", "i"));
  }
});

test("queue mutation SQL uses locks, role checks, and idempotency", async () => {
  const sql = await file("../supabase/migrations/20261026144924_atomic_queue_operations.sql");
  assert.match(sql, /for update/i);
  assert.match(sql, /auth\.uid\(\)/i);
  assert.match(sql, /has_clinic_role/i);
  assert.match(sql, /p_idempotency_key/);
  assert.match(sql, /A skip reason is required/);
});

test("queue operations enforce issued-token limits and atomic advancement", async () => {
  const sql = await file("../supabase/migrations/20261026151957_queue_operation_guards.sql");
  assert.match(sql, /advance_queue/);
  assert.match(sql, /for update skip locked/i);
  assert.match(sql, /select count\(\*\)::integer into v_count[\s\S]*where queue_id = v_queue.id and service_date = v_queue.service_date\s*;/i);
  assert.doesNotMatch(sql, /status not in \('cancelled','absent','skipped'\)/i);
});

test("public queue snapshot exposes only safe aggregate fields", async () => {
  const sql = await file("../supabase/migrations/20261026153021_public_queue_snapshot_table.sql");
  assert.match(sql, /create table if not exists public\.public_queue_snapshots/i);
  assert.match(sql, /alter table public\.public_queue_snapshots enable row level security/i);
  assert.match(sql, /create policy public_queue_snapshots_read.*using \(true\)/i);
  assert.match(sql, /create or replace function private\.refresh_public_queue_snapshot/);
  assert.match(sql, /revoke all on function private\.refresh_public_queue_snapshot_trigger\(\) from public,anon,authenticated/i);
  assert.match(sql, /drop function if exists public\.get_public_queue_status\(\)/i);
  for (const field of ["patient_name", "patient_phone_hash", "tracking_secret_hash", "medical_details"]) {
    assert.doesNotMatch(sql, new RegExp("\\b" + field + "\\b", "i"));
  }
});

test("public API grants only the safe queue projection to anonymous users", async () => {
  const sql = await file("../supabase/migrations/20261026153623_least_privilege_table_grants.sql");
  assert.match(sql, /revoke all privileges on all tables in schema public from anon, authenticated/i);
  assert.match(sql, /grant select on public\.public_queue_snapshots to anon/i);
  assert.doesNotMatch(sql, /grant select on public\.(clinics|doctors|queue_tokens|appointments) to anon/i);
  assert.match(sql, /revoke insert, update, delete, truncate, references, trigger on public\.platform_roles from authenticated/i);
});

test("authenticated users cannot directly mutate tenant tables or truncate", async () => {
  const sql = await file("../supabase/migrations/20261026153623_least_privilege_table_grants.sql");
  for (const table of ["platform_roles","clinics","clinic_memberships","doctors","queues","queue_tokens","queue_events","audit_logs"]) {
    assert.match(sql, new RegExp("revoke insert, update, delete, truncate, references, trigger on public\\." + table + " from authenticated", "i"));
  }
});

test("password recovery uses a verified callback and does not accept open redirects", async () => {
  const request = await file("../app/forgot-password/actions.ts");
  const callback = await file("../app/auth/callback/route.ts");
  const reset = await file("../app/reset-password/actions.ts");
  assert.match(request, /resetPasswordForEmail/);
  assert.match(request, /auth\/callback\?next=\/reset-password/);
  assert.match(callback, /exchangeCodeForSession/);
  assert.match(callback, /requestedNext\.startsWith\("\/\/"\)/);
  assert.match(callback, /requestedNext\.includes/);
  assert.match(reset, /updateUser\(\{ password \}\)/);
  assert.match(reset, /password\.length < 12/);
});

test("RLS helpers are private and public wrappers do not elevate privileges", async () => {
  const sql = await file("../supabase/migrations/20261026153551_private_security_helpers.sql");
  assert.match(sql, /create or replace function private\.has_clinic_role/);
  assert.match(sql, /create or replace function private\.is_platform_admin/);
  assert.match(sql, /drop function public\.has_clinic_role/);
  assert.match(sql, /security invoker set search_path=pg_catalog,public,private/);
  assert.match(sql, /private\.has_clinic_role/);
});

test("branch and appointment data use clinic-scoped RLS", async () => {
  const sql = await file("../supabase/migrations/20261026152713_branches_and_appointments.sql");
  assert.match(sql, /alter table public\.clinic_branches enable row level security/i);
  assert.match(sql, /alter table public\.appointments enable row level security/i);
  assert.match(sql, /foreign key \(clinic_id,doctor_id\) references public\.doctors\(clinic_id,id\)/i);
  assert.match(sql, /patient_user_id=auth\.uid\(\)/i);
});

test("ordinary users cannot write audit history", async () => {
  const sql = await file("../supabase/migrations/20261026152528_audit_log_write_lockdown.sql");
  assert.match(sql, /drop policy if exists audit_staff_insert/i);
  assert.match(sql, /revoke insert, update, delete, truncate on public\.audit_logs from authenticated/i);
});

test("clinic provisioning requires authenticated Super Admin and verified owner email", async () => {
  const source = await file("../app/api/admin/clinics/route.ts");
  assert.match(source, /session\.auth\.getUser\(\)/);
  assert.match(source, /rpc\("is_platform_admin"\)/);
  assert.match(source, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source, /ownerEmailVerified: z\.literal\(true\)/);
  assert.match(source, /Cache-Control.*no-store/);
});

test("queue and appointment RPC entry points are invoker wrappers", async () => {
  const sql = await file("../supabase/migrations/20261026155318_private_queue_rpc_implementations.sql");
  assert.match(sql, /create or replace function private\.transition_queue_token_impl/);
  assert.match(sql, /create or replace function public\.transition_queue_token[\s\S]*?security invoker/);
  assert.match(sql, /create or replace function public\.issue_staff_token[\s\S]*?security invoker/);
  assert.match(sql, /grant execute on function private\.issue_staff_token_impl\(uuid,text,text\) to authenticated/);
  assert.match(sql, /revoke all on function public\.issue_staff_token\(uuid,text,text\) from public,anon/);
});

test("staff appointment workflow checks clinic role and configured hours", async () => {
  const sql = await file("../supabase/migrations/20261026154936_staff_appointment_workflow.sql");
  assert.match(sql, /private\.has_clinic_role\(p_clinic_id,array\['owner','manager','doctor','receptionist'\]\)/);
  assert.match(sql, /Appointment time is outside configured opening hours/);
  assert.match(sql, /insert into public\.appointments/);
  assert.match(sql, /insert into public\.audit_logs/);
});

test("appointment audit records preserve the previous status", async () => {
  const sql = await file("../supabase/migrations/20261026155005_appointment_audit_previous_status_fix.sql");
  assert.match(sql, /v_previous:=v_appointment\.status/);
  assert.match(sql, /'previous_status',v_previous/);
});

test("arrival state, queue lock ordering, and public waiting counts stay consistent", async () => {
  const sql = await file("../supabase/migrations/20261026154932_arrived_token_status_and_lock_order.sql");
  assert.match(sql, /'waiting','arrived','called','in_consultation'/);
  assert.match(sql, /when 'arrive' then/i);
  assert.match(sql, /status in \('waiting','arrived'\)/i);
  assert.match(sql, /status in \('waiting','arrived'\);/i);
  assert.ok(sql.indexOf("from public.queues where id=v_queue_id for update") < sql.indexOf("from public.queue_tokens where id=p_token_id and queue_id=v_queue.id for update"));
  assert.match(sql, /private\.refresh_public_queue_snapshot/);
});

test("clinic plan limits are checked by server-side queue and branch operations", async () => {
  const sql = await file("../supabase/migrations/20261026154447_enforce_clinic_plan_limits.sql");
  assert.match(sql, /private\.enforce_clinic_usage_limit/);
  assert.match(sql, /'doctors'/);
  assert.match(sql, /'branches'/);
  assert.match(sql, /'dailyTokens'/);
  assert.match(sql, /Queue daily token limit reached|Daily token limit reached/);
});

test("staff invitations use an atomic role-checked membership operation", async () => {
  const sql = await file("../supabase/migrations/20261026155112_atomic_staff_invitation_membership_fix.sql");
  assert.match(sql, /select \* into v_clinic from public\.clinics where id=p_clinic_id and is_active for update/i);
  assert.match(sql, /v_actor_role='manager' and p_role='manager'/);
  assert.match(sql, /private\.enforce_clinic_usage_limit\(p_clinic_id,'staff',v_count\)/);
  assert.match(sql, /clinic\.staff_invited/);
  const route = await file("../app/api/clinic/staff/route.ts");
  assert.match(route, /auth\.admin\.inviteUserByEmail/);
  assert.match(route, /rpc\("attach_invited_staff"/);
  assert.match(route, /process\.env\.SUPABASE_SERVICE_ROLE_KEY/);
});

test("temporary-password flag clears only after an actual password hash change", async () => {
  const sql = await file("../supabase/migrations/20261026153807_password_change_flag_auth_trigger.sql");
  assert.match(sql, /new\.encrypted_password is distinct from old\.encrypted_password/i);
  assert.match(sql, /after update of encrypted_password on auth\.users/i);
  assert.match(sql, /must_change_password=true/i);
  assert.match(sql, /revoke all on function private\.clear_password_change_flag_on_auth_password_change\(\) from public,anon,authenticated/i);
  assert.match(sql, /drop function if exists public\.clear_password_change_flag\(\)/i);
});

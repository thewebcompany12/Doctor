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

test("anonymous database access is limited to curated queue view", async () => {
  const sql = await file("../supabase/migrations/20261026151259_public_api_privilege_hardening.sql");
  assert.match(sql, /revoke all privileges on all tables in schema public from anon/i);
  assert.match(sql, /grant select on public\.public_queue_status to anon/i);
  assert.match(sql, /revoke all on function public\.issue_staff_token/i);
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

test("first-login password flag can only be cleared by authenticated self-service RPC", async () => {
  const sql = await file("../supabase/migrations/20261026151630_first_login_password_change.sql");
  assert.match(sql, /auth\.uid\(\) is null/i);
  assert.match(sql, /where id\s*=\s*auth\.uid\(\)/i);
  assert.match(sql, /revoke all on function public\.clear_password_change_flag\(\) from public, anon/i);
});

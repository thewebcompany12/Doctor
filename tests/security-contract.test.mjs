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
  assert.match(sql, /select count\\(\\*\\)::integer into v_count[\\s\\S]*where queue_id = v_queue.id and service_date = v_queue.service_date\\s*;/i);
  assert.doesNotMatch(sql, /status not in \\('cancelled','absent','skipped'\\)/i);
});

test("anonymous database access is limited to curated queue view", async () => {
  const sql = await file("../supabase/migrations/20261026151259_public_api_privilege_hardening.sql");
  assert.match(sql, /revoke all privileges on all tables in schema public from anon/i);
  assert.match(sql, /grant select on public\.public_queue_status to anon/i);
  assert.match(sql, /revoke all on function public\.issue_staff_token/i);
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
  assert.match(sql, /where id = auth\.uid\(\)/i);
  assert.match(sql, /revoke all on function public\.clear_password_change_flag\(\) from public, anon/i);
});

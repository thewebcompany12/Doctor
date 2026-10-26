# Database migration and security notes

## Applied production history (verified 2026-10-26)

The connected Supabase project reports these applied migration versions:

1. `20261026144621 doctor_queue_foundation`
2. `20261026144629 public_queue_privacy_view`
3. `20261026144755 public_queue_status_view_access`
4. `20261026144924 atomic_queue_operations`
5. `20261026145147 queue_mutation_security_hardening`
6. `20261026151259 public_api_privilege_hardening`
7. `20261026151630 first_login_password_change`
8. `20261026151957 queue_operation_guards`
9. `20261026152016 queue_advance_current_token_guard`
10. `20261026152153 clinic_queue_setup_and_controls`
11. `20261026152314 queue_status_audit_fix`
12. `20261026152346 queue_transition_call_guard`
13. `20261026152528 audit_log_write_lockdown`
14. `20261026152608 audit_log_privilege_cleanup`
15. `20261026152713 branches_and_appointments`
16. `20261026152852 public_queue_rpc_privacy_hardening`
17. `20261026153021 public_queue_snapshot_table`
18. `20261026153114 public_queue_snapshot_backfill`
19. `20261026153309 tenant_consistency_constraints`
20. `20261026153551 private_security_helpers`
21. `20261026153623 least_privilege_table_grants`
22. `20261026153807 password_change_flag_auth_trigger`
23. `20261026154041 secure_rpc_search_paths`
24. `20261026154143 admin_clinic_settings_read`
25. `20261026154307 owner_profile_branch_schedule_rpcs`
26. `20261026154447 enforce_clinic_plan_limits`
27. `20261026154501 clinic_daily_token_limit_fix`
28. `20261026154516 clinic_daily_token_limit_concurrency`
29. `20261026154728 default_online_booking_off`
30. `20261026154932 arrived_token_status_and_lock_order`
31. `20261026154936 staff_appointment_workflow`
32. `20261026155005 appointment_audit_previous_status_fix`
33. `20261026155101 atomic_staff_invitation_membership`
34. `20261026155112 atomic_staff_invitation_membership_fix`
35. `20261026155318 private_queue_rpc_implementations`
36. `20261026155607 enforce_walkin_plan_at_issue`

The repository contains version-matched SQL files for all 36 applied migrations. The foundation migration was reconstructed from live catalog metadata (columns, constraints, indexes, RLS policies and helper functions) because the original applied source was absent from GitHub. GitHub Actions successfully applied the full migration chain to a clean PostgreSQL 16 database with a minimal Supabase auth/role shim, then passed schema/RLS/grant assertions and synthetic two-clinic authorization checks. This validates migration order and SQL behavior in the CI harness; it is not a substitute for a full Supabase-managed local stack test.

## Safe workflow

- Back up the database before schema changes.
- Never reset or truncate the production project to test migrations.
- Apply versioned migrations to a disposable Supabase branch or local Supabase/Postgres environment first.
- Compare the resulting schema, functions, policies, indexes and grants against production before applying any reconciliation.
- Keep migration filenames aligned with the versions recorded in `supabase_migrations.schema_migrations`.
- If production was changed outside versioned migrations, add a forward-only reconciliation migration; do not rewrite historical production state.
- Queue allocation must go through `issue_staff_token`; transitions must go through `transition_queue_token`; next-patient selection uses `advance_queue`. These functions check clinic membership, lock rows and accept idempotency keys. Daily token limits count all issued tokens, including skipped/absent/cancelled tokens. A parallel-load concurrency stress test remains outstanding; queue and clinic rows are locked in a consistent order, and idempotency and status guards are covered by migration contracts and the queue RPC implementation.

## Anonymous API surface

The intended public surface is only `public.public_queue_snapshots`, a read-only projection table containing clinic/doctor display fields and aggregate queue counts. A private-schema trigger function maintains it as queue, token, clinic or doctor records change. The projection excludes patient names, phone hashes, tracking secrets and appointment details. Anonymous base-table privileges remain revoked; `anon` can only SELECT the projection. Authenticated table grants were reset to read-only, with profile preference updates limited to safe columns. Queue state changes must use authorization-checked RPCs, eliminating direct client mutation and `TRUNCATE` grants. The former definer view and public SECURITY DEFINER RPC were dropped. Exposed queue RPCs pin `search_path` to `pg_catalog, public, private` and enforce authenticated clinic-role checks.

## Known scope gaps

Branch and appointment tables now exist with tenant-scoped RLS policies, composite clinic foreign keys, and private patient fields. Queue-token and queue-event records also have composite clinic/queue foreign keys to reject cross-tenant references. Staff appointment booking and lifecycle transitions are implemented in the workspace; patient-facing online booking remains unimplemented. The Super Admin clinic directory now supports search, create/onboard, edit, activate, suspend and archive controls. Temporary-password onboarding is enforced through a first-login password-change page. The workspace now includes owner/manager queue setup and staff queue operations (issue walk-in token, call next, pause/resume/close, start/complete, skip with reason, absent and cancel). Online booking is only a stored setting; public online token issuance is not implemented. The workspace now includes clinic profile editing, branch creation, opening-hours configuration, and a staff-invitation form. Staff invitation/deactivation still depends on the server-side service-role credential and requires live verification. Plan/usage controls are available in Super Admin; enforcement covers doctors, branches, staff memberships, queue-level daily token limits, and clinic-wide daily token limits. Online booking is disabled by default and can be enabled by plan, but public online token issuance remains unimplemented. Password recovery UI is implemented, but the production callback URL still must be allow-listed in Supabase Auth. RLS policies have been inspected, and direct anonymous table access plus authenticated audit-log writes have been restricted. A synthetic transaction verified that anonymous access sees only the aggregate snapshot and not patient labels/phone hashes; the transaction was rolled back. CI tests with synthetic accounts in two clinics verified membership/token/appointment isolation, rejected cross-clinic token issuance, and confirmed that the anonymous role sees only the aggregate queue snapshot without patient fields; the entire test transaction is rolled back. Supabase's security advisor currently returns no lints. Queue and appointment mutation implementations are stored in the non-exposed `private` schema with fixed search paths and in-function `auth.uid()`/clinic-role checks; public RPC entry points are invoker wrappers. RLS helper functions are also private, and a private `auth.users` trigger clears the temporary-password flag only when the password hash actually changes. No production data was reset or deleted.

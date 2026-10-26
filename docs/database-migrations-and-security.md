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
37. `20261026155849 doctor_and_branch_management`
38. `20261026160023 enforce_limits_on_reactivation`
39. `20261026160701 foreign_key_performance_indexes`
40. `20261026160729 optimize_auth_rls_initplans`
41. `20261026160926 staff_membership_rpc_service_role_only`
42. `20261026160937 consolidate_select_policies`
43. `20261026161405 revoke_legacy_staff_rpc`
44. `20261026161535 public_online_token_booking`
45. `20261026161651 public_online_token_booking`
46. `20261026162152 online_token_secret_function_resolution`
47. `20261026162244 move_pgcrypto_extension_to_extensions_schema`
48. `20261026165540 patient_experience_foundation`
49. `20261026165621 public_clinic_directory`
50. `20261026170808 online_booking_hours_idempotency`
51. `20261026171015 public_clinic_directory_delete_fix`

The repository contains version-matched SQL files for all 51 applied migrations. The online-token migration was accidentally applied twice through the connected migration tool; it is idempotent (`IF NOT EXISTS`/`CREATE OR REPLACE`) and both recorded versions are retained and represented by matching files so clean-install migration order remains reproducible. The foundation migration was reconstructed from live catalog metadata (columns, constraints, indexes, RLS policies and helper functions) because the original applied source was absent from GitHub. GitHub Actions successfully applied the full migration chain to a clean PostgreSQL 16 database with a minimal Supabase auth/role shim, then passed schema/RLS/grant assertions and synthetic two-clinic authorization checks. This validates migration order and SQL behavior in the CI harness; it is not a substitute for a full Supabase-managed local stack test.

## Safe workflow

- Back up the database before schema changes.
- Never reset or truncate the production project to test migrations.
- Apply versioned migrations to a disposable Supabase branch or local Supabase/Postgres environment first.
- Compare the resulting schema, functions, policies, indexes and grants against production before applying any reconciliation.
- Keep migration filenames aligned with the versions recorded in `supabase_migrations.schema_migrations`.
- If production was changed outside versioned migrations, add a forward-only reconciliation migration; do not rewrite historical production state.
- Queue allocation must go through `issue_staff_token`; transitions must go through `transition_queue_token`; next-patient selection uses `advance_queue`. These functions check clinic membership, lock rows and accept idempotency keys. Daily token limits count all issued tokens, including skipped/absent/cancelled tokens. GitHub Actions now stress-tests 20 concurrent token issuances and verifies distinct sequential numbers plus idempotent retry behavior.

## Anonymous API surface

The anonymous public surface consists of two read-only projections: `public.public_queue_snapshots` (clinic/doctor display fields, current queue status and aggregate counts) and `public.public_clinic_directory` (explicitly public clinic contact/location fields and public doctor names/specialties). A private-schema trigger function maintains it as queue, token, clinic or doctor records change. The projection excludes patient names, phone hashes, tracking secrets and appointment details. Anonymous base-table privileges remain revoked; `anon` can only SELECT these two projections. Authenticated table grants were reset to read-only, with profile preference updates limited to safe columns. Queue state changes must use authorization-checked RPCs, eliminating direct client mutation and `TRUNCATE` grants. The former definer view and public SECURITY DEFINER RPC were dropped. Exposed queue RPCs pin `search_path` to `pg_catalog, public, private` and enforce authenticated clinic-role checks.

## Known scope gaps

Branch and appointment tables now exist with tenant-scoped RLS policies, composite clinic foreign keys, and private patient fields. Queue-token and queue-event records also have composite clinic/queue foreign keys to reject cross-tenant references. Staff appointment booking and lifecycle transitions are implemented in the workspace. The patient directory, clinic details, live public queue page, online booking UI, private tracking lookup, idempotent online token allocation, clinic-hours validation, cancellation and rate limiting are implemented. Actual booking and private tracking return a safe configuration error until `SUPABASE_SERVICE_ROLE_KEY` is configured in Vercel; production end-to-end verification remains outstanding. The Super Admin clinic directory now supports search, create/onboard, edit, activate, suspend and archive controls. Temporary-password onboarding is enforced through a first-login password-change page. The workspace now includes owner/manager queue setup and staff queue operations (issue walk-in token, call next, pause/resume/close, start/complete, skip with reason, absent and cancel). Online booking is plan-gated, checks local clinic opening hours, reuses a request idempotency key and remains disabled by default. The public online token issuance RPC is service-role-only. The workspace now includes clinic profile editing, doctor editing, branch creation/activation, opening-hours configuration, and a staff-invitation form. Staff invitation/deactivation still depends on the server-side service-role credential and requires live verification. The legacy four-argument staff membership definer has had execute revoked from all API roles; only the explicit-actor service-role RPC remains callable. Plan/usage controls are available in Super Admin; enforcement covers doctors, branches, staff memberships, queue-level daily token limits, and clinic-wide daily token limits, including when doctors or branches are reactivated. Online booking is disabled by default and can be enabled by plan; walk-in token issuance is gated by both queue settings and the clinic plan. Public online token issuance is implemented in the API and database, but cannot execute in production until `SUPABASE_SERVICE_ROLE_KEY` is configured on Vercel. Password recovery UI is implemented, but the production callback URL still must be allow-listed in Supabase Auth. RLS policies have been inspected, and direct anonymous table access plus authenticated audit-log writes have been restricted. A synthetic transaction verified that anonymous access sees only the aggregate snapshot and not patient labels/phone hashes; the transaction was rolled back. CI tests with synthetic accounts in two clinics verified membership/token/appointment isolation, rejected cross-clinic token issuance, and confirmed that the anonymous role sees only the aggregate queue snapshot without patient fields; the entire test transaction is rolled back. Supabase's security advisor currently returns no lints. Queue and appointment mutation implementations are stored in the non-exposed `private` schema with fixed search paths and in-function `auth.uid()`/clinic-role checks; public RPC entry points are invoker wrappers. RLS helper functions are also private, and a private `auth.users` trigger clears the temporary-password flag only when the password hash actually changes. The 12 foreign-key indexes flagged by the Supabase performance advisor have now been added with an additive migration; after replacing direct `auth.uid()` calls with scalar subqueries in seven RLS policies, the latest performance advisor no longer reports RLS init-plan warnings. Informational unused-index findings remain; indexes are retained because the production database has not yet accumulated representative workload, and dropping them prematurely could degrade foreign-key or tenant-scoped queries. No production data was reset or deleted.


## Patient app, PWA and reminders

- `/clinics` reads the safe public clinic directory and queue snapshots from Supabase. It supports search by clinic name, doctor, specialty and city, filters, online-booking visibility, and English/Hindi labels.
- `/clinics/[clinic]` displays the public clinic profile, location/directions, public contact number, published doctor queues/hours, QR code and sharing actions. `/queue/[queueId]` uses Supabase Realtime when available and polls every 15 seconds as a fallback; it shows last-check time, offline/reconnect state and stale snapshot warnings.
- Online booking uses the authoritative database RPC, clinic plan and opening-hours checks, queue locks, a request idempotency key, and a 64-character random bearer secret stored only as a SHA-256 hash. A repeated idempotency key reuses the token and rotates the bearer secret so a lost response does not allocate another token. Private tracking responses include only the token owner's position and permitted aggregate queue details; cancellation is allowed only while the token is waiting.
- The service worker caches only the generic offline page and public icon. It never caches API responses, private token status or clinic/queue HTML. Offline actions are not reported as confirmed.
- Push subscription storage is service-role-only and stores browser endpoints/keys in a private RLS-protected table. `/api/cron/push-reminders` requires `Authorization: Bearer $CRON_SECRET`, VAPID configuration and a real scheduler. The current project does not have VAPID values or a configured scheduler, so background push delivery is not operational. Foreground browser alerts require explicit permission and work only while the tracking page is open.

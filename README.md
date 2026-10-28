# Doctor Queue

India-first clinic queue management SaaS with public clinic discovery, live queue status, secure personal token tracking, and staff dashboards.

## Stack

- Next.js App Router, TypeScript, Tailwind CSS
- Supabase Auth, PostgreSQL, RLS, Realtime and server-side RPCs
- Vercel hosting and scheduled functions
- Default clinic timezone: `Asia/Kolkata`

## Local setup

1. Use Node.js 20.9 or newer.
2. Copy `.env.example` to `.env.local`.
3. Configure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Set `SUPABASE_SERVICE_ROLE_KEY` only in a trusted server environment. Never prefix it with `NEXT_PUBLIC_`, include it in browser code, or commit it.
5. Install with `npm install`; run `npm run dev`.
6. Before release, run `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build`.

## Patient experience

- `/`: Doctor Queue landing page.
- `/clinics`: public clinic/doctor search, specialty and city filters, online-booking availability, English/Hindi interface.
- `/clinics/[clinic]`: public clinic details, hours/address, directions, share link and QR code.
- `/queue/[queueId]`: safe public queue status with Supabase Realtime and polling fallback.
- `/token-status`: private token status, approximate position/wait, cancellation while waiting, and opt-in reminder settings.
- `/manifest.webmanifest`, `/sw.js`: installable PWA shell and safe offline fallback.

Public directory and queue pages use read-only projection tables. Public responses must not contain patient names, phone numbers, diagnoses, tracking secrets or private appointments. Private tracking secrets are returned only at booking time, stored as hashes in the database, placed in URL fragments (not sent in HTTP requests as URL paths/query parameters), and expire.

## Online booking and notifications

Online booking is disabled by default and depends on the service-role-only `issue_public_queue_token` RPC. It validates public clinic/doctor status, local service date and opening hours, plan/queue limits, request idempotency and rate limits. Do not grant this RPC to anonymous/authenticated database roles as a workaround for missing server credentials.

Configure the following server-side environment variables to enable booking/tracking and push delivery:

- `SUPABASE_SERVICE_ROLE_KEY` — required for the trusted token API and push worker.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` — Web Push credentials; only the public key may be exposed to the browser.
- `CRON_SECRET` — protects `/api/cron/push-reminders`.
- `NEXT_PUBLIC_APP_URL` — canonical HTTPS origin for production links.

The Vercel cron is scheduled once daily at 09:00 UTC to remain compatible with the Hobby plan. That cadence is not suitable for turn-approaching alerts; use a plan that supports more frequent Vercel Cron jobs or an authorized external scheduler before describing background reminders as timely. Browser notifications work only while the tracking page is open. Push permission alone is not proof of delivery.

## Database and security

- Versioned SQL migrations live in `supabase/migrations/`; the connected project migration history should be reconciled with these files before applying changes.
- Queue allocation and state transitions are transactional, lock-protected and idempotent.
- Tenant data uses RLS, clinic-scoped constraints and least-privilege grants. Public queue/discovery access is limited to safe projection data.
- Tracking, booking and push APIs use no-store responses, input validation and server-side checks. Rate limiting trusts the platform-provided `x-real-ip` header and does not use caller-controlled `x-forwarded-for` as a fallback.
- The first Super Admin must be provisioned by an authorized operator after verifying the person's identity. Do not grant privileged roles through public signup or client-editable profile fields.

## Verification and operational limits

GitHub Actions runs lint, TypeScript checks, automated security-contract tests, a production build, clean PostgreSQL migration replay, RLS/grant assertions, synthetic two-clinic isolation tests, concurrent token allocation/idempotency stress tests, and public booking privacy/rate-limit checks.

Before real patient traffic, the project owner must confirm the production service-role secret is set, provision a verified Super Admin and clinic, configure the Supabase Auth redirect allow-list, verify booking and push credentials in production, and run browser end-to-end acceptance tests with authorized synthetic accounts. No real clinic or patient rows should be fabricated to make the public directory look populated.

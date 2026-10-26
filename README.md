# Doctor Queue

India-first clinic token and live queue management SaaS. This repository is being established in phases; the current baseline includes the Next.js application shell and initial Supabase schema.

## Stack

- Next.js App Router + TypeScript
- Tailwind CSS v4
- Supabase Auth, PostgreSQL, RLS and Realtime
- Vercel hosting
- Asia/Kolkata as the default clinic timezone

## Local setup

1. Install Node.js 20.9+.
2. Copy `.env.example` to `.env.local`.
3. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` using the Supabase project settings. Never place a service-role key in browser code.
4. Install dependencies with `npm install`.
5. Start the app with `npm run dev`.
6. Run `npm run typecheck`, `npm run lint`, and `npm run build` before release.

## Database

The connected Supabase project has the initial `doctor_queue_foundation` migration and a privacy-oriented `public_queue_privacy_view` migration. Public clients should query `public_queue_status` for queue summaries, not raw patient token rows. Review policies before enabling real patient traffic.

## Security and release notes

- The first Super Admin must be provisioned through a trusted server-side administrative process after verifying the operator's identity. Do not grant this role through a public signup form or client-editable profile.
- A Clinic ID is an identifier, not a password or authentication factor.
- Public token tracking must use random, revocable bearer secrets; never expose patient phone numbers or sequential database IDs in tracking URLs.
- Queue allocation and state transitions must be implemented in database transactions/RPCs before live booking is enabled.
- Notification delivery requires configured push credentials and a server-side scheduler/worker; UI permission alone does not provide reliable background alerts.
- Do not use real patient data in tests. Confirm database region and applicable privacy requirements before production use.

## Current scope

The initial landing page is a product shell, not a claim that booking, authentication, live queue, or notification flows are complete. Those workflows must be implemented and tested before production release.

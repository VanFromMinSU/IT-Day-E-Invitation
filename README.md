# IT Day e-Invitation v2 (Cloud Real-Time Backend)

This project now uses a cloud-hosted Supabase backend for persistence and real-time synchronization.
No local Express server is required in production.

## What Changed

- Replaced localhost-only backend calls with Supabase RPC calls from the frontend.
- Replaced SSE streams with Supabase Realtime subscriptions.
- Added Postgres-backed persistence for:
  - Interested/Excited reactions
  - Event registrations
- Added atomic server-side functions to prevent race conditions during concurrent updates.
- Added admin-protected reset operation using authenticated users with an admin role.
- Added admin-protected reset operation for all event registrations (including future events stored in the same registrations table).

## Backend Setup (Supabase)

1. Create a Supabase project.
2. Open SQL Editor and run the migration file:
   - supabase/migrations/20260328_realtime_backend.sql
   - supabase/migrations/20260328_admin_token_reset_support.sql
   - supabase/migrations/20260329_admin_reset_all_registrations.sql
   - supabase/migrations/20260329_registration_owner_cancel_support.sql
3. In Database -> Replication, ensure Realtime is enabled for:
   - public.event_votes
   - public.event_registrations
4. In Project Settings -> API, copy:
   - Project URL
   - anon public key
5. Update frontend config in:
   - assets/js/config.js

Example:

window.APP_CONFIG = {
  supabaseUrl: "https://YOUR_PROJECT_REF.supabase.co",
  supabaseAnonKey: "YOUR_SUPABASE_ANON_KEY",
   apiBaseUrl: "", // Optional, for custom backend host (for example: http://localhost:3000)
};

## Admin Security (Reset Counts + Registrations)

The reset action uses proper authentication and is restricted to users with:

- app_metadata.role = "admin"

Setup steps:

1. Create an admin user in Supabase Auth.
2. Set app metadata for that user to include role=admin.
3. Open the site with admin mode enabled:
   - ?admin=true
   - or use owner token mode: ?adminToken=ITDAY_OWNER_RESET_2026
4. Click Reset Counts or Reset Registrations and sign in when prompted.

Optional token hash override:

- You can set `responseAdminTokenHash` in `assets/js/config.js` to override the default expected SHA-256 hash for `adminToken`.

Notes:

- Regular users can read and submit reactions/registrations.
- Reset counts requires either an authenticated admin user or a valid owner token.
- Reset registrations requires either an authenticated admin user or a valid owner token.
- Registration cancellation is owner-only and requires the same local owner token used at registration time.
- Token mode can reset counts through Supabase RPC and, when available, the same-origin `/api/reactions/reset` fallback endpoint.
- Token mode can reset registrations through Supabase RPC and, when available, `/api/reset-registrations` fallback endpoint.

## Local Node API (Optional)

If you run `node server.js` for local API fallback, set these environment variables:

- `RESPONSE_ADMIN_TOKEN` or `RESPONSE_ADMIN_TOKEN_HASH`
- `ALLOWED_ORIGINS` as a comma-separated list of allowed frontend origins

Example:

- `ALLOWED_ORIGINS=http://localhost:3000,https://your-site.vercel.app`
- Wildcard prefix is supported using `*` at the end, for example: `https://your-team-*.vercel.app`

The local backend now includes:

- `POST /api/reactions/reset`
- `POST /api/reset-registrations`

Both endpoints require `X-Admin-Token-Hash` with a valid admin token hash.

## Deployment (Always Online)

Deploy as a static site (no Node server process needed), for example:

- Vercel
- Netlify
- GitHub Pages + custom domain

As long as config.js points to Supabase, the app remains online and synchronized in real-time across users.

## Local Preview (Optional)

A local static preview is optional and only for development.
Production usage should rely on cloud hosting and Supabase.

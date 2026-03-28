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

## Backend Setup (Supabase)

1. Create a Supabase project.
2. Open SQL Editor and run the migration file:
   - supabase/migrations/20260328_realtime_backend.sql
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
};

## Admin Security (Reset Counts)

The reset action uses proper authentication and is restricted to users with:

- app_metadata.role = "admin"

Setup steps:

1. Create an admin user in Supabase Auth.
2. Set app metadata for that user to include role=admin.
3. Open the site with admin mode enabled:
   - ?admin=true
   - or use owner token mode: ?adminToken=ITDAY_OWNER_RESET_2026
4. Click Reset Counts and sign in when prompted.

Optional token hash override:

- You can set `responseAdminTokenHash` in `assets/js/config.js` to override the default expected SHA-256 hash for `adminToken`.

Notes:

- Regular users can read and submit reactions/registrations.
- Reset counts requires either an authenticated admin user or a valid owner token.
- Token mode can reset counts through the same-origin `/api/reactions/reset` fallback endpoint when configured.

## Deployment (Always Online)

Deploy as a static site (no Node server process needed), for example:

- Vercel
- Netlify
- GitHub Pages + custom domain

As long as config.js points to Supabase, the app remains online and synchronized in real-time across users.

## Local Preview (Optional)

A local static preview is optional and only for development.
Production usage should rely on cloud hosting and Supabase.

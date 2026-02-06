---
apply: always
---

# AGENTS.md

## Project summary
Service Availability Scheduler is a minimal Node.js + TypeScript app that lets users claim shared services per environment, with email-only login and timed reservations. It serves a small Vue 3 (CDN) frontend that lists services, allows claim/release/extend, and warns users as reservations near expiry.

## What the app does
- Authenticate users by email against the `users` table (no password flow).
- Render a login page at `/login` and the main dashboard at `/`.
- List service/environment combinations with current reservation status.
- Allow users to claim, release, or extend reservations.
- Support team claims (a shared label) that any team member can release.
- Push expiry warnings via Server-Sent Events (SSE) to prompt extension.
- Auto-clean expired reservations every 60 seconds.

## Architecture overview
- Server: Express app in `src/service-availability-scheduler.ts`.
- DB: MariaDB/MySQL via `mysql2` with a pooled connection.
- Config: YAML files in `config/` read at startup.
- Frontend: Vue 3 (CDN) + compiled TypeScript in `public/js`.

## Runtime flow
- Startup loads YAML config and builds a flat service catalog.
- DB pool initializes and runs schema/seed SQL if tables are missing.
- Express controllers register routes for auth, services, and reservations.
- A cleanup timer releases expired reservations every minute.

## API endpoints
- `POST /api/login` -> body `{ email }` (sets session if user exists)
- `POST /api/logout` -> clears session
- `GET /api/me` -> current session user
- `GET /api/services` -> service list + reservation status
- `POST /api/claim` -> body `{ service_key, claimed_by_label?, claimed_by_team? }`
- `POST /api/release` -> body `{ service_key }`
- `POST /api/extend` -> body `{ service_key }`
- `GET /events` -> SSE stream emitting `expiring` events

All `/api/*` and `/events` endpoints require authentication.

## Data model
- `users` table
  - `id`, `email`, `nickname`, `created_at`
  - Users must exist for login to succeed.
- `reservations` table
  - `service_key`, `environment_name`, `service_name`
  - `user_id`, `claimed_by_label`, `claimed_by_team`
  - `claimed_at`, `expires_at`, `released_at`

Schema lives in `config/schema/*.sql`. Optional seed data can be placed in `config/seed/*.sql` and is applied when the corresponding table is created.

## Service catalog
- `config/services.yml` defines services and their environments.
- Each service/environment pair becomes a `service_key` of the form `<environment_id>:<service_id>`.
- Default reservation minutes are defined per service (`default_minutes`).

## App configuration
- `config/app.yml`:
  - `expiry_warning_minutes` (default 5)
  - `auto_refresh_minutes` (default 2)

## Environment variables
- `DATABASE_URL` (required): `mysql://user:password@host:3306/database_name`
- `PORT` (optional, default 3000)
- `SESSION_SECRET` (optional, default `dev-secret-change-me`)

## Frontend behavior
- The dashboard groups services by label and filters by owner/regex.
- Theme (light/dark) is stored in `localStorage` and applied via `data-theme`.
- Expiry warnings come via SSE and prompt the user to extend.
- Auto-refresh polls `/api/services` every `auto_refresh_minutes`.

## Build and run
- `npm install`
- `npm run build` (server: `dist/`, client: `public/js/`)
- `npm start` (serves `http://localhost:3000`)

## Repository layout
- `src/` server (Express, services, repositories)
- `public/` static assets + compiled client JS
- `public/ts/` client TypeScript sources
- `config/` YAML config and SQL schema/seed

## Operational notes
- Reservation expiry checks use UTC (`timezone: 'Z'` in DB config).
- Sessions are cookie-based with a 1-year maxAge.
- Releasing a team claim is allowed by any logged-in user (see backend rules).

## Update log (add here)
- YYYY-MM-DD: <change summary>

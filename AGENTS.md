# AGENTS

## Scope
This repository is a TypeScript/Node.js reservation app for claiming services per environment with email-only login, workspace administration, MySQL-backed service management, and timed reservations.

## Workflow
- Read `~/workspace.md` before implementation work.
- Behavior changes require an approved spec before implementation unless the user explicitly invokes a lower-assurance command such as `$super-agent`.
- Keep behavior deterministic and testable.
- Inspect `git status --short --branch` before edits and preserve unrelated worktree changes.
- Do not commit credentials, `.env` files, local database dumps, generated `public/js` bundles, or `node_modules`.
- Developer agents must run `npm run lint` during implementation validation and fix every lint issue reported by that command before handing work back.
- The main agent must run `npm run format` before committing accepted changes so Prettier normalizes the codebase.

## Project Architecture
- The project uses Domain Driven Design and onion architecture.
- Dependency direction is inward: controllers and infrastructure adapters may depend on service/domain contracts; entities, DTOs, and core services must stay independent of Express, MySQL, browser DOM, and filesystem/runtime details.
- `src/service-availability-scheduler.ts` is the server entrypoint and composition root.
- `src/controllers`: Express controllers and middleware for auth, pages, service availability, reservations, and workspace administration.
- `src/services`: application use cases for config loading, service availability, user login, workspace administration, and reservation lifecycle.
- `src/repositories`: MySQL persistence adapters; `AbstractMysqlRepository` centralizes shared MySQL behavior.
- `src/entities`: domain entities such as users, reservations, workspaces, owners, environments, and service definitions.
- `src/dtos`: application and API data transfer objects.
- `src/helpers`: deterministic date/time helpers and other pure utilities.
- `src/db.ts`: MySQL connection and schema/seed initialization boundary.
- `public/ts`: browser-side TypeScript organized by controllers, services, helpers, DTOs, and entities.
- `config/app.yml`: runtime timing configuration. `auto_refresh_seconds` is expressed in seconds and defaults to 60 seconds when absent.
- `config/schema` and `config/seed`: startup-created schema and optional seed data.
- Workspace owners, environments, and services are runtime data managed through the app and stored in MySQL.

## Configuration
- Required runtime environment: `DATABASE_URL`.
- Optional runtime environment: `SESSION_SECRET`, `PORT`, and `APP_VERSION`.
- Test-only environment: `TEST_DATABASE_URL` and `TEST_DATABASE_ALLOW_TRUNCATE`.
- Runtime timing keys live in `config/app.yml`:
  - `expiry_warning_minutes`
  - `auto_refresh_seconds`
- `config/services.yml` is not a runtime service catalog source; do not reintroduce YAML-backed service definitions.

## Naming Standards
- Interfaces are suffixed with `Interface`.
- Abstract classes are prefixed with `Abstract`.
- Implementations of abstract classes remove the `Abstract` prefix and keep the remaining name.
- Service implementations match interface names without suffix.

## Validation
- Build server and browser TypeScript with `npm run build`.
- Run lint with `npm run lint`; all reported issues must be fixed by the developer agent before completion.
- Run format with `npm run format` before committing accepted changes; the main agent may perform this final formatting pass.
- Run the full automated test suite with `npm test`.
- Run focused TypeScript checks with `npx tsc -p tsconfig.json --noEmit` or `npx tsc -p tsconfig.client.json --noEmit` when faster targeted validation is appropriate.
- Run `git diff --check` before completing edits.
- Start production build with `npm start`.
- Start development server with `npm run dev`; this compiles browser TypeScript first so `/public/js/login.js` and `/public/js/app.js` exist locally.

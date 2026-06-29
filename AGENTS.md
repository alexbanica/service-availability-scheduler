# AGENTS

## Scope
This repository is a TypeScript/Node.js reservation app for claiming services per environment with password-based JWT login, registration and account activation, password reset, workspace administration, MySQL-backed service management, and timed reservations.

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
- `src/services`: application use cases for config loading, service availability, user login, password hashing, CAPTCHA challenges, reset and activation tokens, workspace administration, and reservation lifecycle.
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
- Optional runtime environment: `SESSION_SECRET`, `PORT`, `APP_VERSION`, `JWT_EXPIRES_IN_SECONDS`, and `PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS`.
- Optional migration env: `RUN_MIGRATIONS_ON_STARTUP` defaults to `true` and can disable startup migrations when true/false is provided.
- Test-only environment: `TEST_DATABASE_URL` and `TEST_DATABASE_ALLOW_TRUNCATE`.
- Runtime timing keys live in `config/app.yml`:
  - `expiry_warning_minutes`
  - `auto_refresh_seconds`
  - `jwt_expires_in_seconds`
  - `password_reset_token_expires_in_seconds`
- Migration config key in `config/app.yml`:
  - `run_migrations_on_startup`
- `config/services.yml` is not a runtime service catalog source; do not reintroduce YAML-backed service definitions.

## Database Migrations
- Keep existing base schema bootstrap in `config/schema`.
- Add post-release schema changes as deterministic SQL files under `config/migrations`.
- Use deterministic table-scoped migration file names with stable ordering, e.g. `0001_users-password-hash_users.sql` and `0002_password-reset-tokens-create-table_password_reset_tokens.sql`.
- Keep a tracking table (`schema_migrations`) with migration IDs and applied timestamp.
- Ensure the migration tracking table is created before migration discovery.
- Run bootstrap migrations once at startup when enabled by config.
- Provide an explicit npm migration job (`npm run migrate`) that runs pending migrations using the same tracking table regardless of startup flag.

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

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
- Workspace memberships use workspace-scoped roles: `admin`, `manager`, and `member`. Admins can manage users and resources, managers can manage non-user workspace resources, and members can use service availability/reservation workflows without administration controls.
- Workspace owners/current admins cannot demote their own role or remove their
  own workspace membership; owner self-demotion and self-removal are explicit
  conflict cases, separate from the single-admin invariant.

## Authentication And Account State
- Authentication uses password-based JWT bearer tokens stored by the browser
  through the existing auth token storage helpers.
- Login responses, registration responses, account activation responses,
  `/api/me`, and token renewal must keep user identity fields aligned,
  including activation state.
- Passwords require a minimum of 8 characters. Do not add extra password
  complexity unless an approved spec explicitly requires it.
- Website registration accepts email, nickname, password, password confirmation,
  and a captcha challenge answer. Email is normalized by trimming and
  lowercasing; nickname is trimmed; password confirmation is required and must
  match.
- Captcha challenges are one-time, expiring challenges. Browser flows that edit
  captcha-protected non-answer fields after loading a captcha should clear the
  loaded challenge and require a fresh captcha.
- Registration creates a non-activated user, creates a single active activation
  token, logs the activation URL server-side with a TODO for future email
  delivery, and returns the normal authenticated session payload without
  returning the activation token or URL.
- Activation tokens are stored hashed. Issuing a new activation token for a user
  invalidates prior active activation tokens for that user.
- Activation links use `/activate-account/<token>`. Successful activation marks
  the user activated, consumes the token, grants the existing `platform_admin`
  role, and returns the standard authenticated payload.
- Successful activation stores the returned bearer token in the browser and
  redirects to `/overview` after a 5-second countdown, with a visible manual
  dashboard button.
- Reset and activation links are logged server-side until email delivery exists;
  UI copy must not claim email delivery has happened.

## Authorization
- Non-activated users are authenticated but must not access protected app data
  or mutation endpoints for services, reservations, workspaces, owners,
  environments, invitations, workspace users, or events.
- Non-activated users may use only auth/session endpoints required to stay
  logged in or log out, `/api/me`, activation-token validation/activation,
  `/api/app-info`, static assets, and page routes needed to display the app.
- Browser controls for activation or role restrictions are advisory UX only.
  Server-side authorization remains the source of enforcement and must return
  deterministic `403` responses after authentication succeeds.
- `POST /api/workspaces` remains governed by the platform-wide
  `platform_admin` role and creates the workspace creator as that workspace's
  initial `admin`.
- Workspace role checks are workspace-scoped. A user's role in one workspace
  must not affect roles or permissions in another workspace.
- Resource administration means workspace service, owner, and environment
  administration. It is allowed for workspace `admin` and `manager` roles.
- User administration means inviting users, removing workspace memberships, and
  changing workspace user roles. It is allowed only for workspace `admin`.
- Workspace `member` users can use service availability and reservation flows
  for workspaces where they have membership, but cannot administer users or
  resources.
- `GET /api/workspaces` returns only workspaces where the current user has a
  membership and includes the current user's role for each returned workspace.
- Workspace detail popup routes under `/api/workspaces/:workspaceId/detail/*`
  remain available to workspace members and return `{ items: [...] }` rows.
  Existing consumers may rely on `name`; add identifiers only when a behavior
  change requires them.

## Browser Routes And Frontend Behavior
- The authenticated app shell is a single-page app served by `public/index.html`.
  `/`, `/overview`, `/services`, and `/administration` serve the same shell with
  no-cache headers.
- `/overview` opens the overview view, `/services` opens service availability,
  and `/administration` opens administration. Browser navigation should update
  the path when the top-level view changes.
- Successful login and registration navigate to `/overview`. Account activation
  dashboard navigation also targets `/overview`.
- `/login` serves the unauthenticated login page. `/register` serves the same
  page shell but initializes the registration mode.
- The login page header keeps the theme toggle as its header control. Login
  mode places reset-password and create-account actions below the primary login
  action.
- Non-activated users may navigate the authenticated shell, but the browser must
  avoid protected data fetches, auto-refresh scheduling, event subscription, and
  protected mutations until activation.
- The activation banner belongs in the footer-aware bottom banner stack and must
  remain visible for non-activated authenticated users. Toasts should not
  overlap persistent bottom banners.

## API Contract Documentation
- The repository is both an API project and a frontend app; API contracts are
  first-class deliverables.
- When creating or changing any API endpoint, request or response body, status
  code, authentication or authorization behavior, query/path parameter, SSE
  event, or externally relevant error shape, update `swagger.yml` in the same
  change.
- Keep HTTP request examples under `http/` aligned with implemented APIs.
  Prefer domain-based `.http` files when adding new examples, for example
  account/auth, workspaces, services, reservations, and events, instead of
  continually growing one unrelated catch-all file.
- If a scoped change intentionally leaves `swagger.yml` or `http/*.http`
  untouched, document why the API contract and examples are unaffected in the
  spec, plan, or completion report.

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

## Specs Folder
- `specs/` is not a long-term archive for completed implementation history.
  Keep it focused on active or intentionally retained artifacts.
- Preserve `specs/SPEC-workspace-owner-environment-deletion.md`; it is an
  active proposed spec and must not be removed during cleanup.
- When using `$super-agent`, completed-work spec and plan artifacts may be
  created under `specs/`, but subsequent cleanup may remove older completed
  artifacts once durable guidance has been moved into `AGENTS.md` or the
  relevant documentation.

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

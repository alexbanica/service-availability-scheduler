# Website Registration And Account Activation Implementation Plan

Status: Approved

Approved spec: `specs/SPEC-website-registration-activation.md`

## Target Branch

Use branch `feature/website-registration-activation`.

If implementation starts from a non-`main` branch, stop and ask before creating
the feature branch from the current branch.

## Source Of Truth

Implementation must use only:

- `specs/SPEC-website-registration-activation.md`
- this implementation plan
- `AGENTS.md`
- `/home/alexbanica/workspace.md`
- the files named or directly implied below
- minimal local edit patterns needed to apply the approved plan

Do not perform product, architecture, scope, or planning research during
implementation.

## Architecture And Ownership

- Keep domain/application behavior in services and repositories.
- Keep Express parsing/status mapping in controllers.
- Keep browser behavior in `public/ts` controllers/services/entities.
- Keep schema bootstrap files and post-release migrations deterministic and
  table-scoped.
- Do not reintroduce YAML-backed service catalogs.
- Do not commit generated `public/js` output or `node_modules`.

## Affected Files

Expected production files:

- `config/schema/users.sql`
- `config/schema/account_activation_tokens.sql`
- `config/migrations/0003_users-add-activation-fields_users.sql`
- `config/migrations/0004_account-activation-tokens-create-table_account_activation_tokens.sql`
- `src/db.ts`
- `src/entities/User.ts`
- `src/repositories/UserRepository.ts`
- `src/repositories/UserRoleRepository.ts`
- `src/repositories/AccountActivationTokenRepository.ts`
- `src/services/UserService.ts`
- `src/services/AccountActivationTokenService.ts`
- `src/controllers/AuthMiddleware.ts`
- `src/controllers/AuthController.ts`
- `src/controllers/PageController.ts`
- `src/service-availability-scheduler.ts`
- `public/login.html`
- `public/activate-account.html`
- `public/index.html`
- `public/ts/entities/User.ts`
- `public/ts/controllers/LoginController.ts`
- `public/ts/controllers/AppController.ts`
- `public/ts/services/ApiService.ts`
- `public/ts/services/AuthService.ts`
- `public/ts/services/RegistrationService.ts`
- `public/ts/services/AccountActivationService.ts`
- `public/ts/login.ts`
- `public/ts/activate-account.ts`
- `README.md`

Expected test files:

- `src/tests/unit/auth-controller-password-login.test.ts`
- `src/tests/unit/auth-middleware-controller.test.ts`
- `src/tests/unit/browser-auth-services.test.ts`
- `src/tests/unit/app-controller-renewal-scheduling.test.ts`
- `src/tests/unit/migration-files.test.ts`
- `src/tests/integration/password-reset-db.test.ts`
- add `src/tests/unit/account-activation-token-service.test.ts`
- add or update integration coverage for activation schema in
  `src/tests/integration/password-reset-db.test.ts` or a new focused
  `src/tests/integration/account-activation-db.test.ts`

If implementation discovers a listed file is unnecessary, it may omit it only
when the approved spec behavior remains fully covered by other listed files.

## Test-First Subagent Assignment

Spawn exactly one clean-context test-focused subagent before production
implementation. Use model `gpt-5.3-codex-spark`.

Assignment:

- Read only the approved spec, this plan, `AGENTS.md`,
  `/home/alexbanica/workspace.md`, and the minimal test/helper files needed to
  edit tests named in this plan.
- Add failing deterministic tests for:
  - registration captcha response shape;
  - registration validation failures;
  - successful registration side effects and non-leaky response;
  - login and `/api/me` activation-state response fields;
  - non-activated `403` behavior for protected app endpoints;
  - activation-token service valid/invalid/expired/used/invalidated outcomes;
  - successful activation role grant and activation state update;
  - browser unauthenticated route allowlist for registration/activation;
  - registration and activation browser service payloads;
  - app banner state for non-activated and activated users;
  - schema/migration support for user activation fields and activation tokens.
- Do not implement production behavior.
- Run `npm run lint` after test edits and fix lint issues in changed test files.
- Report test files changed and any blockers.

## Implementation Subagent Assignment

After test-first work completes, spawn no more than one clean-context
implementation subagent for production implementation. Use model
`gpt-5.3-codex-spark`.

Assignment:

- Read only the approved spec, this plan, instructions, failing tests, and
  production files named in this plan.
- Implement the approved behavior without broadening scope.
- Keep activation-token storage separate from password-reset-token storage while
  reusing the same lifecycle pattern.
- Run `npm run lint` and fix every lint issue before handoff.
- Do not commit or push.

## Implementation Steps

1. Branch and state
   - Verify `git status --short --branch`.
   - Create/switch to `feature/website-registration-activation` from `main`
     only when branch state matches the plan.

2. Schema and migration
   - Add `users.activated_at TIMESTAMP NULL`.
   - Ensure base schema treats fresh bootstrap users consistently with the spec.
   - Add `account_activation_tokens` with:
     - `token_id CHAR(36) PRIMARY KEY`
     - `user_id CHAR(36) NOT NULL`
     - `token_hash VARCHAR(255) NOT NULL`
     - `created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP`
     - `expires_at TIMESTAMP NOT NULL`
     - `used TINYINT(1) NOT NULL DEFAULT 0`
     - `used_at TIMESTAMP NULL`
     - `invalidated_at TIMESTAMP NULL`
     - foreign key to `users(user_id)`
     - indexes for `user_id` and `token_hash`
   - Add deterministic migrations:
     - existing users get `activated_at` set to a non-null timestamp;
     - activation-token table is created if missing.
   - Add the new schema table to `src/db.ts` schema ordering after `users` and
     before dependent role/workspace tables.

3. Repository/service layer
   - Extend `User` and `UserWithPasswordHash` to include `activatedAt` or a
     boolean `activated` projection.
   - Add user creation with password hash and activation state in
     `UserRepository`/`UserService`.
   - Add a user activation method that can participate in a transaction.
   - Add `UserRoleRepository` support for idempotently inserting
     `platform_admin`, including a connection-scoped repository method if needed.
   - Add `AccountActivationTokenRepository` following the password reset token
     repository lifecycle pattern.
   - Add `AccountActivationTokenService` following the password reset token
     service pattern:
     - generate opaque token;
     - store SHA-256 hash;
     - invalidate prior active tokens for the user;
     - validate active token by hash, expiry, invalidation, and used state;
     - consume token and invalidate other active tokens for the same user.

4. Auth and activation routes
   - Add unauthenticated `POST /api/register/captcha`.
   - Add unauthenticated `POST /api/register`.
   - Add unauthenticated `POST /api/account-activation/validate`.
   - Add unauthenticated `POST /api/account-activation`.
   - Add page route `GET /activate-account/:token`.
   - Registration must:
     - normalize email;
     - trim nickname;
     - validate password and confirmation;
     - validate captcha;
     - reject duplicates with `409`;
     - create user and activation token in one consistent flow;
     - log `/activate-account/<token>` with a TODO replacing logging with email
       delivery;
     - return `{ ok: true }` without token/link fields.
   - Activation must:
     - reject invalid tokens deterministically;
     - mark user activated;
     - insert `platform_admin`;
     - consume the token;
     - return `{ ok: true }`.

5. Activation enforcement
   - Extend JWT identity and authenticated request identity to carry activation
     state.
   - Ensure `POST /api/login`, `POST /api/renew`, and `GET /api/me` return
     activation state.
   - Add middleware or controller-level enforcement so protected app data and
     mutation endpoints return `403` for non-activated users.
   - Keep allowed endpoints usable for non-activated users:
     - `/api/me`
     - `/api/renew`
     - `/api/logout`
     - activation endpoints
     - app-info
     - page/static routes
   - Apply enforcement to service, reservation, workspace, owner, environment,
     invitation, and workspace-user APIs without relying on frontend hiding.

6. Browser login/registration
   - Add registration mode to the login page using existing page style.
   - Registration UI collects email, nickname, password, confirmation, captcha
     challenge, and answer.
   - Add `RegistrationService` for challenge and registration calls.
   - Add registration and activation endpoints to `ApiService` unauthenticated
     route handling.
   - Do not claim email was sent.
   - On successful registration, store the returned bearer token and redirect to
     the authenticated app shell so the activation-required banner is visible.

7. Browser activation page
   - Add `public/activate-account.html` and `public/ts/activate-account.ts`.
   - Add `AccountActivationService` to validate and consume tokens.
   - Page reads the token from `/activate-account/<token>`, validates or
     activates it, and renders deterministic success/failure states.
   - After successful activation, provide a navigation path to the login or app
     consistent with the existing auth flow.

8. Authenticated app banner
   - Extend browser `User` and `AuthService.loadUser` for activation state.
   - Render a prominent activation-required banner in `public/index.html` /
     `AppController` for logged-in non-activated users.
   - Hide or disable protected action controls for non-activated users for UX,
     while preserving server enforcement.
   - Activated users must not see the banner.

9. Documentation
   - Update README authentication API contract with:
     - registration captcha;
     - registration;
     - activation validate/consume;
     - temporary activation-link logging;
     - activation state in login/renew/me;
     - activation-gated authorization.

## Review Subagent Assignment

After production implementation, spawn exactly one clean-context code-review
subagent. Use only the approved spec, this plan, instructions, and final diff.

The review subagent must:

- check implementation against every approved behavior;
- identify spec mismatches, missing tests, role/activation race risks,
  non-activated authorization gaps, token leakage, and migration regressions;
- not implement fixes.

Main agent routes in-scope review findings requiring code changes to one
clean-context implementation subagent with only the finding, approved artifacts,
and relevant diff/file context.

## Main-Agent QA

The main agent must run QA after review findings are resolved.

Required automated validation:

- `npm run lint`
- `npm run build`
- `npm test`
- `git diff --check`

Required manual QA when a local database/dev server is available:

- Start the app with `npm run dev`.
- Load `/login`.
- Load a registration captcha and register a new account.
- Confirm server logs include an activation URL with a TODO and the registration
  response does not include the URL.
- Confirm successful registration automatically logs in and redirects to the app
  shell before activation.
- Confirm activation banner is visible.
- Confirm protected app data/actions are blocked for the non-activated account.
- Open the logged `/activate-account/<token>` URL and activate the account.
- Confirm the account can access the app without the banner.
- Confirm workspace creation is allowed subject to the existing workspace limit.

If manual QA cannot run because no database or dev server is available, mark
delivery as draft unless the user explicitly accepts automated-only validation.

## Commit And Push

- Main agent runs `npm run format` before committing accepted changes.
- Commit only files required by the approved spec and this plan.
- Use commit message `feature: Add website registration activation`.
- If any required validation, review, QA, or documentation is skipped, blocked,
  incomplete, or failing, use
  `feature: DRAFT add website registration activation`.
- Push the implementation branch after commit if repository access permits and
  project policy allows.

## Completion Report Requirements

Final implementation report must include:

- implemented spec summary;
- review findings and resolutions;
- QA findings and resolutions;
- validation commands run and results;
- unvalidated manual QA, if any;
- documentation updates;
- commit and push status;
- final or draft delivery status;
- whether final main-agent acceptance completed.

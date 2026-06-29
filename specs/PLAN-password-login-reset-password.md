# PLAN: Password Login And Reset Password

Status: Approved

Approved spec reference: `specs/SPEC-password-login-reset-password.md`

## Objective

Implement password-required login and reset-password flows against the approved spec while preserving the existing JWT bearer success contract after authentication succeeds.

## Target Branch

- `feature/password-login-reset-password`
- The implementation command must create this branch from the approved base branch before code edits unless the user explicitly instructs otherwise.

## Context Boundary

- This plan is produced from planning context and must not be implemented in the same accumulated context unless the user explicitly confirms same-context implementation for that invocation.
- Implementation may ingest only:
  - `AGENTS.md`
  - `~/workspace.md`
  - `specs/SPEC-password-login-reset-password.md`
  - this plan
  - files named or directly implied below
  - minimal local patterns needed to edit those files correctly

## Affected Files

- `config/app.yml`
- `config/schema/users.sql`
- new schema file under `config/schema` for password reset tokens
- `src/db.ts`
- `src/service-availability-scheduler.ts`
- `src/services/ConfigLoaderService.ts`
- `src/services/UserService.ts`
- new backend password/reset/captcha helper or service files under `src/services` or `src/helpers`
- `src/repositories/UserRepository.ts`
- new password reset token repository under `src/repositories`
- `src/entities/User.ts`
- new reset-token entity or DTO files under `src/entities` or `src/dtos` if useful
- `src/controllers/AuthController.ts`
- `src/controllers/AuthMiddleware.ts` only if unauthenticated route handling needs an explicit login/reset exception
- `src/controllers/PageController.ts`
- `public/login.html`
- new reset-password page HTML under `public` if the implementation does not reuse `login.html`
- `public/ts/controllers/LoginController.ts`
- new browser reset-password controller under `public/ts/controllers` if useful
- `public/ts/services/LoginService.ts`
- `public/ts/services/ApiService.ts`
- new browser captcha/reset service under `public/ts/services` if useful
- `public/ts/login.ts`
- new browser entrypoint file under `public/ts` if a separate reset page is added
- `src/tests/unit/config-loader-service.test.ts`
- `src/tests/unit/auth-middleware-controller.test.ts`
- `src/tests/unit/browser-auth-services.test.ts`
- new focused backend unit tests under `src/tests/unit`
- `src/tests/integration/workspace-service-db.test.ts` or a new integration test file if repository persistence coverage is practical
- `README.md`
- `AGENTS.md` only if implementation changes future-agent workflow expectations

## Ownership Boundaries

- Keep password hashing, password validation, reset-token lifecycle, and captcha validation outside Express route handlers where practical.
- Controllers may coordinate request parsing, service calls, status codes, and response bodies.
- Repositories own MySQL persistence details and must continue to use repository patterns from the existing codebase.
- Domain entities, DTOs, and application services must remain independent of Express, browser DOM, and runtime filesystem concerns.
- Browser request shaping and response handling must stay in browser service/controller files under `public/ts`.
- Do not commit generated `public/js` bundles, `.env` files, credentials, database dumps, or `node_modules`.

## Dependencies

1. Prefer built-in Node.js `crypto` APIs for secure token generation and password hashing if they satisfy the approved behavior without adding runtime dependencies.
2. If adding a password-hashing dependency is necessary, use npm to update both `package.json` and `package-lock.json`; do not hand-edit lockfile dependency entries.
3. Do not add external captcha provider dependencies.

## Test-First Work

Because this is behavior-changing work, the implementation command must use exactly one clean-context test-focused subagent before production implementation. Per workspace instructions, spawned test-focused agents must use `gpt-5.3-codex-spark`.

The test-focused subagent must add or update deterministic tests before production implementation for:

1. Config loading:
   - missing reset-token lifetime defaults to `3600`
   - `password_reset_token_expires_in_seconds` from `config/app.yml` is parsed
   - `PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS` overrides file config
   - non-numeric, zero, and negative reset-token lifetime values are rejected

2. Password behavior:
   - password validation accepts 8 or more characters
   - password validation rejects shorter passwords
   - password hashing/verifying accepts the correct password
   - password hashing/verifying rejects the wrong password
   - raw password values are not returned through user entities or login responses

3. Login controller behavior:
   - `POST /api/login` rejects missing email with `400`
   - `POST /api/login` rejects missing password with `400`
   - `POST /api/login` rejects unknown email, missing hash, and wrong password with `403`
   - `POST /api/login` returns the existing JWT success payload for a correct password

4. Captcha and reset controller behavior:
   - captcha challenge returns challenge id and prompt without answer
   - reset-link request requires valid captcha
   - reset-link request returns generic success for known and unknown emails after valid captcha
   - unknown email creates no token
   - known email creates one active token and invalidates any previous active token
   - reset URL is not returned in API responses
   - reset URL logging is asserted through a controlled logger seam where practical
   - token validation accepts active token and rejects missing, unknown, expired, or used tokens
   - password reset rejects short passwords
   - password reset stores the new password hash, marks the token used, invalidates other active tokens, and does not issue a JWT

5. Repository/persistence behavior where practical:
   - user password hash persists and loads by email/id
   - reset-token records persist with user id, token/hash, expiry, used marker, and invalidation state
   - single-active-token behavior holds in MySQL-backed repository tests if `TEST_DATABASE_URL` is configured

6. Browser behavior where practical:
   - login service sends email and password
   - API helper omits bearer auth for unauthenticated login/reset/captcha endpoints
   - forgot-password service sends email and captcha fields and handles generic success
   - reset-password service validates tokens and submits new passwords
   - browser auth storage behavior remains unchanged for successful login

If a browser or integration test is impractical under current local tooling, the test-focused subagent must state the gap and the main implementation must cover it through TypeScript validation, code review, and manual QA instructions.

## Implementation Steps

1. Create and switch to `feature/password-login-reset-password`.
2. Extend application config:
   - add `passwordResetTokenExpiresInSeconds` to the config type
   - parse `password_reset_token_expires_in_seconds`
   - parse `PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS`
   - apply environment precedence, default `3600`, and invalid-value rejection
   - add the default key to `config/app.yml`
3. Update schema initialization:
   - add nullable password-hash storage to `users`
   - add a reset-token schema file with user reference, token verifier, expiry timestamp, used marker, invalidation marker or equivalent, and created/used timestamps
   - update `src/db.ts` schema ordering so the reset-token table is created after `users`
4. Update user persistence:
   - load password-hash state when needed without exposing it in public user JSON
   - add repository methods to update a user's password hash
   - preserve existing `User` shape returned to authenticated clients unless a private type is needed for auth checks
5. Add password helper/service:
   - validate minimum 8 characters with an extensible rule boundary
   - hash new passwords with a one-way verifier
   - verify submitted passwords against stored hashes
   - ensure helpers never log raw passwords
6. Add reset-token persistence/service:
   - generate cryptographically secure reset tokens
   - persist only a token verifier/hash if feasible; otherwise document why raw-token persistence was required by implementation constraints
   - create one active token per user by invalidating previous active tokens for that user
   - validate active tokens without marking them used
   - consume tokens atomically for password reset where practical
   - mark consumed token used and invalidate other active tokens for that user
7. Add first-party captcha service:
   - generate challenge id and display prompt without exposing answer
   - validate challenge answers server-side
   - make successful validation single-use for reset-link requests
   - use deterministic clock injection or a test seam where needed
8. Update composition root:
   - instantiate new repositories/services
   - pass reset-token lifetime config into the reset-token service
   - pass a logger seam or `console` wrapper for temporary reset URL logging
9. Update `AuthController`:
   - require password in `POST /api/login`
   - verify password before issuing the existing JWT payload
   - add unauthenticated captcha challenge endpoint
   - add unauthenticated reset-link request endpoint
   - add unauthenticated reset-token validation endpoint
   - add unauthenticated password-reset submit endpoint
   - use generic reset-link success for known and unknown email after captcha passes
   - log `/reset-password/:token` for known users with a TODO to remove logging when email delivery is implemented
   - ensure reset APIs never return the reset URL
10. Update unauthenticated API handling:
   - ensure `requireAuth` or route ordering permits login, captcha, reset-link, reset-token validation, reset-submit, app-info, and page routes without bearer tokens
   - preserve bearer auth requirements for existing protected APIs
11. Update `PageController`:
   - serve `/reset-password/:token` with the selected reset-password page
   - keep `/login` and `/` behavior compatible with the existing browser app
12. Update frontend login:
   - add password input and submit it with email
   - preserve JWT token storage after successful login
   - add a forgot-password/reset-link UI flow from the login page
   - load captcha challenge, collect answer, submit reset-link request, and show generic success
13. Update frontend reset page:
   - validate token on load
   - show invalid-token state for missing, unknown, expired, or used token
   - show new password form only when token is valid
   - enforce visible minimum length validation consistent with backend
   - submit token plus password
   - show success and provide a path back to `/login`
14. Update browser services:
   - add reset/captcha service methods or extend `LoginService`
   - ensure `ApiService` does not attach bearer headers to unauthenticated login/reset/captcha endpoints
   - keep redirect-on-401 behavior for protected API calls
15. Update README:
   - replace email-only login wording with password login
   - document reset endpoints and generic reset response behavior at a high level
   - document reset-token config names, precedence, units, and default
   - document temporary server-side reset URL logging and the TODO for email delivery
16. Update `AGENTS.md` only if future-agent guidance changes are required.
17. Confirm generated `public/js` bundles are not staged.

## Implementation Subagents

Behavior-changing implementation requires these exact clean-context subagents:

1. Exactly one test-focused subagent before production implementation.
2. Exactly one implementation subagent for production implementation.
3. Exactly one code-review subagent after implementation.

Per workspace instructions, all spawned unit-testing and developer agents must use `gpt-5.3-codex-spark`.

If required subagent tooling is unavailable, the implementation command must stop and report the blocker rather than bypassing the required subagent phases.

## No-Research Constraints

Implementation workers must not perform product research, architecture research, scope discovery, planning research, or plan discovery.

Allowed implementation context is limited to:

- the approved spec
- this approved plan
- applicable instruction files
- files named or directly implied in this plan
- minimal local edit patterns needed to perform the listed steps

Any required behavior change not covered by the approved spec must stop implementation and return to spec iteration.

Any required technical deviation from this plan must stop implementation and request plan approval before continuing.

## Review Requirements

After production implementation, the code-review subagent must review:

- login failures and success payload against the approved spec
- password hashing and absence of raw password persistence/logging
- reset-token generation, storage, expiry, single-active-token behavior, and consumption
- captcha challenge/validation behavior and reset request gating
- generic reset-link response behavior and absence of reset URLs in API responses
- temporary reset URL logging includes the required TODO
- unauthenticated route boundaries for login/reset/captcha
- protected route bearer auth behavior remains unchanged
- frontend login, forgot-password, and reset-password flows
- config precedence and validation
- tests mapped to acceptance criteria
- documentation accuracy

The review subagent must not implement fixes. The main agent must route any in-scope finding requiring code changes to a clean-context implementation subagent with only the finding and relevant context.

## Main-Agent QA

The main agent must run QA after implementation and review findings are resolved:

1. Confirm `POST /api/login` rejects email-only requests with `400`.
2. Confirm `POST /api/login` rejects wrong password with `403`.
3. Confirm `POST /api/login` returns the existing JWT success payload for a correct password.
4. Confirm captcha challenge response does not include the answer.
5. Confirm reset-link request fails before token creation when captcha is invalid.
6. Confirm reset-link request returns generic success for unknown and known emails after valid captcha.
7. Confirm known-email reset-link request logs the reset URL with the required TODO and does not return the URL in JSON.
8. Confirm creating a second reset token invalidates the first active token for that user.
9. Confirm `/reset-password/:token` rejects used, expired, unknown, and missing tokens.
10. Confirm successful reset marks the token used and the new password works for login.
11. Confirm successful reset does not return a JWT.
12. Confirm existing protected API requests still require and accept bearer tokens.
13. Confirm browser TypeScript compiles.
14. Confirm README matches implemented config and temporary logging behavior.

If database-backed runtime QA cannot be run, report it as unvalidated and mark delivery as draft unless equivalent automated coverage fully verifies the affected behavior.

## Validation Commands

Run:

```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.client.json --noEmit
npm test
npm run build
npm run lint
git diff --check
```

Expected result: all commands pass.

Before committing accepted changes, the main agent must run:

```bash
npm run format
```

Then re-run any validation made necessary by formatting changes.

## Commit And Push Expectations

- Commit after implementation, review, QA, validation, documentation, and final main-agent acceptance when project policy permits.
- Use a non-draft commit message only if all required validation, review, QA, and documentation are complete and passing.
- Use a `DRAFT` commit message and draft delivery status if required validation, review, QA, or documentation is skipped, blocked, incomplete, or failing.
- Push the implementation branch after commit when repository access exists and project/user instructions permit.

## Completion Report Requirements

The final implementation report must include:

- implemented spec summary
- code-review findings and resolutions
- QA findings and resolutions
- validation commands run and outcomes
- validation not run
- remaining risks or limitations
- documentation updates
- commit status
- push status
- whether delivery is final or draft
- whether the Definition of Done was fully satisfied
- confirmation that final main-agent acceptance was completed

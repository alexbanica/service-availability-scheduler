Status: Approved

# JWT Login And Bearer Authentication Implementation Plan

Approved spec reference: `specs/SPEC-jwt-login-bearer-auth.md`

## Objective

Implement JWT-backed email login, bearer-token authentication for protected API calls, token renewal, browser `localStorage` token persistence, and configurable token lifetime while preserving existing service, workspace, reservation, and authorization behavior after authentication succeeds.

## Target Branch

- `feature/jwt-login-bearer-auth`
- The implementation command must create this branch from the approved base branch before code edits unless the user explicitly instructs otherwise.

## Context Boundary

- This plan was produced from planning context and must not be implemented in the same accumulated context unless the user explicitly confirms same-context implementation for that invocation.
- Implementation may ingest only:
  - `AGENTS.md`
  - `~/workspace.md`
  - `specs/SPEC-jwt-login-bearer-auth.md`
  - this plan
  - the files named or directly implied below
  - minimal local patterns needed to edit those files correctly

## Affected Files

- `package.json`
- `package-lock.json`
- `config/app.yml`
- `src/service-availability-scheduler.ts`
- `src/services/ConfigLoaderService.ts`
- `src/controllers/AuthController.ts`
- `src/controllers/AuthMiddleware.ts`
- `src/controllers/PageController.ts`
- `src/controllers/ReservationController.ts`
- `src/controllers/ServiceController.ts`
- `src/controllers/WorkspaceController.ts`
- `src/types/express-session.d.ts`
- new backend auth helper files under `src/services`, `src/helpers`, or `src/dtos` following existing naming conventions
- new backend auth request type declaration under `src/types` if needed
- `public/ts/services/ApiService.ts`
- `public/ts/services/LoginService.ts`
- `public/ts/services/AuthService.ts`
- `public/ts/services/EventsService.ts`
- `public/ts/controllers/AppController.ts`
- new browser auth helper file under `public/ts/services` or `public/ts/helpers` if needed
- `src/tests/unit/config-loader-service.test.ts`
- new focused backend auth tests under `src/tests/unit`
- new focused browser helper tests only if a deterministic local pattern is added without introducing broad test tooling
- `README.md`
- `AGENTS.md` only if implementation changes future-agent startup, validation, architecture, or auth expectations beyond README coverage

## Ownership Boundaries

- Keep JWT signing, verification, expiration calculation, and token response shaping out of controllers where practical.
- Controllers may depend on auth/application services and request-local authenticated identity.
- Domain entities, DTOs, and core use-case services must remain independent of Express, browser DOM, filesystem/runtime details, and JWT library APIs.
- Browser token storage and header construction must stay in browser-side helper/service code, not scattered through controllers.
- Do not reintroduce YAML-backed service catalog behavior.
- Do not commit generated `public/js` bundles, `.env` files, credentials, local database dumps, or `node_modules`.

## Dependencies

1. Add a maintained JWT library and matching TypeScript types when needed.
2. Preferred package: `jsonwebtoken` with `@types/jsonwebtoken`, unless implementation finds an already-installed JWT-capable dependency in `package-lock.json`.
3. Update `package-lock.json` through package manager commands, not manual editing.

## Test-First Work

Because this is behavior-changing work, the implementation command must use exactly one clean-context test-focused subagent before production implementation. That subagent must receive only the approved spec, this plan, and minimal relevant file context.

The test-focused subagent must add or update deterministic tests before production implementation for:

1. `ConfigLoaderService`
   - missing JWT lifetime defaults to `3600`
   - `jwt_expires_in_seconds` from `config/app.yml` is parsed
   - `JWT_EXPIRES_IN_SECONDS` overrides the file value
   - non-numeric, zero, and negative JWT lifetime values are rejected

2. Backend JWT auth service or helper
   - issued token verifies to user id, email, and nickname
   - issued token uses configured lifetime
   - expired token is rejected deterministically
   - malformed token is rejected deterministically

3. Auth middleware/controller behavior
   - `POST /api/login` does not require authorization and returns `token`, `token_type: "Bearer"`, `expires_in_seconds`, and `user`
   - protected API middleware accepts a valid bearer token
   - protected API middleware rejects missing, malformed, invalid, and expired bearer tokens with `401` JSON
   - renew endpoint accepts a valid unexpired token and returns a replacement token with configured lifetime
   - renew endpoint rejects expired or invalid tokens with `401` JSON

4. Browser token behavior where practical without introducing heavy browser tooling
   - login service stores the returned token in `localStorage`
   - API helper omits bearer auth for `/api/login`
   - API helper sends `Authorization: Bearer <token>` for other API calls when a token is stored
   - auth/logout helper clears the token

If browser helper tests are impractical under the existing test setup, the test-focused subagent must state that clearly and the main implementation must validate browser behavior through TypeScript checks and code review.

## Implementation Steps

1. Create and switch to `feature/jwt-login-bearer-auth`.
2. Add JWT dependencies using npm so `package.json` and `package-lock.json` remain consistent.
3. Extend `AppConfig` with `jwtExpiresInSeconds`.
4. Update `ConfigLoaderService` to:
   - read `jwt_expires_in_seconds` from `config/app.yml`
   - read `JWT_EXPIRES_IN_SECONDS` from `process.env`
   - use env precedence over file config
   - default to `3600`
   - reject non-numeric, zero, and negative values with deterministic errors
5. Add `jwt_expires_in_seconds: 3600` to `config/app.yml`.
6. Add a backend JWT auth service/helper that:
   - signs tokens with the configured lifetime
   - verifies tokens with the configured secret
   - exposes normalized authenticated user identity
   - distinguishes verification failure as unauthenticated behavior without leaking sensitive token details
7. Replace session-backed auth middleware with bearer-token middleware:
   - parse `Authorization`
   - accept case-insensitive `Bearer` scheme
   - verify token
   - set request-local authenticated user identity
   - return `401` JSON for protected API and event auth failures
8. Update controller request identity reads:
   - `AuthController`
   - `ServiceController`
   - `ReservationController`
   - `WorkspaceController`
   - any other protected controller currently reading `req.session`
9. Update `AuthController`:
   - keep `POST /api/login` unauthenticated
   - issue token on successful login
   - add protected renew endpoint under `/api/*`
   - make logout stateless while returning the existing success shape
   - make `/api/me` return identity from the authenticated request context
10. Remove `express-session` middleware from `src/service-availability-scheduler.ts` after all server routes stop depending on `req.session`.
11. Remove `express-session` dependencies and session type augmentation if no longer used.
12. Update `PageController`:
   - keep `/login` publicly accessible without server-side session redirect
   - serve `/` without session gating so browser-side token bootstrap can run
   - keep `/api/app-info` behavior unchanged
13. Make expiry notifications token-compatible:
   - replace browser `EventSource('/events')` with a fetch-stream implementation that sends `Authorization: Bearer <token>`, or an equivalent deterministic bearer-compatible mechanism
   - keep existing `expiring` event payload semantics and user confirmation behavior
   - keep server-side event auth based on the same JWT request context
14. Update browser token handling:
   - store login token in `localStorage`
   - centralize token get/set/clear operations
   - include bearer header for all API helper calls except `/api/login`
   - remove `credentials: "include"` from JWT API calls
   - clear token and redirect to `/login` on `401`
15. Implement browser renewal behavior:
   - track token expiry using `expires_in_seconds` from login/renew responses
   - schedule renewal before expiry during active app usage
   - call the renew endpoint with the current bearer token
   - replace the stored token after successful renewal
   - clear token and redirect to `/login` on renewal `401`
16. Update README:
   - login response contract
   - bearer header requirement
   - renew endpoint behavior
   - `SESSION_SECRET` as JWT signing secret unless renamed by implementation within approved scope
   - `JWT_EXPIRES_IN_SECONDS`
   - `jwt_expires_in_seconds`
   - precedence and default
17. Update `AGENTS.md` only if implementation changes repository guidance future agents need.
18. Confirm no generated `public/js` bundles are staged.

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
- the files named or directly implied in this plan
- minimal local edit patterns needed to perform the listed steps

Any required behavior change not covered by the approved spec must stop implementation and return to spec iteration.

Any required technical deviation from this plan must stop implementation and request plan approval before continuing.

## Review Requirements

After production implementation, the code-review subagent must review:

- JWT issuance, verification, expiration, and renewal behavior against the spec
- absence of session fallback for protected APIs
- controller identity usage after middleware migration
- browser token storage and header behavior
- renewal scheduling and failure handling
- event notification compatibility
- config precedence and validation
- tests mapped to acceptance criteria
- documentation accuracy

The review subagent must not implement fixes. The main agent must route any in-scope finding requiring code changes to a clean-context implementation subagent with only the finding and relevant context.

## Main-Agent QA

The main agent must run QA after implementation and review findings are resolved:

1. Use a local test token or focused automated tests to confirm `POST /api/login` returns token fields without an inbound `Authorization` header.
2. Confirm a protected API rejects no token with `401`.
3. Confirm the same protected API accepts `Authorization: Bearer <token>`.
4. Confirm renew returns a different valid token and preserves user identity.
5. Confirm expired token behavior through deterministic test coverage.
6. Confirm browser TypeScript compiles.
7. Confirm README config and auth contract match implemented names.

If database-backed runtime QA cannot be run, report it as unvalidated and mark delivery as draft unless equivalent automated coverage fully verifies the affected behavior.

## Validation Commands

Run:

```bash
npx tsc -p tsconfig.json --noEmit
npx tsc -p tsconfig.client.json --noEmit
npm test
npm run build
git diff --check
```

Expected result: all commands pass.

Do not run `npm run lint` or `npm run format` unless formatting changes are intended, because repository instructions state those scripts rewrite files.

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
- documentation updates
- commit status
- push status
- final or draft delivery status
- skipped, blocked, or unvalidated Definition of Done items
- confirmation that final main-agent acceptance was completed

# Logout History Cache Protection Plan

Status: Approved

Approved spec reference: `specs/SPEC-logout-history-cache-protection.md`

## Affected Files

- `src/controllers/PageController.ts`
- `public/index.html`
- `public/ts/app.ts`
- `public/ts/controllers/AppController.ts`
- `public/ts/controllers/LoginController.ts`
- `public/ts/services/ApiService.ts`
- `public/ts/services/AuthService.ts`
- `public/ts/services/EventsService.ts`
- `src/tests/unit/page-controller-cache.test.ts`
- `src/tests/unit/app-controller-renewal-scheduling.test.ts`
- `src/tests/unit/browser-auth-services.test.ts`
- `specs/SPEC-logout-history-cache-protection.md`
- `specs/PLAN-logout-history-cache-protection.md`

## Implementation Steps Performed

1. Added a `PageController` helper that applies no-store/no-cache headers to
   HTML page responses.
2. Applied those headers to `/`, `/login`, and `/reset-password/:token`.
3. Added a synchronous `/` document pre-render guard that hides the page and
   redirects to `/login` before protected content can paint when the stored
   token is missing or locally expired.
4. Added app-bootstrap auth gating before Vue mounts.
5. Added `pagehide` and `pageshow` handling so restored protected history
   entries stay hidden until a valid stored token is confirmed.
6. Centralized browser auth checks and login redirects in `AuthService`.
7. Changed logout to clear the stored token and redirect in a `finally` block.
8. Changed logout, auth-renewal 401, API 401, and event-stream 401 redirects to
   prefer `window.location.replace('/login')`.
9. Changed successful login to use `window.location.replace('/')`.
10. Removed the stale AppController-specific restore redirect helper because the
    redirect now happens before app mount.
11. Stopped app startup loading and redirected when `/api/me` does not return a
    user.
12. Added focused tests for page cache headers, auth restore hiding/redirect
    behavior, and logout clearing after request failure.

## Validation Run

- `node -r ts-node/register --test src/tests/unit/page-controller-cache.test.ts src/tests/unit/app-controller-renewal-scheduling.test.ts src/tests/unit/browser-auth-services.test.ts`
- `npx tsc -p tsconfig.client.json --noEmit`
- `npx tsc -p tsconfig.json --noEmit`
- `git diff --check`

## Validation Skipped

- `npm test`: skipped because it is a full-suite command and may exceed the
  `$super-agent` short validation limit.
- `npm run lint`: skipped because it can rewrite files and may exceed the
  `$super-agent` short validation limit.
- `npm run build`: skipped because it runs clean/install/build steps and is
  expected to exceed the `$super-agent` short validation limit.

## QA Skipped

Browser manual QA was skipped by `$super-agent` workflow design.

## Code Review Skipped

Dedicated code review was skipped by `$super-agent` workflow design.

## Documentation Updates

- Added completed-work spec and plan artifacts under `specs/`.

## Commit Status

Not committed; the user did not request a commit.

## Push Status

Not pushed; the user did not request a push.

## Residual Risk

- The exact Back-button behavior was not manually verified in a real browser.
- Full regression coverage was not run under the lower-assurance `$super-agent`
  workflow.

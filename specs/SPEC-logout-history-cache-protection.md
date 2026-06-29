# Logout History Cache Protection

Status: Approved

## Purpose

Prevent authenticated application content from remaining visible after logout when
the user presses the browser Back button.

## Problem Statement

After logout, the JWT token is cleared and protected API actions fail, but the
browser can restore the previously rendered application page from history or
cache. That allows stale authenticated content to remain visible even though the
session is no longer usable.

## Scope

- Authenticated app page cache behavior.
- Login and reset-password page cache behavior.
- Browser-side handling before the authenticated app page renders and when it
  is restored from browser history.
- Logout token clearing behavior.
- Authenticated browser redirect behavior for logout, API 401 responses, event
  stream 401 responses, and successful login.

## Out Of Scope

- Server-side JWT revocation lists.
- Changes to bearer-token authorization semantics.
- Changes to reservation, workspace, service, owner, or environment behavior.
- Generated `public/js` bundles.

## Inputs And Constraints

- The browser stores JWT auth state in `localStorage`.
- Server-side page protection does not rely on Express session state.
- The authenticated app shell must redirect to `/login` when no valid stored
  token exists.
- The authenticated app shell must not visibly paint stale protected content
  while that redirect is being decided.
- `$super-agent` delivery skips full QA and code review by design.

## Deterministic Behavior Delivered

- `GET /`, `GET /login`, and `GET /reset-password/:token` now send no-store
  page-cache headers.
- The authenticated `/` page includes a synchronous pre-render guard that hides
  the document and redirects to `/login` before the app can paint when no stored
  token exists or the stored token has a locally expired timestamp.
- The browser app bootstrap checks the same auth condition before mounting Vue.
- The browser app marks the page hidden on `pagehide` and rechecks auth on
  `pageshow`, so a browser Back/history restoration cannot visibly expose stale
  protected content after logout.
- Auth redirects use `window.location.replace('/login')` where available, so
  logout and protected 401 paths replace the current protected history entry
  instead of adding a new login entry above it.
- Successful login uses `window.location.replace('/')` to replace the login
  page with the authenticated app entry.
- If `/api/me` cannot load an authenticated user, the app stops additional
  startup loading and redirects to `/login`.
- Logout clears the stored token in a `finally` block and redirects to `/login`
  even when the stateless logout API request fails.
- The stale AppController-specific history restore redirect helper was removed;
  auth-page visibility and redirect handling now live at the app bootstrap and
  auth-service boundaries.

## Assumptions

- A missing or expired stored token is sufficient evidence that authenticated
  content must not remain visible.
- A stored token without the browser-side expiry key follows the existing
  `AuthTokenStorage` behavior and is not treated as locally expired by the
  pre-render guard.
- Redirecting to `/login` is the existing intended unauthenticated browser
  behavior.

## Impact And Regression Considerations

- Authenticated HTML pages become non-cacheable, reducing stale-page exposure.
- Static assets under `/public` keep existing static middleware behavior.
- Login and reset-password HTML are also no-store to avoid preserving auth or
  reset-token page state in browser history.
- API authorization and token verification are unchanged.
- Replacing history entries changes Back-button behavior after login/logout so
  users do not land on stale protected pages.

## Validation Performed

- Ran focused unit tests for page cache headers, app auth restore redirect, and
  logout token clearing.
- Ran focused client TypeScript check.
- Ran focused server TypeScript check.
- Ran `git diff --check`.

## Validation Skipped

- Full `npm test` was skipped because `$super-agent` avoids commands expected to
  exceed the short validation limit.
- `npm run build` was skipped because it runs clean/install/build steps and is
  expected to exceed the short validation limit.
- Browser manual QA was skipped because `$super-agent` skips QA by design.

## Documentation Changes

- Added this completed-work spec.

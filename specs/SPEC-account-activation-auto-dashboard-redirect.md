# Account Activation Auto Dashboard Redirect

Status: Approved

## Purpose

Document the delivered behavior where a successful account activation signs the user in and sends them to the dashboard automatically.

## Problem Statement

After a user opens an account activation link and activates the account, the page must not require a separate manual login. The page must show a visible countdown and automatically redirect to the dashboard after 5 seconds, with a manual dashboard button available if the automatic redirect does not complete.

## Scope

- Successful activation through `/api/account-activation`.
- Browser activation token storage after activation.
- Activation success UI on `/activate-account/<token>`.
- A 5-second dashboard redirect countdown.
- A visible `Show dashboard` button after successful activation.

## Out Of Scope

- Changing registration behavior.
- Sending real activation email.
- Changing activation token generation, validation, expiry, or invalid-token behavior.
- Changing dashboard authorization rules.
- Changing password reset behavior.

## Definitions

- Dashboard: the authenticated app shell at `/`.
- Activation link: `/activate-account/<token>`.
- Activated login: storing the bearer token returned by the activation API so the next dashboard load is authenticated.

## Inputs And Constraints

- The activation page receives the token from the URL path.
- The activation API remains unauthenticated and accepts `{ token }`.
- Successful activation must return the existing authenticated response payload shape: `ok`, `user`, `token`, `token_type`, and `expires_in_seconds`.
- Browser token persistence must use the existing `AuthTokenStorage` helper.
- The redirect countdown duration is exactly 5 seconds.

## Deterministic Behavior Delivered

- When `/api/account-activation` successfully consumes a token, activates the user, and grants the activation role, the API returns an authenticated bearer token payload for the activated user.
- The activated user payload reports `activated: true`.
- The browser `AccountActivationService.activate` stores the returned bearer token and expiry in `localStorage`.
- After successful activation, `/activate-account/<token>` displays `Account activated. Redirecting to the dashboard in N seconds.`
- The countdown starts at 5 and redirects to `/` when it reaches zero.
- A `Show dashboard` button is displayed during the success state and navigates to `/` immediately.
- Invalid activation tokens continue to produce the existing error state and do not start the dashboard redirect.

## Assumptions

- `/` is the dashboard route.
- The activation endpoint can fetch the activated user by ID after token consumption.
- Returning a bearer token from activation is the intended meaning of automatic login.

## Impact And Regression Considerations

- Activation success response shape is expanded from `{ ok: true }` to the standard authenticated payload.
- Existing clients that only check `ok` continue to work.
- Browser activation now depends on the token payload; missing token fields are treated as an activation response contract error.
- Invalid, expired, used, or missing activation tokens are not changed.

## Validation Performed

- Added unit coverage that `/api/account-activation` returns a bearer token, expiry, and activated user payload.
- Added browser service unit coverage that activation stores the returned bearer token and expiry.
- Ran `git diff --check`.

## Validation Skipped

- `npm run build` skipped because the super-agent workflow skips commands expected to exceed 10 seconds.
- `npm run lint` skipped because it is expected to exceed 10 seconds.
- `npm test` skipped because the full suite is expected to exceed 10 seconds.
- Manual browser QA skipped by super-agent workflow.

## Documentation Changes

- Added this completed-work spec.
- Added `specs/PLAN-account-activation-auto-dashboard-redirect.md`.

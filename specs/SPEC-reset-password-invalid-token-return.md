# SPEC: Reset Password Invalid Token Return

Status: Approved

## Purpose

Make the reset-password invalid-token screen return users to the login flow without leaving them on a dead reset-token page.

## Problem Statement

When a reset-password token is missing, unknown, expired, or used, the reset-password page shows an invalid-token error. Users need both an immediate manual route back to login and an automatic return after a short delay.

## Scope

- Update the reset-password invalid-token UI.
- Automatically redirect the browser to `/login` 5 seconds after reset-token validation fails.
- Style the manual `Return to login` action as the existing button-style link.
- Hide the `Set a new password for your account.` helper copy while the invalid-token state is shown.

## Out Of Scope

- Changing reset-token validation rules, password policy, password storage, login API behavior, or backend reset behavior.
- Changing generated `public/js` bundles.
- Changing unrelated login, workspace, service, reservation, or admin UI behavior.

## Inputs And Constraints

- The reset-password page is served from `public/reset-password.html`.
- The browser reset-password controller owns token validation state.
- The return target is `/login`.
- The auto-return delay is exactly 5 seconds after the page determines the reset token is invalid.
- Generated browser bundles under `public/js` remain build artifacts and are not committed.

## Deterministic Behavior Delivered

- Before token validation fails, the page can continue to show `Set a new password for your account.`.
- After token validation fails, that helper copy is no longer rendered.
- After token validation fails, the page shows the invalid-token error, a short 5-second return message, and a `Return to login` button-style link.
- After token validation fails because the token is missing or rejected by the validation API, the controller sets `window.location.href` to `/login` after 5000 milliseconds.
- If the Vue app unmounts before the timeout fires, the pending redirect timeout is cleared.
- Successful password reset continues to use the existing 5-second login redirect behavior.

## Assumptions

- "Invalid reset token page" means the existing reset-password token-error state controlled by `tokenError`.
- The manual return action can remain an anchor for correct navigation semantics while being visually styled as a button.

## Impact And Regression Considerations

- The change is limited to reset-password page presentation and browser-side invalid-token navigation.
- Token validation and reset API behavior are unchanged.
- The redirect scheduling helper is shared by invalid-token and successful-reset states, preserving the existing cleanup behavior.

## Validation Performed

- Short targeted TypeScript validation and diff checks are recorded in the matching plan.

## Validation Skipped

- Full build, full lint, full automated tests, browser QA, and code review are skipped under the `$super-agent` lower-assurance workflow.

## Documentation Changes

- This completed-work spec documents the delivered behavior.

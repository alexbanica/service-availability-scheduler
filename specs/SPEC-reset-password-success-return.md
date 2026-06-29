# SPEC: Reset Password Success Return

Status: Approved

## Purpose

Make the reset-password success screen return users to the login flow without leaving them on a completed reset form state.

## Problem Statement

After a password reset succeeds, the page showed a plain `Return to login` link and kept the reset-password helper copy visible. Users needed a clearer login action and the page should automatically return to login after a short delay.

## Scope

- Update the reset-password success UI.
- Automatically redirect the browser to `/login` 5 seconds after a successful password reset.
- Style the manual `Return to login` action as a button consistent with existing app buttons.
- Hide the `Set a new password for your account.` helper copy after the password has been changed.

## Out Of Scope

- Changing reset-token validation, password policy, password storage, login API behavior, or backend reset behavior.
- Changing generated `public/js` bundles.
- Changing unrelated login, workspace, service, reservation, or admin UI behavior.

## Inputs And Constraints

- The reset-password page is served from `public/reset-password.html`.
- The browser reset-password controller owns the successful submit state.
- The return target is `/login`.
- The auto-return delay is exactly 5 seconds after the reset API call succeeds.
- Generated browser bundles under `public/js` remain build artifacts and are not committed.

## Deterministic Behavior Delivered

- Before a successful reset, the page continues to show `Set a new password for your account.`.
- After a successful reset, that helper copy is no longer rendered.
- After a successful reset, the page shows `Password updated.`, a short 5-second return message, and a `Return to login` button-style link.
- After a successful reset, the controller sets `window.location.href` to `/login` after 5000 milliseconds.
- If the Vue app unmounts before the timeout fires, the pending redirect timeout is cleared.

## Assumptions

- The requested phrase "When password was changed" means the existing successful reset state where `submitted` is true after `PasswordResetService.resetPassword` resolves.
- The manual return action can remain an anchor for correct navigation semantics while being visually styled as a button.

## Impact And Regression Considerations

- The change is limited to reset-password page presentation and browser-side post-success navigation.
- Token validation and reset API behavior are unchanged.
- Existing button styling now also applies to `.button-link`; this is scoped to elements explicitly given that class.

## Validation Performed

- Short targeted TypeScript validation and diff checks are recorded in the matching plan.

## Validation Skipped

- Full build, full lint, full automated tests, browser QA, and code review are skipped under the `$super-agent` lower-assurance workflow.

## Documentation Changes

- This completed-work spec documents the delivered behavior.

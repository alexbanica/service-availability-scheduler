# Login Page Action Layout

Status: Approved

## Purpose

Make the login page action hierarchy clearer by keeping the theme control in the
header and moving account recovery and registration actions under the primary
login action.

## Problem Statement

The login page showed three mode buttons beside the dark/light theme switch.
Those controls made reset-password and registration appear as header-level
navigation instead of secondary account actions.

## Scope

- Remove the three login/register/reset mode buttons that appeared next to the
  dark/light switch.
- Keep the dark/light switch available in the login header.
- Place the reset-password action directly under the `Log In` button.
- Add a visible horizontal `or` delimiter under the reset-password action.
- Place the registration action under the delimiter.
- Rename the registration action to `Create new Account`.

## Out Of Scope

- Backend authentication behavior.
- Registration, password reset, captcha, activation, or token behavior.
- Generated browser JavaScript bundles.
- Authenticated application layout.

## Inputs And Constraints

- The existing Vue login modes remain the source of behavior.
- The login form keeps using `openForgotMode` for password reset navigation.
- The login form keeps using `openRegisterMode` for registration navigation.
- The layout must fit the existing login card style.

## Deterministic Behavior Delivered

- The login header contains the page title/subtitle and theme toggle only.
- In login mode, the `Log In` submit button is followed by:
  - `Reset Password`
  - a horizontal `or` divider
  - `Create new Account`
- Selecting `Reset Password` opens the existing forgot-password mode.
- Selecting `Create new Account` opens the existing registration mode.

## Assumptions

- "Delimiter with ----or---" means a visible horizontal separator carrying the
  `or` choice label rather than plain inline text.
- The requested "create new button" is the existing registration mode trigger,
  renamed to `Create new Account`.

## Impact And Regression Considerations

- This is a UI-only layout change.
- Existing reset-password and registration flows are preserved by reusing the
  same Vue controller methods.
- Removing the header mode buttons reduces duplicated navigation and keeps the
  theme toggle as the only header control.

## Validation Performed

- Inspected the changed login HTML/CSS.
- Ran `git diff --check`.

## Validation Skipped

- `npm run lint`, `npm run build`, and `npm test` were skipped because this
  `$super-agent` workflow only runs short validation expected to finish within
  10 seconds.
- Browser/manual QA was skipped by design for this lower-assurance workflow.

## Documentation Changes

- Added this completed-work spec.

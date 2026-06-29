# Captcha Reload On Form Edit

Status: Approved

## Purpose

Prevent stale captcha challenges from being reused after a user fixes form
errors in captcha-protected unauthenticated forms.

## Problem Statement

When registration or password reset submission failed after a captcha was
loaded, the browser kept the same captcha challenge visible. If the user
corrected form fields and resubmitted, the backend could reject the stale or
already-consumed challenge as `Invalid captcha`.

## Scope

- Registration form behavior on the login page.
- Password reset request form behavior on the login page.
- Browser-side handling of a loaded captcha after captcha-protected form field
  edits.
- Focused browser controller test coverage for the captcha reset state.

## Out Of Scope

- Backend captcha validation semantics.
- Registration API response contracts.
- Generated browser JavaScript bundles in git commits.

## Inputs And Constraints

- Captcha challenges remain one-time backend challenges.
- Registration account fields are email, nickname, password, and confirmation.
- Password reset request fields are email and captcha answer.
- Editing the captcha answer itself must not invalidate the currently displayed
  challenge.

## Deterministic Behavior Delivered

- Loading a registration captcha clears any previous registration captcha
  answer.
- Loading a password reset captcha clears any previous password reset captcha
  answer.
- After a registration captcha is loaded, editing email, nickname, password, or
  confirm password clears:
  - captcha challenge id;
  - captcha prompt;
  - captcha answer;
  - registration error message;
  - registration success flag.
- Clearing the prompt makes the registration form show `Load Captcha` again
  before another registration submission can be attempted.
- After a password reset captcha is loaded, editing the reset email clears:
  - captcha challenge id;
  - captcha prompt;
  - captcha answer;
  - password reset error message;
  - password reset success flag.
- Clearing the prompt makes the password reset form show `Load Captcha` again
  before another reset request submission can be attempted.
- Editing a captcha answer does not clear that form's captcha prompt.

## Assumptions

- "Once the form gets touched" means captcha-protected non-answer fields are
  corrected after a loaded challenge, not the captcha answer field itself.

## Impact And Regression Considerations

- The change is browser-side and preserves backend captcha behavior.
- Users must load a fresh captcha after correcting captcha-protected form fields.
- Existing successful registration and token storage behavior is unchanged.

## Validation Performed

- Added focused controller test coverage for registration and password reset
  captcha reset state.
- Ran the focused browser auth service unit test file.
- Regenerated local browser JavaScript with the TypeScript compiler so the
  running page receives the controller change.
- Ran `git diff --check`.

## Validation Skipped

- `npm run lint`, `npm run build`, and the full `npm test` suite were skipped
  because this `$super-agent` workflow only runs short validation expected to
  finish within 10 seconds.
- Manual browser QA was skipped by design for this lower-assurance workflow.

## Documentation Changes

- Added this completed-work spec.

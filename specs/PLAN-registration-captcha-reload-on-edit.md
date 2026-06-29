# Captcha Reload On Form Edit Implementation Plan

Status: Approved

Approved spec: `specs/SPEC-registration-captcha-reload-on-edit.md`

## Affected Files

- `public/login.html`
- `public/ts/controllers/LoginController.ts`
- `public/js/controllers/LoginController.js`
- `src/tests/unit/browser-auth-services.test.ts`
- `specs/SPEC-registration-captcha-reload-on-edit.md`
- `specs/PLAN-registration-captcha-reload-on-edit.md`

## Implementation Steps Performed

- Added a registration captcha reset handler in `LoginController`.
- Made registration challenge loading clear any previous captcha answer.
- Wired email, nickname, password, and confirm-password field input events to
  clear the loaded captcha challenge and reveal `Load Captcha` again.
- Added a password reset captcha reset handler in `LoginController`.
- Made password reset challenge loading clear any previous captcha answer.
- Wired reset email input events to clear the loaded captcha challenge and
  reveal `Load Captcha` again.
- Left captcha answer fields unchanged so users can type an answer without
  invalidating the displayed challenge.
- Regenerated local browser JavaScript so the browser-served controller includes
  the source changes.
- Added focused browser controller unit coverage for both reset behaviors.
- Created completed-work spec and plan artifacts with `Approved` status.

## Validation Run

- `node -r ts-node/register --test src/tests/unit/browser-auth-services.test.ts`
- `npx tsc -p tsconfig.client.json --pretty false`
- `git diff --check`

## Validation Skipped

- `npm run lint`
- `npm run build`
- Full `npm test`
- Manual browser QA

These were skipped because the `$super-agent` workflow only runs validation that
is expected to complete within 10 seconds and skips QA by design.

## QA Skipped

Manual QA was skipped by design for this lower-assurance workflow.

## Code Review Skipped

Code review was skipped by design for this lower-assurance workflow.

## Documentation Updates

- Added `specs/SPEC-registration-captcha-reload-on-edit.md`.
- Added this completed-work plan.

## Commit Status

Not committed. The user did not request a commit.

## Push Status

Not pushed. The user did not request a push.

## Residual Risk

- Browser rendering was not manually verified in this workflow.

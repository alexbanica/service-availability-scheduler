# PLAN: Reset Password Invalid Token Return

Status: Approved

Approved spec reference: `specs/SPEC-reset-password-invalid-token-return.md`

## Affected Files

- `public/reset-password.html`
- `public/ts/controllers/ResetPasswordController.ts`
- `public/styles.css`
- `specs/SPEC-reset-password-invalid-token-return.md`
- `specs/PLAN-reset-password-invalid-token-return.md`

## Implementation Steps Performed

1. Updated the reset-password header helper copy so it is hidden while an invalid-token state is shown.
2. Replaced the plain invalid-token error-only block with an invalid-token state that includes the error, a visible countdown return message, and a button-style `Return to login` anchor.
3. Added invalid-token state spacing that matches the existing success-state spacing.
4. Added a shared reset-password controller helper to count down from 5 seconds and redirect to `/login` when the countdown reaches zero.
5. Scheduled the login redirect countdown when token validation fails because the token is missing or rejected by the validation API.
6. Kept the successful-reset `/login` redirect behavior through the shared countdown helper and existing unmount cleanup.
7. Regenerated the ignored browser JavaScript bundle with `npx tsc -p tsconfig.client.json` so the served `/public/js/controllers/ResetPasswordController.js` matches the TypeScript source during local runtime.
8. Created completed-work `$super-agent` spec and plan artifacts.

## Validation Run

- `npx tsc -p tsconfig.client.json`
- `git diff --check`

## Validation Skipped

- `npm run build`: skipped because `$super-agent` avoids commands expected to exceed 10 seconds.
- `npm run lint`: skipped because `$super-agent` avoids commands expected to exceed 10 seconds.
- `npm test`: skipped because `$super-agent` avoids commands expected to exceed 10 seconds.
- Browser/manual QA: skipped because `$super-agent` skips QA by design.

## QA Skipped

QA was skipped by design under the `$super-agent` workflow.

## Code Review Skipped

Code review was skipped by design under the `$super-agent` workflow.

## Documentation Updates

- Added this completed-work plan.
- Added `specs/SPEC-reset-password-invalid-token-return.md`.

## Commit Status

Not committed. The user did not request a commit.

## Push Status

Not pushed. The user did not request a push.

## Residual Risk

- Generated `public/js` bundles were not updated in the worktree; the project build process must regenerate them for runtime deployment.
- Full lint, full build, full test suite, browser QA, and code review were not performed under this lower-assurance workflow.

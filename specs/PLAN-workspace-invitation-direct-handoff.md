# Workspace Invitation Direct Handoff Plan

Status: Approved

## Spec Reference

- `specs/SPEC-workspace-invitation-direct-handoff.md`

## Affected Files

- `public/ts/controllers/WorkspaceInvitationController.ts`
- `public/ts/controllers/LoginController.ts`
- `public/ts/controllers/AppController.ts`
- `specs/SPEC-workspace-invitation-direct-handoff.md`
- `specs/PLAN-workspace-invitation-direct-handoff.md`

## Implementation Steps Performed

1. Updated the invitation page to detect valid existing-user invitations.
2. Redirected unauthenticated existing-user invitees directly to login with a
   scoped invitation handoff code in `sessionStorage`.
3. Made authenticated existing-user invitees accept the invitation from the
   invitation-link controller and redirect to `/overview`.
4. Changed login handoff to redirect to `/overview` with a pending acceptance
   code instead of returning to the invitation page.
5. Added app-shell pending invitation consumption that accepts the invitation,
   refreshes workspace and service data, and shows the joined-workspace toast.
6. Cleared pending handoff state after consumption to avoid stale retries.
7. Added browser-side email ownership checks before invitation-page acceptance
   and app-shell pending acceptance so a logged-in different account cannot use
   the invitation.
8. Added focused browser unit coverage for refusing pending invitation handoff
   when the authenticated email does not match the invitation email.
9. Blocked authenticated browsers from using unregistered invitations to open
   the invited-account registration path.
10. Added focused browser unit coverage for refusing an unregistered invitation
   while an existing user is authenticated.
11. Corrected the invitation page to require a loaded `/api/me` user before
    applying wrong-account behavior, so stale token state does not block private
    or otherwise unauthenticated invitation use.

## Validation Run

- `npx tsc -p tsconfig.client.json --noEmit`
- `node -r ts-node/register --test --test-name-pattern "invitation handoff" src/tests/unit/browser-auth-services.test.ts`
- `node -r ts-node/register --test --test-name-pattern "unregistered invitation" src/tests/unit/browser-auth-services.test.ts`
- `node -r ts-node/register --test --test-name-pattern "no current user loads" src/tests/unit/browser-auth-services.test.ts`
- `git diff --check`

## Validation Skipped

- `npm run build`
- `npm run lint`
- `npm test`
- Manual browser QA
- Full `src/tests/unit/browser-auth-services.test.ts` validation

These were skipped because `$super-agent` runs only validation expected to
complete within about 10 seconds and skips QA/review by design.
The full browser auth test file also has an unrelated existing workspace
role-editor assertion failure in the dirty worktree.

## QA Skipped

- No QA phase was performed.

## Code Review Skipped

- No code-review phase was performed.

## Documentation Updates

- Added completed-work spec and plan artifacts.
- No API documentation updates were needed because the API contract did not
  change.

## Commit Status

- Not committed.

## Push Status

- Not pushed.

## Residual Risk

- The flow was not manually exercised in a browser.
- Full build, lint, and test suite were not run.
- The full browser auth unit file still has an unrelated existing role-editor
  assertion failure outside this invitation ownership change.
- The working tree already contained unrelated in-progress changes in the same
  invitation and app-controller area; this change was layered on top without
  reverting them.

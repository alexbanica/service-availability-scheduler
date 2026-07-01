# Workspace User Remove Confirmation Plan

Status: Approved

## Spec Reference

- `specs/SPEC-workspace-user-remove-confirmation.md`

## Affected Files

- `AGENTS.md`
- `public/index.html`
- `public/ts/controllers/AppController.ts`
- `specs/SPEC-workspace-user-remove-confirmation.md`
- `specs/PLAN-workspace-user-remove-confirmation.md`

## Implementation Steps Performed

1. Extended the browser pending destructive-action type to include
   `workspace-user`.
2. Added an `openWorkspaceUserRemoveConfirmation` path that validates admin
   access and opens the existing confirmation modal instead of removing the user
   immediately.
3. Updated destructive-action title, submit label, body copy, success toast, and
   refresh behavior so workspace user removal uses remove-specific wording and
   reloads workspace user data after confirmation.
4. Changed the workspace user administration `Remove` button to open the
   confirmation flow.
5. Updated `AGENTS.md` to require explicit approval before user-facing
   delete/remove actions call destructive mutations.
6. Created completed-work `$super-agent` spec and plan artifacts.

## Validation Run

- `git diff --check`

## Validation Skipped

- `npm run build`
- `npm run lint`
- `npm test`
- Browser QA

Skipped because `$super-agent` is lower assurance and limits validation to
commands expected to complete within 10 seconds.

## QA Skipped

Manual QA was skipped by design for `$super-agent`.

## Code Review Skipped

Code review was skipped by design for `$super-agent`.

## Documentation Updates

- `AGENTS.md` now records the delete/remove approval requirement for
  user-facing destructive actions.

## Commit Status

- Not committed.

## Push Status

- Not pushed.

## Residual Risk

- The updated browser flow was not compiled or manually exercised in a browser
  during this lower-assurance run.

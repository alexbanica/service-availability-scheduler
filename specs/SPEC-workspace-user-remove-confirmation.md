# Workspace User Remove Confirmation

Status: Approved

## Purpose

Require explicit browser approval before removing a user from a workspace.

## Requested Behavior

- The workspace user administration `Remove` button must not call the removal
  API immediately.
- Clicking `Remove` opens a confirmation dialog that identifies the target user
  by email, with user ID as a fallback.
- Confirming the dialog removes the user membership.
- Cancelling or closing the dialog leaves the membership unchanged.
- Repository agent guidance documents that user-facing delete/remove actions
  must ask for approval before destructive mutations.

## Scope

- Browser workspace user administration removal flow.
- Shared destructive-action confirmation dialog wording for remove versus
  delete actions.
- Repository guidance in `AGENTS.md`.

## Out Of Scope

- Backend authorization changes.
- API request or response contract changes.
- Workspace role, owner self-removal, or single-admin invariant changes.

## Deterministic Behavior Delivered

- `Remove` opens the destructive-action modal with `Remove user` wording and an
  email-or-user-ID target label.
- The modal text says the user is about to be removed and that the action cannot
  be undone.
- Confirmation remains admin-only and calls the existing
  `WorkspaceService.removeWorkspaceUser` method.
- Successful confirmation reloads workspace users and workspaces, then shows a
  user-removed toast.
- Failed confirmation keeps the dialog open, clears pending state, and shows the
  error in the dialog and workspace-user action area.
- The repository guidance now requires explicit approval before user-facing
  delete and remove actions call destructive mutations.

## Assumptions

- "Approval" means an explicit user confirmation dialog before invoking the
  destructive browser-side mutation.
- Existing server-side authorization and conflict handling remain the source of
  enforcement.

## Impact

- Prevents accidental workspace membership removal from a single button click.
- No API contract changes are introduced because the existing delete endpoint is
  still used after confirmation.

## Validation Performed

- `git diff --check`

## Validation Skipped

- Full build, lint, test, and browser QA were skipped under the lower-assurance
  `$super-agent` workflow and its short-validation limit.

## Documentation Changes

- Updated `AGENTS.md` guidance for user-facing delete/remove approval.

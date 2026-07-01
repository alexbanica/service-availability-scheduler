# Workspace Pending Invitation Removal

Status: Approved

## Purpose

Workspace admins and managers can create pending invitations. They also need a
deterministic way to remove a pending invitation before it is accepted.

## Requested Behavior

- A pending workspace invitation can be removed by a workspace `admin`.
- A pending workspace invitation can also be removed by a workspace `manager`.
- Removing an accepted workspace user membership remains admin-only.
- Pending invitation removal is workspace-scoped and must not remove an
  invitation from a different workspace.
- The browser user-management view shows a remove action for pending invitation
  rows when the selected workspace is managed by the current user.
- User-facing pending invitation removal uses the existing destructive-action
  confirmation flow before the mutation is sent.

## Scope

- Backend workspace service authorization and invitation revocation.
- Workspace controller DELETE endpoint for pending invitation removal.
- Browser API client method for pending invitation removal.
- Browser user-management workspace visibility and pending invitation remove
  action.
- API contract documentation and HTTP request example.
- Focused unit tests for the service-level authorization and workspace scoping.

## Out Of Scope

- Accepted user removal by managers.
- Role mutation by managers.
- Dedicated bulk invitation management.
- Email delivery.
- Generated browser JavaScript bundles.

## Deterministic Behavior Delivered

- `DELETE /api/workspaces/:workspaceId/invitations/:invitationId` revokes a
  pending invitation when the authenticated activated user is a workspace admin
  or manager.
- The endpoint returns `403` when the actor is not a workspace resource
  administrator.
- The endpoint returns `404` when the workspace or pending invitation cannot be
  found in that workspace.
- Pending invitation rows in user management can be removed through the shared
  confirmation dialog.
- Accepted user role changes and accepted user removal still require an admin.

## Assumptions

- Revoking a pending invitation uses the existing `revoked` invitation status
  and `consumed_at` timestamp.
- The existing user-management section is the correct place to manage pending
  invitation rows because invitation rows are already listed there.

## Impact

- Adds one authenticated API endpoint.
- Updates API documentation and HTTP examples.
- Broadens browser access to the user-management section for managers while
  retaining admin-only controls for accepted users.

## Validation Performed

- Focused workspace service unit tests for pending invitation removal.
- `git diff --check`

## Validation Skipped

- `npm run build`, `npm run lint`, and full `npm test` were skipped because
  `$super-agent` limits validation to commands expected to complete within
  about 10 seconds.
- Manual browser QA was skipped by `$super-agent` workflow.
- Code review was skipped by `$super-agent` workflow.

## Documentation Changes

- Updated `swagger.yml`.
- Updated `http/api.http`.
- Added this completed-work spec.

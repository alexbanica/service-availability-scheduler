# Workspace Owner And Environment Deletion

Status: Approved

## Purpose

Allow workspace admins and managers to remove workspace owners and environments
from the workspace detail popup opened from the workspace owner/environment stat
tags.

## Problem

Workspace management currently lets authorized users create owners and
environments and view them from the workspace stat popup, but it does not provide
a deletion workflow for unused or obsolete entries. Deletion must be available
from the popup where those entries are listed, must require confirmation, and
must not delete services that reference the removed owner or environment.

## Scope

- Add owner deletion for a workspace.
- Add environment deletion for a workspace.
- Expose delete actions in the workspace popup rows for `owners` and
  `environments`.
- Allow delete actions only for users whose role in the target workspace is
  `admin` or `manager`.
- Preserve member access to viewing popup rows without delete controls.
- Detach deleted owners and environments from existing services without deleting
  those services.
- Update API contract documentation and request examples for the new delete
  endpoints.

## Out Of Scope

- Bulk deletion.
- Editing or renaming owners or environments.
- Deleting users, services, workspaces, invitations, reservations, or workspace
  memberships through this popup.
- Changing the existing rule that service create and edit require at least one
  environment.
- Automatically deleting services that become ownerless or have no environments.
- Automatically reassigning services to another owner or environment.

## Definitions

- Owner: A workspace-scoped row in `owners`.
- Environment: A workspace-scoped row in `environments`.
- Resource administrator: A user whose role in the target workspace is `admin`
  or `manager`.
- Popup row: One item returned by a workspace detail endpoint and rendered in
  the workspace stat popup.
- Detach: Remove the association between a service and an owner or environment
  while keeping the service row.

## Inputs And Constraints

- Owner deletion input is the target `workspaceId` and `ownerId`.
- Environment deletion input is the target `workspaceId` and `environmentId`.
- The actor must be authenticated and activated.
- The actor must be a resource administrator for the target workspace.
- The target owner or environment must belong to the target workspace.
- Deletion is scoped to the target workspace and must not remove or change rows
  in other workspaces.
- Browser delete controls must be rendered only for popup owner and environment
  rows when the current user is a resource administrator for that workspace.
- Confirmation before deletion is mandatory.
- Confirmation must identify the owner or environment name being deleted.

## Deterministic Behavior

### Popup Rows

- `GET /api/workspaces/:workspaceId/detail/owners` remains available to
  workspace members.
- `GET /api/workspaces/:workspaceId/detail/environments` remains available to
  workspace members.
- Owner popup rows include both display name and stable owner identifier.
- Environment popup rows include both display name and stable environment
  identifier.
- Existing consumers that only read `name` from popup rows continue to work.
- Popup rows remain ordered by display name.

### Authorization

- Workspace admins and managers can delete owners and environments in their
  workspaces.
- Workspace members can view popup owner and environment rows but cannot see or
  invoke delete controls.
- Direct API calls from members, non-members, missing users, or unauthenticated
  users are rejected using the existing authorization error conventions.
- Missing workspaces return `404`.
- Missing owners or environments in an existing authorized workspace return
  `404`.

### Owner Deletion

- Deleting an owner removes that owner row from the target workspace.
- Services in the target workspace that reference the deleted owner remain in
  `services`.
- Those services no longer have an owner attached after deletion.
- Owner deletion does not remove service environment associations,
  reservations, workspace memberships, or users.
- Repeating deletion for an already deleted owner returns `404`.

### Environment Deletion

- Deleting an environment removes that environment row from the target
  workspace.
- Services in the target workspace that reference the deleted environment remain
  in `services`.
- Service-to-environment associations for the deleted environment are removed.
- If a service loses its last environment because of the deletion, the service
  still exists and is visible in service management with no attached
  environments.
- A service with no attached environments is not claimable in the reservation
  availability workflow until a resource administrator edits the service and
  attaches at least one existing environment.
- Environment deletion does not remove owners, reservations, workspace
  memberships, or users.
- Repeating deletion for an already deleted environment returns `404`.

### Browser Workflow

- The workspace stat popup lists owners or environments with the entity name.
- For resource administrators, owner and environment rows include a delete
  button next to the row name.
- Selecting delete opens a confirmation flow before any deletion request is
  sent.
- Cancelling confirmation leaves the owner or environment unchanged.
- Confirming deletion sends the delete request, disables duplicate submission
  while pending, and reports any backend error without closing unrelated
  workspace state.
- After successful deletion:
  - the popup row list refreshes or removes the deleted row;
  - workspace owner/environment counts refresh;
  - service management owner/environment option lists refresh when they are
    loaded for the affected workspace;
  - visible affected services no longer show the deleted owner or deleted
    environment.
- Service delete confirmation behavior remains unchanged.

## Assumptions

- The workspace role model from
  `SPEC-workspace-roles-and-user-administration.md` remains authoritative:
  managers can administer non-user workspace resources and members cannot.
- Service create and service edit keep requiring at least one environment, but
  deletion is allowed to leave an existing service with zero environments.
- The service management surface is the place where ownerless or
  zero-environment services can be corrected after deletion.

## Regression Impact

- Workspace popup row contracts expand for owners and environments by adding
  identifiers, while retaining `name`.
- Service repository queries that currently require environment joins may need
  to preserve service-management visibility for services with no remaining
  environment associations.
- Database delete behavior must avoid foreign-key failures for owner deletion
  and must keep services after environment deletion.
- Existing popup detail, workspace role, service create/edit, and service delete
  behavior must continue to pass.

## Validation Plan

- Unit-test owner deletion authorization for admin, manager, member, non-member,
  missing workspace, and missing owner cases.
- Unit-test environment deletion authorization for admin, manager, member,
  non-member, missing workspace, and missing environment cases.
- Unit-test that owner deletion detaches `services.owner_id` without deleting
  the service.
- Unit-test that environment deletion removes only the deleted environment's
  service associations and keeps affected services.
- Unit-test popup owner/environment rows include stable identifiers while
  preserving `name`.
- Unit-test browser service parsing and popup state for owner/environment delete
  controls and confirmation behavior where practical.
- Integration-test MySQL-backed owner and environment deletion including
  cross-workspace isolation and zero-environment service persistence.
- Run `npm run lint`, `npm run build`, `npm test`, and `git diff --check`.

## Documentation Needs

- Update `swagger.yml` for owner and environment delete endpoints and expanded
  popup row schemas.
- Update `http/api.http` with owner and environment delete examples.

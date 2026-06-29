# Workspace Roles And User Administration

Status: Approved

## Purpose

Add workspace-scoped role-based authorization so workspace admins can delegate
non-user administration to managers while keeping user administration restricted
to the workspace admin.

## Problem Statement

Workspace membership currently distinguishes only `admin` and `member`. The app
needs an additional `manager` role and clearer per-workspace permissions:
members are agents and cannot administer, managers can administer workspace
resources but cannot add or remove users, and admins can do everything inside
their workspaces. Role assignment must remain scoped to each workspace because a
single user can belong to multiple workspaces with different roles.

## Scope

- Keep the existing `member` role name as the agent role.
- Add a workspace-scoped `manager` role.
- Preserve the existing workspace-scoped `admin` role.
- Enforce per-workspace authorization for workspace, service, owner,
  environment, invitation, membership removal, and role-update APIs.
- Add backend API endpoints for admins to update workspace user roles.
- Add backend API endpoints for admins to remove users from administered
  workspaces.
- Update API responses needed by the browser so it can determine each
  workspace's current-user role and render controls consistently with backend
  authorization.
- Update manual API documentation and HTTP examples for changed workspace user
  administration behavior.
- Update repository agent guidance for the new workspace role model and
  authorization expectations.

## Out Of Scope

- Renaming `member` to `agent` in storage, API contracts, or browser copy.
- Allowing more than one admin on a workspace.
- Admin transfer flows.
- Platform-wide role administration beyond the existing `platform_admin`
  behavior.
- Invitation acceptance or email delivery flows beyond the existing invitation
  creation behavior.
- Cross-workspace role inheritance.

## Definitions

- Workspace role: the role stored for one user in one workspace membership.
- Admin: a workspace role that can perform every workspace-scoped action for
  that workspace.
- Manager: a workspace role that can administer non-user workspace resources but
  cannot invite users, remove users, or update roles.
- Member: the existing workspace role that represents an agent. Members can use
  normal service availability and reservation behavior but cannot administer the
  workspace.
- User administration: inviting users to a workspace, removing users from a
  workspace, and updating workspace user roles.
- Resource administration: creating, updating, or deleting workspace services,
  owners, and environments.

## Inputs And Constraints

- Valid workspace roles are exactly `admin`, `manager`, and `member`.
- A user's role is valid only for the workspace membership row where it is
  stored.
- The same user may have different roles in different workspaces.
- A workspace may have only one admin.
- Existing admin memberships remain admin memberships.
- Existing member memberships remain member memberships.
- Creating a workspace continues to create the creator as that workspace's sole
  admin.
- Invited users continue to become members unless a future approved spec changes
  invitation role assignment.
- All protected workspace APIs continue to require an authenticated activated
  user before role authorization is evaluated.
- Role update input must identify the target workspace, target user, and target
  role.

## Deterministic Behavior

### Role Authorization Matrix

- Admins may:
  - list workspaces they belong to;
  - view workspace detail rows;
  - create workspace services;
  - update workspace services;
  - delete workspace services;
  - list and create workspace owners;
  - list and create workspace environments;
  - invite users to the workspace;
  - remove users from the workspace;
  - update workspace user roles.
- Managers may:
  - list workspaces they belong to;
  - view workspace detail rows;
  - create workspace services;
  - update workspace services;
  - delete workspace services;
  - list and create workspace owners;
  - list and create workspace environments.
- Managers must not:
  - invite users to the workspace;
  - remove users from the workspace;
  - update workspace user roles.
- Members may:
  - list workspaces they belong to;
  - view workspace detail rows;
  - use existing service availability and reservation behavior available to
    workspace members.
- Members must not:
  - create, update, or delete workspace services;
  - create owners or environments;
  - invite users;
  - remove users;
  - update roles.

### Workspace Listing And Detail Data

- Workspace listing responses must expose the current user's role for each
  returned workspace.
- Browser authorization state must use the current user's workspace role instead
  of deriving admin capability only from `admin_user_id`.
- Workspace user detail APIs must expose enough user identity and role data for
  admin-only user administration controls.
- Existing popup detail behavior that returns display rows for users, services,
  owners, and environments must remain available to authorized workspace
  members.
- Frontend routes and administration sections must evaluate the current user's
  workspace role before rendering role-protected workflows.
- When a frontend route, section, action, or selected workspace is not valid for
  the current user's role, the browser must show a deterministic "Not
  authorized" state instead of rendering the protected workflow.

### Role Update API

- Only the current admin of the target workspace may update workspace user
  roles.
- The role update API must reject unauthenticated users with `401`.
- The role update API must reject non-activated users with `403`.
- The role update API must reject users who are not the target workspace admin
  with `403`.
- Updating a role in a missing workspace returns `404`.
- Updating a missing target membership returns `404`.
- Supplying a role outside `admin`, `manager`, or `member` returns `400`.
- Assigning `manager` or `member` to an existing target membership succeeds when
  requested by the workspace admin.
- Assigning `admin` to a user who is not already the workspace admin returns
  `409` while the workspace already has an admin.
- Updating the existing workspace admin to `admin` is idempotent and succeeds.
- Demoting the only admin is rejected with `409`; admin transfer is out of
  scope.
- Role changes affect only the target workspace and must not change the user's
  roles in any other workspace.

### Remove User API

- Only the current admin of the target workspace may remove a user from that
  workspace.
- Removing a user deletes only that user's membership in the target workspace.
- Removing a user must not delete the user account.
- Removing a user must not change memberships or roles in other workspaces.
- Removing a missing target membership returns `404`.
- Removing the only admin is rejected with `409`; admin transfer is out of
  scope.
- Removing a non-admin member or manager from the workspace succeeds and makes
  the user unable to access that workspace's protected workspace resources.

### Invitation API

- Existing invitation creation remains admin-only.
- Managers and members receive `403` when attempting to invite users.
- Users added through the existing invitation flow become `member` role users in
  the invited workspace unless a later approved spec adds role selection during
  invitation.

### Resource Administration APIs

- Service create, update, and delete APIs allow workspace admins and managers.
- Owner and environment create APIs allow workspace admins and managers.
- Workspace member-only read/list behavior remains available to admins,
  managers, and members.
- Managers and members cannot use user administration APIs.

### Protected API Endpoint Authorization

- Public page, static, login, registration, password reset, activation,
  `/api/app-info`, `/api/me`, `/api/renew`, and `/api/logout` behavior is not
  changed by workspace roles.
- `GET /api/workspaces` returns workspaces where the current user has a
  membership as `admin`, `manager`, or `member`, and includes the current user's
  role for each workspace.
- `POST /api/workspaces` remains governed by the existing `platform_admin`
  requirement and creates the workspace creator as the workspace `admin`.
- `GET /api/services`, `POST /api/claim`, `POST /api/release`,
  `POST /api/extend`, `GET /events`, and `GET /api/events` remain available to
  workspace members through the existing workspace membership filters. Admins,
  managers, and members can use these endpoints for workspaces they belong to.
- `GET /api/workspaces/:workspaceId/services` is available to admins,
  managers, and members of that workspace.
- `POST /api/workspaces/:workspaceId/services`,
  `PATCH /api/workspaces/:workspaceId/services/:serviceId`, and
  `DELETE /api/workspaces/:workspaceId/services/:serviceId` are available only
  to admins and managers of that workspace.
- `GET /api/workspaces/:workspaceId/owners` and
  `GET /api/workspaces/:workspaceId/environments` are available only to admins
  and managers of that workspace because they support resource administration
  workflows.
- `POST /api/workspaces/:workspaceId/owners` and
  `POST /api/workspaces/:workspaceId/environments` are available only to admins
  and managers of that workspace.
- `GET /api/workspaces/:workspaceId/detail/users`,
  `GET /api/workspaces/:workspaceId/detail/services`,
  `GET /api/workspaces/:workspaceId/detail/owners`, and
  `GET /api/workspaces/:workspaceId/detail/environments` remain available to
  admins, managers, and members of that workspace.
- A user-administration list endpoint, if separate from the popup detail
  endpoint, is available only to admins of that workspace.
- `POST /api/workspaces/:workspaceId/invitations` is available only to admins of
  that workspace.
- `PATCH /api/workspaces/:workspaceId/users/:userId/role` is available only to
  admins of that workspace.
- `DELETE /api/workspaces/:workspaceId/users/:userId` is available only to
  admins of that workspace.
- Any protected endpoint denied by workspace role authorization returns `403`
  after authentication and activation have succeeded.

### Frontend Route And View Authorization

- `/overview` and `/services` remain available to activated users for workspace
  memberships where the user is `admin`, `manager`, or `member`.
- `/administration` remains a valid frontend route only when the activated user
  has at least one workspace where the current user's role is `admin` or
  `manager`.
- The Workspace Management administration section is visible only to admins
  because it contains user administration workflows.
- The Service Management administration section is visible to admins and
  managers.
- User administration views, controls, and modal flows are visible only to
  admins.
- Resource administration views, controls, and modal flows are visible to admins
  and managers.
- Members who navigate directly to `/administration`, or who otherwise select a
  workspace/action that is not authorized for their role, see a "Not authorized"
  state.
- Managers who navigate directly to an admin-only user administration section,
  or who otherwise trigger an admin-only user action, see a "Not authorized"
  state.
- Frontend "Not authorized" states are advisory UX only; backend `403`
  authorization remains the source of enforcement.

## Assumptions

- "Agent" means the existing `member` role.
- "Add / remove users" means inviting users to a workspace and removing users
  from a workspace membership.
- "Admin can do everything in their workspaces" refers to the workspace-scoped
  admin role, not the platform-wide `platform_admin` role.
- The workspace creator remains the initial and sole admin for a newly created
  workspace.
- Role assignment during invitation stays fixed to `member` for this spec.

## Impact And Regression Considerations

- The workspace membership schema must support the new `manager` role for fresh
  installs and migrations.
- Existing authorization helpers that distinguish only admin versus member need
  deterministic capability checks so manager permissions do not accidentally
  grant user administration.
- Browser controls that currently use `admin_user_id` to infer permissions need
  updated role-aware data to prevent hiding manager resource controls or showing
  user administration controls to managers.
- Existing workspace, service, owner, environment, invitation, reservation, and
  popup-detail tests must continue to pass with the expanded role model.
- Manual OpenAPI, HTTP request examples, and repository agent guidance can drift
  if they are not updated with the role-update and removal endpoints.

## Validation Plan

- Unit-test workspace role helpers for `admin`, `manager`, `member`, missing
  workspace, and missing membership cases.
- Unit-test admin-only user administration:
  - admin can invite users;
  - manager and member cannot invite users;
  - admin can remove a manager or member;
  - manager and member cannot remove users;
  - removing the only admin is rejected.
- Unit-test role updates:
  - admin can change a target membership between `manager` and `member`;
  - admin cannot assign a second admin;
  - admin cannot demote the only admin;
  - manager and member cannot update roles;
  - invalid roles return validation errors;
  - role updates affect only the target workspace.
- Unit-test resource administration:
  - admins and managers can create/update/delete services;
  - admins and managers can create owners and environments;
  - members cannot perform resource administration.
- Unit-test workspace listing exposes the current user's per-workspace role.
- Unit-test browser role gating so manager resource controls are available while
  user administration controls remain admin-only.
- Integration-test schema and migration behavior for `manager` in
  `workspace_users`.
- Update and validate manual API artifacts and repository guidance for the new
  role-update and remove-user endpoints.
- Run repository validation: `npm run lint`, `npm run build`, `npm test`, and
  `git diff --check`.

## Documentation Requirements

- Update `swagger.yml` with workspace role values, current-user role fields,
  role-update endpoint behavior, and remove-user endpoint behavior.
- Update `http/api.http` with examples for role update and workspace user
  removal.
- Update `AGENTS.md` with workspace role model and authorization guidance.

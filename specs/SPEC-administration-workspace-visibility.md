Status: Approved

# Administration Workspace Visibility

## Purpose

All authenticated users must be able to open the Administration view and inspect
their workspace memberships, including workspaces they created and workspaces
where they were invited.

## Requested Behavior

- The Administration navigation is visible to authenticated users.
- The overview workspace card lists all current-user workspaces instead of only
  workspaces where the current user has an administration role.
- Workspace management lists all current-user workspaces.
- Service Management can select any current-user workspace for read-only service
  catalog review.
- Mutating workspace resource actions remain gated by the workspace-scoped role
  required by existing endpoints:
  - `admin` and `manager` can manage non-user workspace resources where that
    role applies.
  - `member` can inspect workspace details but cannot mutate resources.
- User Management remains limited to workspaces where the current user is
  `admin`.

## Scope

- Browser Administration navigation and workspace filtering.
- Browser workspace/service/user management section access.
- Focused browser-controller tests for role-dependent visibility.

## Out Of Scope

- Database role model changes.
- Changing the server-side manager-or-admin authorization model for resource
  administration endpoints.
- Changing workspace invitation acceptance, membership persistence, or account
  activation behavior.

## Deterministic Behavior Delivered

- Authenticated users can navigate to `/administration` from the app header.
- Workspace Management renders every workspace returned by `/api/workspaces`.
- Workspace action buttons render only for workspaces where the current user role
  is `admin` or `manager`.
- Service Management renders all current-user workspaces in its selector and
  shows mutation controls only for selected workspaces where the current user is
  `admin` or `manager`.
- User Management is only available for workspaces where the current user is
  `admin`; stale member or manager selections are replaced with the first admin
  workspace before loading users.

## Assumptions

- `current_user_role` from `/api/workspaces` remains the source of browser role
  decisions for each workspace.
- The existing backend endpoint authorization remains authoritative.

## Impact

Members and managers can now see the Administration page and inspect their
workspace memberships without receiving a top-level Not authorized panel.

## Validation Performed

- `git diff --check`

## Validation Skipped

- Full lint, build, and test suites were skipped because `$super-agent` limits
  validation to short commands.
- Manual browser QA was skipped.

## Documentation Changes

- Added this completed-work spec.

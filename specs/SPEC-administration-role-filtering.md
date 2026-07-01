# Administration Role Filtering

Status: Approved

## Purpose

Administration visibility and workspace selection must reflect the current
user's role in each workspace. A user can be an `admin` of workspaces they
created while also being a `manager` or `member` in other invited workspaces.
Member-only invited workspaces must not appear in administration controls.

## Requested Behavior

- Show the top-level Administration entry only when the current user has at
  least one workspace where their role is `admin` or `manager`.
- Keep Administration available for a user who administers at least one
  workspace, even when the same user is only `member` in other workspaces.
- Filter Workspace management and Service Management workspace choices to
  workspaces where the current user is `admin` or `manager`.
- Filter User management workspace choices to workspaces where the current user
  is `admin`.
- Do not load or expose User management rows for workspaces where the current
  user is only `manager` or `member`.
- Replace a stale selected User management workspace with the first available
  admin workspace before loading users.

## Scope

- Browser-side administration navigation and workspace selector filtering.
- Focused browser-controller tests for manager-only and mixed-role users.
- No backend authorization changes were required because the workspace API
  already returns membership-scoped `current_user_role` values.

## Out Of Scope

- Changing backend workspace role semantics.
- Changing workspace creation, invitation, or membership persistence.
- Changing API request or response contracts.
- Changing service availability member workflows.

## Definitions

- Resource administrator: a workspace role of `admin` or `manager`.
- User administrator: a workspace role of `admin`.
- Member workspace: a workspace where the current user's role is `member`.

## Assumptions

- Server-side authorization remains authoritative.
- Browser gating is an advisory UX layer that must still avoid showing or
  loading controls the user cannot operate.
- Existing dirty worktree changes for invitations and user removal confirmation
  are unrelated and were preserved.

## Deterministic Behavior Delivered

- `canAccessAdministration` remains true when `resourceAdminWorkspaces` has at
  least one item.
- `resourceAdminWorkspaces` continues to include only `admin` and `manager`
  workspaces, excluding member-only invited workspaces.
- The User management tab is shown only when `adminWorkspaces` is non-empty.
- The User management workspace selector iterates over `adminWorkspaces`.
- `loadWorkspaceUsers` now rejects non-admin selected workspaces with
  `Not authorized`.
- Switching to User management validates the current selected workspace and
  falls back to the first admin workspace when the current selection is stale or
  member-only.

## Impact

- Users who are only members of invited workspaces no longer see User
  management, Service Management, or Workspace management controls for those
  member workspaces.
- Users who are admin or manager in at least one workspace still see the
  Administration entry.
- Managers retain resource-administration access but not User management access.

## Validation Performed

- `node -r ts-node/register --test src/tests/unit/browser-auth-services.test.ts`
- `node -r ts-node/register --test src/tests/unit/app-controller-renewal-scheduling.test.ts`
- `npx tsc -p tsconfig.client.json --outDir /tmp/sas-app-controller-renewal-tests --module commonjs`
- `git diff --check`

## Validation Skipped

- `npm run lint`, `npm run build`, and full `npm test` were skipped because
  `$super-agent` limits validation to commands expected to complete within about
  10 seconds.

## Documentation Changes

- Added this completed-work spec.

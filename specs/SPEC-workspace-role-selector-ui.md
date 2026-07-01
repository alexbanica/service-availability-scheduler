# Workspace Role Selector UI

Status: Approved

## Purpose

The workspace user-management role selector did not match the current UI/UX
design language. The delivered change replaces the native dropdown with a
compact segmented control that fits the existing administration action layout.

## Requested Behavior

- Workspace user role editing remains available only where the existing
  user-management rules allow editing.
- Editable role targets remain `manager` and `member`; the browser must not
  offer `admin` promotion.
- The current role is visually selected.
- Disabled and pending states continue to prevent role changes while protected
  actions are unavailable or a role update is in progress.
- Clicking the already-selected role performs no mutation.

## Scope

- Updated the workspace user-management role selector UI in `public/index.html`.
- Added selector styling in `public/styles.css`.
- Added a no-op guard in `public/ts/controllers/AppController.ts`.

## Out Of Scope

- Backend role semantics.
- Workspace authorization rules.
- API contract changes.
- Invitation behavior.

## Assumptions

- The current UX direction favors explicit compact controls over native
  dropdowns for small fixed option sets.
- Since the available role set has only two editable values, a segmented control
  is deterministic and avoids hidden options.

## Deterministic Behavior Delivered

- Editable user rows show `Manager` and `Member` buttons as a two-option role
  selector.
- The button matching `workspaceUser.role` is active and exposes
  `aria-pressed`.
- Selecting another role calls the existing role-update function with the same
  `WorkspaceRole` value previously submitted by the dropdown.
- Selecting the current role returns before setting pending state or calling the
  API.

## Impact

- UI-only behavior change for workspace user-management role editing.
- No API, persistence, schema, or Swagger contract changes were required.

## Validation Performed

- `git diff --check`

## Validation Skipped

- `npm run build`, `npm run lint`, and `npm test` were skipped because
  `$super-agent` limits validation to commands expected to complete within
  about 10 seconds.

## Documentation Changes

- Added this completed-work spec.

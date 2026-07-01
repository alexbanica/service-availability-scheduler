# Service Management Remove Resource Create Buttons

Status: Approved

## Purpose

Remove owner and environment creation actions from the Service Management header.

## Requested Behavior

Service Management should not show `Create owner` or `Create environment`
buttons. Owner and environment creation remains available from Workspace
management.

## Scope

- Remove the Service Management header `Create owner` button.
- Remove the Service Management header `Create environment` button.
- Preserve the Service Management `Create service` button.
- Preserve existing Workspace management owner and environment creation.

## Out Of Scope

- Changing owner or environment APIs.
- Changing service creation or editing behavior.
- Changing workspace management controls.
- Changing service-management owner/environment selection.

## Deterministic Behavior Delivered

- Users in Service Management see `Create service` when allowed by existing role
  gating.
- Users in Service Management do not see `Create owner`.
- Users in Service Management do not see `Create environment`.
- Workspace management remains the place for creating owners and environments.

## Assumptions

- Existing role checks and modal implementations remain valid for Workspace
  management.
- This is a UI-only cleanup and does not change API contracts.

## Impact

- No backend behavior changes.
- No API contract changes.
- No database changes.

## Validation Performed

- `npx tsc -p tsconfig.client.json --noEmit`
- `git diff --check`

## Validation Skipped

- Full build and full test suite were skipped because `$super-agent` limits
  validation to short checks.

## Documentation Changes

- Added this completed-work spec.

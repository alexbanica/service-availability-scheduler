# Service Management Compact List Cards

Status: Approved

## Purpose

Make Service Management service cards compact while browsing the service list.

## Requested Behavior

Service cards in Service Management should be at most one line when users are
just listing services. Cards may expand to show service details while the
service is being edited.

## Scope

- Compact non-editing Service Management service rows.
- Hide owner, default minutes, and environment tags until the matching service
  row is in edit mode.
- Preserve existing Edit and Delete actions for non-editing rows.
- Preserve existing edit form behavior and fields.

## Out Of Scope

- Backend service APIs.
- Service creation behavior.
- Service edit submission behavior.
- Workspace, owner, or environment management behavior.
- API contract documentation, because no API behavior changed.

## Deterministic Behavior Delivered

- Non-editing service rows show the service label and existing row actions only.
- The non-editing service label is constrained to one visual line with overflow
  truncation when necessary.
- Opening Edit expands that service row and shows owner, default minutes,
  environments, and the existing edit form controls.
- Edit mode allows long labels and details to wrap as before.

## Assumptions

- "Max one liner" applies to the collapsed listing state, not the editing state.
- Edit and Delete controls remain part of the collapsed row.

## Impact

- UI-only change.
- No backend behavior changes.
- No API contract changes.
- No database changes.

## Validation Performed

- `git diff --check`

## Validation Skipped

- `npm run lint`
- `npm run build`
- `npm test`
- Browser/manual QA

These were skipped because `$super-agent` limits validation to short checks.

## Documentation Changes

- Added this completed-work spec.

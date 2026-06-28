# SPEC: Service Edit Card Actions

Status: Approved

## Purpose

Make the Service Management edit card easier to use by removing duplicate edit/cancel actions and preventing edit fields from colliding in the card layout.

## Problem Statement

When editing a service, the card displayed four actions across two locations: `Cancel edit`, `Delete`, `Cancel`, and `Save service`. The edit fields could also crowd each other inside the card, making the form hard to read.

## Scope

- Service Management service cards in `public/index.html`.
- Service Management edit-card layout rules in `public/styles.css`.
- Completed-work super-agent artifacts for this delivered change.

## Out Of Scope

- Backend service create, update, delete, validation, authorization, or persistence behavior.
- Delete confirmation modal behavior.
- Create-service modal behavior.
- Service Availability reservation cards.

## Inputs And Constraints

- The UI is rendered through Vue bindings in `public/index.html`.
- Existing edit, save, cancel, and delete controller methods remain the source of behavior.
- Delete must continue to use the existing confirmation flow before removing a service.
- The change must stay frontend-only and avoid generated `public/js` bundle updates.

## Deterministic Behavior Delivered

- A service card that is not being edited shows the existing `Edit` action and a red `Delete` action for workspace admins.
- A service card being edited hides the top action row, including the previous `Cancel edit` control.
- A service card being edited shows exactly three bottom actions in the edit form:
  - `Cancel`
  - `Save Service`
  - red `Delete`
- `Cancel` discards unsaved edit form state through the existing `cancelEditService` path.
- `Save Service` submits the existing edit form through the existing `editService` path.
- red `Delete` opens the existing delete confirmation flow for the edited service.
- Edit-form labels, inputs, selects, tag inputs, and action buttons wrap within the card instead of forcing overlap.

## Assumptions

- The requested "service text boxes collide" refers to the Service Management edit form fields and tag input layout inside service cards.
- The requested three buttons are intended only for the edit state bottom action row.
- Keeping a red `Delete` action visible for non-editing service cards is acceptable because delete remains an admin action and still prompts for confirmation.

## Impact And Regression Considerations

- The change is template and CSS only; no API contracts, DTOs, persistence, or authorization paths are changed.
- Delete confirmation remains unchanged, so accidental destructive action protection is preserved.
- The save button label changes from `Save service` to `Save Service`; controller behavior and form submission semantics are unchanged.
- The form layout uses existing responsive CSS patterns and may still need browser verification for exact visual fit.

## Validation Performed

- Targeted source diff inspection confirmed the edit-mode action row contains only `Cancel`, `Save Service`, and red `Delete`.
- Targeted source diff inspection confirmed the top action row is hidden while a service is being edited.
- `git diff --check` was run after the edit.

## Validation Skipped

- `npm run lint`, `npm run build`, and `npm test` were skipped because the super-agent workflow permits only short validation expected to complete within 10 seconds.
- Browser/manual QA was skipped by design in the super-agent workflow.

## Documentation Changes

- Added this completed-work spec.
- Added `specs/PLAN-service-edit-card-actions.md`.

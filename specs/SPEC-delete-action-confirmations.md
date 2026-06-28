# SPEC: Delete Action Confirmations

Status: Approved

## Purpose

Require an explicit user confirmation step before any user-triggered delete action performs a destructive backend operation.

## Problem Statement

Current admin delete controls can invoke destructive deletion immediately after the user presses `Delete`. Destructive actions should give the user a deterministic chance to cancel before data is removed.

## Scope

- Add confirmation behavior for all user-visible delete actions that permanently delete persisted application data.
- Cover the current Service Management `Delete` service action.
- Apply the same confirmation rule to future user-visible delete controls added to the app.
- Preserve existing authorization, backend delete endpoints, success behavior, refresh behavior, and error reporting after the user confirms.

## Out Of Scope

- Adding new delete capabilities.
- Changing backend deletion semantics, cascade behavior, authorization, validation, or persistence contracts.
- Requiring confirmation for non-destructive form editing controls such as removing an unsaved environment tag from a create or edit form.
- Requiring confirmation for local UI cleanup, local storage cleanup, filter reset, modal close, or cancel actions.
- Replacing unrelated prompts such as reservation-expiry extension prompts.

## Definitions

- `Delete action`: A user-visible control labeled or behaving as `Delete` that invokes a destructive backend operation to remove persisted data.
- `Confirmation prompt`: A blocking confirmation step shown after the user initiates a delete action and before the delete API call is made.
- `Confirmed delete`: A delete action where the user explicitly accepts the confirmation prompt.
- `Canceled delete`: A delete action where the user dismisses or rejects the confirmation prompt.

## Inputs And Constraints

- The current frontend uses Vue from `public/index.html` with state and behavior in `public/ts/controllers/AppController.ts`.
- Current service deletion is initiated by the Service Management service-row `Delete` button and executed through `WorkspaceService.deleteService`.
- Confirmation behavior must remain deterministic and testable.
- The confirmation prompt must not bypass existing workspace-admin authorization checks.
- The UI must remain keyboard reachable and must not create overlapping text or mobile horizontal overflow.

## Deterministic Behavior

### General Delete Confirmation Rule

- Pressing any user-visible delete action opens a confirmation prompt before any destructive backend delete request is sent.
- The confirmation prompt identifies the action as destructive.
- The confirmation prompt identifies the target being deleted when the target label or identifier is available in the UI state.
- The confirmation prompt provides explicit confirm and cancel choices.
- Canceling or closing the confirmation prompt sends no delete request, leaves persisted data unchanged, and does not show a delete-success toast.
- Confirming the prompt continues with the existing delete flow for that action.
- While a confirmed delete request is in progress, the delete confirmation submit control is disabled or otherwise protected against duplicate submission.
- If the confirmed delete succeeds, existing success, refresh, and local edit-state cleanup behavior remains unchanged.
- If the confirmed delete fails, the existing backend or frontend error message remains visible through the current toast or row-level error behavior.

### Service Management Delete

- Pressing `Delete` on a selected-workspace service opens a confirmation prompt before `WorkspaceService.deleteService` is called.
- The prompt identifies the service by service label when available; otherwise it identifies the service by stable `service_id`.
- Canceling the prompt does not call `DELETE /api/workspaces/:workspaceId/services/:serviceId`.
- Confirming the prompt calls the existing service delete flow for the selected workspace and selected service.
- Existing behavior after a successful service delete is preserved:
  - reset the edit form if the deleted service is currently being edited
  - show `Service deleted.`
  - refresh the selected workspace service list, known environments, and known owners
- Existing behavior after a failed service delete is preserved:
  - show the backend or frontend error message through the existing toast behavior

## Assumptions

- The current request applies to destructive persisted deletes, not to non-destructive `Remove` controls in unsaved forms.
- A browser-native confirmation dialog is acceptable only if implementation constraints make the existing modal pattern disproportionately expensive; the preferred UI is an in-page confirmation modal consistent with existing admin modal behavior.
- Future delete actions should follow this spec unless a later approved spec defines a stricter confirmation flow.

## Impact And Regression Considerations

- Adding confirmation must not change service deletion authorization or backend semantics.
- Delete confirmation must not interfere with create-service, edit-service, environment tag removal, workspace stat popups, or reservation claim/release flows.
- The implementation must preserve unrelated dirty worktree changes in existing admin UI files.
- If an in-page modal is used, modal state must not conflict with existing create workspace, invite user, create owner, create environment, create service, edit service, or workspace-row detail modal state.

## Validation Plan

- Add or update deterministic frontend-facing tests only if the repository has an existing practical frontend test pattern.
- Add or update service deletion unit tests only if confirmation behavior is implemented in testable application logic outside browser-only UI handlers.
- Run `npm run build`.
- Run `npm test`.
- Run `git diff --check`.
- Manual QA must verify:
  - pressing Service Management `Delete` opens confirmation before the delete API call
  - canceling the confirmation does not delete the service and does not show `Service deleted.`
  - confirming the confirmation deletes the service through the existing flow
  - failed confirmed deletion still shows the existing error behavior
  - the confirmation UI is keyboard reachable and usable at common mobile and desktop widths

## Documentation Requirements

- Update `README.md` only if admin workflow documentation explicitly describes delete behavior.
- Do not add unrelated documentation churn.

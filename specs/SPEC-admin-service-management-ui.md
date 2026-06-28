# SPEC: Administration Service Management UI

Status: Approved

## Purpose

Redesign the Administration `Service Management` page so an admin can select one workspace and then list, create, and edit that workspace's services from a focused, reliable management surface.

## Iteration: Create Service Modal And Environment Duplicate Commit Fix

This iteration changes service creation from an always-visible in-page creation block into a modal flow that matches the Workspace management `Create workspace` interaction pattern, raises the selected workspace scope control in the Service Management hierarchy, and fixes duplicate environment commit behavior.

Added behavior:

- Service Management provides a `Create service` button in the same page-header/action placement used by Workspace management for `Create workspace`.
- Pressing `Create service` opens a modal dialog above the page for the currently selected workspace.
- The service creation modal collects new-service details only:
  - service label
  - default minutes
  - owner
  - environments
- The service creation modal does not allow selecting an existing service as the create target, because existing services are edited through their row-level edit action.
- The selected workspace scope control is presented one level higher in the Service Management content hierarchy, before and separate from the selected-workspace service list and create-service modal trigger.
- If a user types an environment that is already selected in the current create or edit form, committing by Enter, comma, Space, blur, or submit clears the input, preserves the existing selected environment tag, and does not add a duplicate tag.

Changed behavior:

- The create-service form is no longer displayed as a persistent in-page block below the selected workspace scope control.
- The service label field in the create-service flow must not provide existing services as selectable create targets.
- Duplicate environment commits are treated as successful no-op tag commits with input cleanup, not as uncommitted text that remains in the environment input.

Preserved behavior:

- Service creation validation, authorization, backend endpoint, success toast, selected-workspace refresh, known environment refresh, and known owner refresh behavior remain unchanged.
- Existing service editing remains row-scoped and continues to use stable `service_id`.
- Existing environment suggestions remain available for environment selection.
- Existing non-admin, empty, error, submitting, light theme, dark theme, and responsive behavior remains available.

## Iteration: Admin Surface UX Polish

This iteration improves the visual hierarchy, scanability, responsive behavior, and interaction quality of the already-approved Service Management interface without changing backend service contracts, service edit semantics, or authorization behavior.

Added behavior:

- Service Management uses a professional data-dense admin-dashboard layout with compact controls, clear workspace scoping, and a scannable selected-workspace service list.
- The workspace selector is visually presented as the scope control for the entire Service Management surface.
- The create-service form is visually distinct from the service list and reads as the selected workspace's create surface, not as another service row.
- Service rows/cards present identity, metadata, environment associations, and actions in stable regions.
- Edit state is visually attached to the service being edited and does not make neighboring service rows difficult to scan.
- Empty, non-admin, error, and submitting states are visually aligned with the rest of the admin surface.
- Hover and focus states are visible and stable, with no layout shift.
- The layout respects reduced-motion preferences for decorative transitions.

Changed behavior:

- Service Management styling should move away from broad nested cards, inconsistent control prominence, and dense ungrouped form fields that make the selected workspace workflow hard to scan.
- Long service labels, owner names, environment names, and action controls wrap safely without overlapping or forcing horizontal page scroll.

Preserved behavior:

- Existing selected-workspace behavior, create/edit/delete semantics, environment selection behavior, authorization, validation messages, toasts, and API contracts remain unchanged.
- Existing light and dark theme support remains available.

## Iteration: Create Service Owner Field UX Consistency

This iteration fixes the create-service modal owner field so it follows the same visual and interaction quality as the environments field instead of using a mismatched native dropdown.

Added behavior:

- The create-service modal owner field is presented with the same compact input treatment used by the create-service environments field.
- Existing selected-workspace owners are offered as suggestions while still allowing the admin to leave the owner unset.
- Selecting or typing an owner clears transient suggestion/input text after the owner value is committed, so unrelated option text does not remain visible in the field.
- The selected owner is displayed as the committed create-service owner value until removed, changed, canceled, or submitted.

Changed behavior:

- The create-service owner field must not use a visibly mismatched native select control when the environments field uses the tag-input/suggestion interaction.
- Owner suggestion text must not remain visible after the user selects or commits an owner.

Preserved behavior:

- A create-service owner remains optional; an empty owner persists as `null`.
- Existing known owner refresh behavior remains unchanged after successful service creation.
- Backend create-service contracts and authorization behavior remain unchanged.
- Existing edit-service owner behavior is unchanged unless the implementation plan explicitly scopes the same visual control to edit for consistency.

## Problem Statement

The current Service Management page renders service controls inside every workspace row. This makes the page harder to scan, spreads create controls across the page, and makes the workflow depend on expanding the right workspace before the user can manage services. The current environment tag input is also unreliable: committing environment text can lose the tag that was just entered, so service creation can fail with `Add at least one environment.` even after the user typed an environment. The create-service owner field also uses a mismatched native dropdown instead of the environment field's compact suggestion UX, and transient option/input text can remain visible after the user selects or enters a value.

## Scope

- Update the Administration `Service Management` content area.
- Require a specific workspace selection before service management controls are shown.
- List services only for the selected workspace.
- Allow workspace admins to create services in the selected workspace.
- Open a focused modal popup when `Create service` is pressed.
- Allow workspace admins to edit existing services in the selected workspace.
- Fix environment entry so typed environments are preserved deterministically.
- Fix duplicate environment entry so committing an already-selected environment clears the input without adding a duplicate or removing the existing tag.
- Fix the create-service owner field so it matches the environments field's create-modal UX and clears transient suggestion/input text after owner selection or entry.
- Preserve existing service deletion capability for workspace admins.
- Preserve current authorization behavior:
  - workspace members may view services for workspaces they belong to
  - only workspace admins may create, edit, or delete services
- Keep the UI responsive, accessible, and consistent with the existing application style.

## Out Of Scope

- Reservation claim, extend, or release behavior.
- Workspace creation, invitation, or user management behavior.
- Bulk service edits.
- Cross-workspace service editing in a single form submission.
- New role or permission models.
- Import/export of services.
- Email or notification behavior.
- Replacing the full Administration navigation model.
- Changing service management backend API contracts, authorization, validation, persistence behavior, or environment association semantics.
- Adding a new design system dependency or icon library.
- Replacing the full application shell, primary navigation, or theme model.

## Definitions

- `Service Management`: The Administration subsection selected by the left-side `Service Management` tab.
- `Selected workspace`: The workspace chosen by the user from a workspace selector inside Service Management.
- `Service`: A row in `services`, identified by its stable `service_id`, with label, owner, default reservation minutes, and zero or more environment associations.
- `Environment`: A row in `environments` belonging to the selected workspace.
- `Service environment association`: A row in `service_environments` connecting one service to one environment and creating a service key.
- `Create service`: Creating a new service when the entered service label does not match an existing selected-workspace service, then associating it with one or more environments.
- `Edit service`: Updating an existing selected-workspace service's editable fields and environment associations.
- `Create service modal`: An in-page modal dialog opened from the Service Management page-level `Create service` action, not a browser `prompt`.
- `Committed owner value`: The owner selected or typed for the create-service form and submitted as the optional service owner, distinct from transient input or suggestion text.

## Inputs And Constraints

- The current frontend uses Vue from `public/index.html` with state and behavior in `public/ts/controllers/AppController.ts`.
- The current Service Management UI already has workspace service catalog, environment, owner, create, and delete flows.
- Workspace Management already uses a page-level `Create workspace` button that opens a modal; Service Management service creation must follow that interaction pattern.
- The current backend exposes:
  - `GET /api/workspaces/:workspaceId/services`
  - `POST /api/workspaces/:workspaceId/services`
  - `DELETE /api/workspaces/:workspaceId/services/:serviceId`
  - `GET /api/workspaces/:workspaceId/environments`
  - `GET /api/workspaces/:workspaceId/owners`
- Editing requires a deterministic backend update contract; current delete and create behavior must remain backward compatible.
- Backend domain and service code must preserve onion architecture dependency direction.
- The page must support light and dark themes.
- Form inputs must have explicit labels.
- Errors must be visible near the form or row they apply to.
- The UI design should follow a data-dense admin-dashboard pattern: compact workspace selector, scannable service list, focused forms, restrained colors, stable hover/focus states, and no wide mobile-breaking table.
- Create-service owner selection must use existing frontend state and selected-workspace owner data; it must not introduce a new backend endpoint or persistence model.

## Deterministic Behavior

### Workspace Selection

- When a signed-in user opens Administration and selects `Service Management`, the right-hand admin content shows a workspace selector as the first control.
- The workspace selector is styled and positioned as the page-level scope control above the selected-workspace service list and above the `Create service` modal trigger, with a clear label and compact supporting context for the selected workspace.
- The selected-workspace service list and create-service action are visually subordinate to the selected workspace scope control.
- The selector includes all workspaces returned by the existing workspace listing flow.
- If a workspace is already selected and remains available after refresh, the selection is preserved.
- If no workspace is selected, the first available workspace is selected by default.
- If the user is not a member of any workspace, the page shows the existing no-workspaces empty state and no service controls.
- Changing the selected workspace reloads that workspace's:
  - service catalog
  - known environments
  - known owners
  - create/edit form state
  - row-level errors

### Selected Workspace Service List

- The page lists only services for the selected workspace.
- The selected-workspace service list is the primary content below the create surface.
- Each service item shows:
  - service label
  - owner or `Unowned`
  - default reservation minutes
  - associated environments
  - edit action for workspace admins
  - delete action for workspace admins
- Each service item separates identity, metadata, environment associations, and actions so users can scan service names first, operational details second, actions third.
- Environment associations are displayed as wrapped compact labels or equivalent readable grouped text, not as an overflowing comma string.
- Edit and delete actions keep consistent placement across service items.
- Service items are ordered by the existing backend service catalog order unless the implementation already sorts client-side; if sorting is added, it must be alphabetical by service label.
- If the selected workspace has no services, the page shows a selected-workspace empty state.
- Non-admin workspace members may view the selected workspace service list but see an explicit message that admin access is required to create, edit, or delete services.

### Create Service

- Workspace admins can open a single create modal for the selected workspace by pressing `Create service`.
- The `Create service` button is placed in the Service Management header or action area equivalent to the Workspace management `Create workspace` button placement.
- Pressing `Create service` opens a modal dialog above the page.
- The create modal title identifies the action and selected workspace.
- The create modal contains:
  - service label
  - default minutes
  - owner
  - environments
- The service label field is a new-service label entry field and must not expose existing selected-workspace services as selectable options.
- Existing services are edited only through row-level edit actions, not through the create modal.
- Form fields use consistent label placement, input sizing, spacing, and disabled states.
- The owner field uses a compact suggestion input consistent with the environments field rather than a mismatched native dropdown.
- The owner field allows an unset owner and clearly displays the committed owner value when one is selected or typed.
- Selecting an existing owner suggestion commits that owner and clears transient input text.
- Typing an owner name and committing it by Enter, blur, or form submit commits the typed owner value and clears transient input text.
- Clearing the committed owner returns the owner value to unset and submits `null` if the service is created without a replacement owner.
- The service creation form must not remain as a persistent in-page card, block, or column when the modal is closed.
- Submitting with a blank service label prevents the API call and shows `Service name is required.`
- Submitting without at least one environment prevents the API call and shows `Add at least one environment.`
- Submitting a new service with nonpositive default minutes prevents the API call and shows `Default minutes must be positive.`
- Pressing Enter in create modal text inputs submits the create modal form unless the focused environment input is committing a tag.
- On successful create:
  - the create modal closes
  - the create form resets
  - create modal error and submitting state reset
  - the selected workspace service list refreshes
  - known environments and owners refresh
  - the existing success toast `Service created.` is shown
- On failed create:
  - the create modal remains open
  - the backend error message is shown near the create form
- Closing or canceling the create modal resets service label, default minutes, owner, environment input, environment tags, error, and submitting state.

### Environment Entry

- Typed environment text is preserved when the user commits it by comma, Enter, Space, blur, or form submit.
- Environment input accepts one or more environment names separated by comma or whitespace.
- Duplicate environment names are ignored case-insensitively within the current form.
- If committed environment text matches an environment tag already selected in the current form, the visible selected tag remains, no duplicate tag is added, and the environment input is cleared.
- Existing selected-workspace environments are offered as suggestions.
- Removing an environment tag removes only that tag from the current form.
- Committing environment input must not overwrite or discard the current environment tag list with stale form state.
- Form submission must include all visible environment tags.

### Edit Service

- Workspace admins can edit one service at a time in the selected workspace.
- The edit form appears visually attached to the service row being edited and clearly identifies that row as the active edit target.
- Opening edit for a service loads the current service values into an edit form:
  - service label
  - default minutes
  - owner
  - associated environments
- The edit form must identify the service being edited by stable `service_id`, not by the displayed label.
- Submitting an edit with a blank service label prevents the API call and shows `Service name is required.`
- Submitting an edit without at least one environment prevents the API call and shows `Add at least one environment.`
- Submitting an edit with nonpositive default minutes prevents the API call and shows `Default minutes must be positive.`
- On successful edit:
  - the edit form closes
  - the selected workspace service list refreshes
  - known environments and owners refresh
  - a success toast `Service updated.` is shown
- On failed edit:
  - the edit form remains open
  - the backend error message is shown near the edit form
- Canceling edit discards unsaved edit-form state and leaves persisted service data unchanged.

### Edit Persistence Semantics

- Editing service label updates the existing service row rather than creating a replacement service.
- Editing default minutes updates the existing service row.
- Editing owner updates the existing service row; a blank owner persists as `null`.
- Editing environments replaces the service's associated environment set with the submitted set for the selected workspace.
- Existing environment rows are reused when a submitted environment name already exists in the selected workspace.
- Missing environment rows are created for new submitted environment names.
- Removed environment associations are deleted for the edited service.
- The service's stable `service_id` remains unchanged after edit.
- Existing reservations for removed service-environment associations are out of scope unless the current schema constraints require a deterministic cleanup. If constraints require cleanup, implementation must preserve database integrity and document the cleanup behavior in the implementation plan before approval.

### Delete Service

- Existing delete behavior remains available to workspace admins in the selected workspace.
- Successful delete refreshes the selected workspace service list, known environments, and known owners.
- Failed delete displays the backend error through the existing toast or a row-level error.

### Accessibility And Responsive Behavior

- The workspace selector has an associated label.
- Create and edit forms have explicit labels for all inputs.
- The create service modal uses `role="dialog"` and `aria-modal="true"`.
- Modal close and cancel controls are keyboard reachable.
- Error regions use visible text and are suitable for assistive technology announcement.
- The service list uses responsive cards or rows instead of a wide table that can overflow mobile widths.
- Clickable controls have visible hover and focus states.
- Disabled buttons have visible disabled styling.
- Hover and focus styling must not move controls or resize rows.
- Decorative transitions must be disabled or effectively removed under `prefers-reduced-motion: reduce`.
- Service row content must wrap long service labels, owner labels, environment labels, and action labels without text overlap.
- At mobile widths, selected workspace context, create form, service identity, metadata, environments, and actions stack in a readable order.
- At desktop widths, service rows may use multiple columns, but controls must remain aligned and readable.
- Text must not overlap or overflow its container at common mobile and desktop widths.

## Assumptions

- `Edit service` means editing label, default minutes, owner, and environment associations for an existing service.
- A service must have at least one associated environment after create or edit.
- Editing environments should replace the full environment association set for that service, not append only.
- It is acceptable to add a new API route for updating service metadata and environment associations.
- Existing reservations tied to a removed service-environment association are not a user-requested workflow and should only be changed if required for database integrity.
- The existing visual baseline should be improved, not replaced with a new branded design system.
- UX polish should use the existing CSS/theme-token stack and should not add external fonts, CSS frameworks, or icon dependencies.
- `Create service` always means creating a new service and must not double as an edit-existing-service selector.

## Impact And Regression Considerations

- Service creation currently depends on frontend tag state; fixing environment entry must not break keyboard entry or datalist suggestions.
- Moving service creation into a modal must not change workspace authorization, backend validation, create payload semantics, success toast behavior, or selected-workspace refresh behavior.
- Removing existing-service suggestions from the create service label field must not affect row-level edit behavior.
- Duplicate environment commit cleanup must not remove existing visible tags.
- Adding service edit behavior affects backend service repository logic and must preserve workspace authorization checks.
- Replacing environment associations can affect service availability listings because service keys are per service-environment association.
- Service deletion, reservation listing, and availability grouping must continue to work after create and edit operations.
- The selected-workspace UI must not regress the workspace management changes already present in the worktree.
- Other agents are modifying this repository concurrently; implementation must preserve unrelated dirty worktree changes.
- UX polish must not obscure non-admin restrictions, validation errors, submitting states, or the active edit target.
- Shared admin styling changes must not regress Workspace Management layout or modal behavior.

## Validation Plan

- Add or update deterministic unit tests for service edit validation and authorization.
- Add or update repository or integration tests for service update persistence when a database test environment is available.
- Add or update frontend tests only if the repository has an existing practical frontend test pattern; otherwise validate through TypeScript build and manual QA.
- Run `npm run build`.
- Run `npm test`.
- Run `git diff --check`.
- Manually inspect Service Management at desktop and mobile widths when a dev server/browser is available.
- Manually inspect Service Management at 375px, 768px, 1024px, and 1440px widths for no horizontal scroll, no overlapping text, stable hover/focus states, readable light/dark theme contrast, and reduced-motion behavior.
- Manual QA must verify:
  - workspace selection scopes the service list
  - the workspace selector is the page-level scope control above the selected-workspace list and create action
  - pressing `Create service` opens a modal equivalent in placement and interaction style to Workspace management `Create workspace`
  - the create modal does not offer existing services as selectable create targets
  - the create modal owner field visually matches the compact environments field treatment
  - selecting an existing owner commits that owner and clears transient suggestion/input text
  - typing an owner and committing by Enter, blur, or submit commits the owner and clears transient input text
  - clearing the committed owner submits the service with no owner
  - environment tags persist after comma, Enter, Space, blur, and submit
  - typing an already-selected environment and committing with comma, Enter, Space, blur, or submit clears the input, preserves the existing tag, and does not create a duplicate tag
  - service create succeeds with visible environment tags
  - service edit updates metadata and environment associations without changing `service_id`
  - non-admin members can view but cannot mutate services

## Documentation Requirements

- Update `README.md` only if implementation introduces or documents admin workflow/API behavior.
- Do not add unrelated documentation churn for purely visual layout changes.

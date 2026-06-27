# SPEC: Administration Service Management UI

Status: Approved

## Purpose

Redesign the Administration `Service Management` page so an admin can select one workspace and then list, create, and edit that workspace's services from a focused, reliable management surface.

## Problem Statement

The current Service Management page renders service controls inside every workspace row. This makes the page harder to scan, spreads create controls across the page, and makes the workflow depend on expanding the right workspace before the user can manage services. The current environment tag input is also unreliable: committing environment text can lose the tag that was just entered, so service creation can fail with `Add at least one environment.` even after the user typed an environment.

## Scope

- Update the Administration `Service Management` content area.
- Require a specific workspace selection before service management controls are shown.
- List services only for the selected workspace.
- Allow workspace admins to create services in the selected workspace.
- Allow workspace admins to edit existing services in the selected workspace.
- Fix environment entry so typed environments are preserved deterministically.
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

## Definitions

- `Service Management`: The Administration subsection selected by the left-side `Service Management` tab.
- `Selected workspace`: The workspace chosen by the user from a workspace selector inside Service Management.
- `Service`: A row in `services`, identified by its stable `service_id`, with label, owner, default reservation minutes, and zero or more environment associations.
- `Environment`: A row in `environments` belonging to the selected workspace.
- `Service environment association`: A row in `service_environments` connecting one service to one environment and creating a service key.
- `Create service`: Creating a new service when the entered service label does not match an existing selected-workspace service, then associating it with one or more environments.
- `Edit service`: Updating an existing selected-workspace service's editable fields and environment associations.

## Inputs And Constraints

- The current frontend uses Vue from `public/index.html` with state and behavior in `public/ts/controllers/AppController.ts`.
- The current Service Management UI already has workspace service catalog, environment, owner, create, and delete flows.
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

## Deterministic Behavior

### Workspace Selection

- When a signed-in user opens Administration and selects `Service Management`, the right-hand admin content shows a workspace selector as the first control.
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
- Each service item shows:
  - service label
  - owner or `Unowned`
  - default reservation minutes
  - associated environments
  - edit action for workspace admins
  - delete action for workspace admins
- Service items are ordered by the existing backend service catalog order unless the implementation already sorts client-side; if sorting is added, it must be alphabetical by service label.
- If the selected workspace has no services, the page shows a selected-workspace empty state.
- Non-admin workspace members may view the selected workspace service list but see an explicit message that admin access is required to create, edit, or delete services.

### Create Service

- Workspace admins can open a single create form for the selected workspace.
- The create form contains:
  - service label
  - default minutes
  - owner
  - environments
- The service label field may use existing selected-workspace services as suggestions, but creating a new service must be visually distinct from editing an existing one.
- Submitting with a blank service label prevents the API call and shows `Service name is required.`
- Submitting without at least one environment prevents the API call and shows `Add at least one environment.`
- Submitting a new service with nonpositive default minutes prevents the API call and shows `Default minutes must be positive.`
- On successful create:
  - the create form resets
  - the selected workspace service list refreshes
  - known environments and owners refresh
  - the existing success toast `Service created.` is shown
- On failed create:
  - the create form remains open
  - the backend error message is shown near the create form

### Environment Entry

- Typed environment text is preserved when the user commits it by comma, Enter, Space, blur, or form submit.
- Environment input accepts one or more environment names separated by comma or whitespace.
- Duplicate environment names are ignored case-insensitively within the current form.
- Existing selected-workspace environments are offered as suggestions.
- Removing an environment tag removes only that tag from the current form.
- Committing environment input must not overwrite or discard the current environment tag list with stale form state.
- Form submission must include all visible environment tags.

### Edit Service

- Workspace admins can edit one service at a time in the selected workspace.
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
- Error regions use visible text and are suitable for assistive technology announcement.
- The service list uses responsive cards or rows instead of a wide table that can overflow mobile widths.
- Clickable controls have visible hover and focus states.
- Disabled buttons have visible disabled styling.
- Text must not overlap or overflow its container at common mobile and desktop widths.

## Assumptions

- `Edit service` means editing label, default minutes, owner, and environment associations for an existing service.
- A service must have at least one associated environment after create or edit.
- Editing environments should replace the full environment association set for that service, not append only.
- It is acceptable to add a new API route for updating service metadata and environment associations.
- Existing reservations tied to a removed service-environment association are not a user-requested workflow and should only be changed if required for database integrity.
- The existing visual baseline should be improved, not replaced with a new branded design system.

## Impact And Regression Considerations

- Service creation currently depends on frontend tag state; fixing environment entry must not break keyboard entry or datalist suggestions.
- Adding service edit behavior affects backend service repository logic and must preserve workspace authorization checks.
- Replacing environment associations can affect service availability listings because service keys are per service-environment association.
- Service deletion, reservation listing, and availability grouping must continue to work after create and edit operations.
- The selected-workspace UI must not regress the workspace management changes already present in the worktree.
- Other agents are modifying this repository concurrently; implementation must preserve unrelated dirty worktree changes.

## Validation Plan

- Add or update deterministic unit tests for service edit validation and authorization.
- Add or update repository or integration tests for service update persistence when a database test environment is available.
- Add or update frontend tests only if the repository has an existing practical frontend test pattern; otherwise validate through TypeScript build and manual QA.
- Run `npm run build`.
- Run `npm test`.
- Run `git diff --check`.
- Manually inspect Service Management at desktop and mobile widths when a dev server/browser is available.
- Manual QA must verify:
  - workspace selection scopes the service list
  - environment tags persist after comma, Enter, Space, blur, and submit
  - service create succeeds with visible environment tags
  - service edit updates metadata and environment associations without changing `service_id`
  - non-admin members can view but cannot mutate services

## Documentation Requirements

- Update `README.md` only if implementation introduces or documents admin workflow/API behavior.
- Do not add unrelated documentation churn for purely visual layout changes.

# SPEC: Administration Workspace Management UI

Status: Approved

## Purpose

Improve the Administration workspace management page so workspace admins can scan existing workspaces, understand basic workspace size, invite users from a focused modal flow, and create workspaces from a focused modal flow that does not compete with the workspace list.

## Iteration: Workspace Stat Popup Detail APIs Bug Fix

This bug-fix iteration corrects the workspace stat popup behavior introduced by the previous workspace-management work and replaces the generic popup detail API with separate backend APIs for each workspace resource type.

Bug:

- Clicking the `Services`, `Owners`, or `Environments` stat tags in a workspace row opens the popup shell but does not show the expected list of elements.
- The popup shows the count in the clicked tag, but the opened popup does not render the corresponding names.
- The existing generic detail route overlaps conceptually with workspace service, owner, and environment management endpoints.

Added behavior:

- Clicking any workspace stat tag opens a workspace-detail popup that lists the corresponding elements for the clicked workspace.
- The popup detail fetch uses separate backend APIs for each workspace resource type:
  - `GET /api/workspaces/:workspaceId/detail/users`
  - `GET /api/workspaces/:workspaceId/detail/services`
  - `GET /api/workspaces/:workspaceId/detail/owners`
  - `GET /api/workspaces/:workspaceId/detail/environments`
- Each detail API returns only rows for the requested workspace and requested resource type.
- For now, the popup displays only one human-readable name string per row.
- The `Services` tag lists service names for the clicked workspace.
- The `Owners` tag lists owner names for the clicked workspace.
- The `Environments` tag lists environment names for the clicked workspace.
- The `Users` tag lists user email addresses for the clicked workspace because the app login identity is email-only and the current workspace user repository exposes email for this flow.
- The popup title starts with the uppercase resource label: `Users`, `Services`, `Owners`, or `Environments`.

Preserved behavior:

- Existing workspace stat counts remain unchanged.
- Existing workspace membership authorization remains unchanged.
- Existing service-management APIs remain unchanged:
  - `GET /api/workspaces/:workspaceId/services`
  - `GET /api/workspaces/:workspaceId/owners`
  - `GET /api/workspaces/:workspaceId/environments`
- Existing create workspace, invite user, create owner, create environment, and service management behavior remains unchanged.
- Existing popup loading, empty, error, and close behavior remains unchanged except where needed to show the correct rows and uppercase title.

## Iteration: Admin Surface UX Polish

This iteration improves the visual hierarchy, scanability, responsive behavior, and interaction quality of the already-approved Workspace management interface without changing backend contracts or workspace/invitation semantics.

Added behavior:

- Workspace management uses a professional data-dense admin-dashboard layout with compact spacing, restrained visual treatment, and clear section hierarchy.
- The workspace list presents each workspace as a stable management row/card with a distinct identity area, stats area, and action area.
- Workspace stat controls visually read as secondary data actions, not primary workflow buttons.
- Workspace action controls are grouped consistently and remain easy to scan when a workspace has multiple management actions.
- Empty, loading, error, and modal states remain visually aligned with the rest of the admin surface.
- Hover and focus states are visible and stable, with no layout shift.
- The layout respects reduced-motion preferences for decorative transitions.

Changed behavior:

- Workspace management styling should move away from large decorative cards, dashed borders as the primary hierarchy, and mixed action prominence that makes repeated workspace rows harder to scan.
- Workspace names, ids, stat labels, and action buttons wrap safely without overlapping or forcing horizontal page scroll.

Preserved behavior:

- Existing workspace creation, invitation, owner creation, environment creation, and workspace row-detail modal behavior remains unchanged.
- Existing light and dark theme support remains available.
- Existing modal trigger, submission, reset, toast, and error semantics remain unchanged.

## Problem Statement

The current workspace management page mixes workspace creation and per-workspace inline invitation controls in the right-hand administration content area. When a user clicks `Workspace management`, the expected primary content is a list of existing workspaces with workspace-level stats and clear actions. Invitation should not be embedded as repeated inline inputs inside each workspace row; it should open a popup that collects the invitee email. Workspace creation should also not occupy a persistent side column that changes the balance of the page as more workspaces are added; it should be available from a button that opens a focused popup.

## Iteration: Workspace Creation Modal

This iteration changes workspace creation from a persistent in-page card/column into a modal flow.

Added behavior:

- The Workspace management header or action area provides a `Create workspace` button.
- Pressing `Create workspace` opens a modal dialog above the page.
- The workspace creation modal collects only a workspace name in this iteration.
- The workspace creation modal form is structured so future workspace fields can be added to the same form area without changing the trigger or submission flow.
- Closing, canceling, and successful submission reset workspace creation modal state.

Changed behavior:

- The workspace creation form is no longer displayed as a persistent card or column next to the workspace list.
- The administered workspace list remains the primary content and must not resize or appear secondary because workspace creation is present.

Preserved behavior:

- Workspace creation validation, authorization, backend endpoint, success toast, and workspace-list refresh behavior remain unchanged.
- Workspace invitation remains an email-only modal flow.
- Workspace stats and administered workspace list behavior remain unchanged.

## Scope

- Update the Administration `Workspace management` content area.
- Show the existing workspaces that the signed-in user administers in the right-hand administration block.
- Show deterministic stats for each listed workspace:
  - number of users in the workspace
  - number of services in the workspace
- Provide an `Invite user` action for each listed admin workspace.
- Open a modal popup when `Invite user` is pressed.
- Collect the invitee email in the modal.
- Submit the invitation through the existing invitation behavior.
- Provide a `Create workspace` action in the Workspace management page.
- Open a modal popup when `Create workspace` is pressed.
- Collect the workspace name in the modal.
- Submit workspace creation through the existing workspace creation behavior.
- Preserve current access control: only workspace admins can invite users to that workspace.
- Keep the UI responsive and accessible.
- Structure the invite modal so additional invited-user fields can be added later without redesigning the flow; this iteration collects only email.
- Structure the workspace creation modal so additional workspace fields can be added later without redesigning the flow; this iteration collects only workspace name.

## Out Of Scope

- Changing invitation acceptance behavior.
- Inviting users who do not already exist, unless current backend behavior already supports it.
- Sending email notifications.
- Managing roles from the modal.
- Bulk invitations.
- Collecting invited-user details beyond email.
- Editing or deleting workspaces.
- Collecting workspace details beyond workspace name.
- Replacing the full administration navigation model.
- Redesigning Service Management or User management pages except where shared modal or layout styles must remain coherent.
- Changing workspace management backend API contracts, authorization, validation, or persistence behavior.
- Adding a new design system dependency or icon library.
- Replacing the full application shell, primary navigation, or theme model.

## Definitions

- `Workspace management`: The Administration subsection selected by the left-side `Workspace management` tab.
- `Existing workspaces`: Workspaces returned to the signed-in user by the workspace listing flow and for which the signed-in user is the workspace admin.
- `Number of users`: Count of rows in `workspace_users` for the workspace, including admins and members.
- `Number of services`: Count of rows in `services` for the workspace. Environments are not counted as services.
- `Invite user`: The action that creates a pending workspace invitation for an existing user email using the existing invitation endpoint and authorization rules.
- `Create workspace`: The action that creates a workspace using the existing workspace creation endpoint and authorization rules.
- `Popup`: An in-page modal dialog overlay, not a browser `prompt`.
- `Workspace detail API`: A read-only backend endpoint under `/api/workspaces/:workspaceId/detail/*` that exists for workspace-management stat popup display and is separate from service, owner, and environment management endpoints.

## Inputs And Constraints

- The current frontend uses Vue from `public/index.html` and controller state in `public/ts/controllers/AppController.ts`.
- The current browser workspace entity contains only `id`, `name`, and `adminUserId`; workspace stats require a deterministic data source.
- The workspace list API currently returns only `id`, `name`, and `admin_user_id`.
- Backend domain and service code must preserve onion architecture dependency direction.
- UI design must fit the current application style, support light and dark themes, and avoid horizontal overflow on mobile.
- Form inputs must use explicit labels and visible validation messages.
- The modal must provide submission feedback and preserve existing error behavior from the invitation endpoint.
- Workspace creation must not be a persistent second column next to the workspace list.
- Workspace stat popup detail calls must use the dedicated `/detail/*` APIs and must not reuse cached Service Management data.

## Deterministic Behavior

### Workspace List

- When a signed-in user opens Administration and selects `Workspace management`, the right-hand admin content shows a workspace list as the primary surface.
- The Workspace management content provides a `Create workspace` button near the section header or workspace-list action area.
- The content header uses compact admin-page hierarchy: section title, one short supporting line, and primary action aligned without competing with the list.
- The list includes only workspaces where `workspace.adminUserId === user.id`.
- Each workspace row or card shows:
  - workspace name
  - workspace id
  - number of users
  - number of services
  - `Invite user` button
- Each workspace row or card separates identity, stats, and actions so the user can scan names first, counts second, actions third.
- Primary row actions keep consistent placement across rows.
- Secondary stats and row-detail controls use quieter styling than creation and mutation actions.
- Workspaces are ordered consistently by the existing workspace listing order unless the implementation already sorts admin workspaces; if sorting is added, it must be alphabetical by workspace name.
- If the user administers no workspaces, show the existing empty state that no administered workspaces are available.

### Workspace Stats

- Workspace stats come from the backend workspace listing contract, not from client-side estimates based on currently loaded services.
- `user_count` is the count of workspace membership rows for that workspace.
- `service_count` is the count of service definition rows for that workspace.
- A workspace with no users beyond the admin reports `1` user.
- A workspace with no services reports `0` services.

### Workspace Stat Detail Popup

- Clicking `Users`, `Services`, `Owners`, or `Environments` in a workspace row opens a modal dialog above the page for that workspace and resource type.
- The modal title starts with the uppercase plural resource label and identifies the workspace, for example `Services in Payments`.
- The modal shows a loading state while resource rows are being fetched.
- The frontend calls exactly one dedicated detail API for the clicked resource type:
  - `Users` calls `GET /api/workspaces/:workspaceId/detail/users`.
  - `Services` calls `GET /api/workspaces/:workspaceId/detail/services`.
  - `Owners` calls `GET /api/workspaces/:workspaceId/detail/owners`.
  - `Environments` calls `GET /api/workspaces/:workspaceId/detail/environments`.
- The previous generic popup endpoint shape `/api/workspaces/:workspaceId/:resourceType` is not the popup contract for this iteration.
- The detail API response shape is deterministic and resource-neutral for the popup: `{ "items": [{ "name": string }] }`.
- On success with rows:
  - `Users` displays user email addresses.
  - `Services` displays service names.
  - `Owners` displays owner names.
  - `Environments` displays environment names.
- The popup must render only each item `name`; it must not display ids, owner ids, service ids, environment ids, or other metadata in this iteration.
- On success with no rows, the modal shows an empty state for the selected uppercase plural resource label.
- On failure, the modal remains open and shows the backend or frontend error message.
- If the user closes the modal before a fetch finishes, stale fetch results must not reopen the modal or overwrite a later modal selection.
- The detail popup must use the existing workspace authorization semantics and must not expose rows for workspaces outside the signed-in user's authorized workspace access.
- The detail popup must not depend on the already-loaded Service Management workspace caches; it must fetch rows for the clicked workspace/resource type.
- Detail rows are ordered deterministically by displayed name ascending.
- Unsupported detail resource paths return `404`.

### Invite Modal

- Pressing `Invite user` for a workspace opens a modal dialog above the page.
- The modal title identifies the target workspace.
- The modal contains:
  - an explicitly labeled email field
  - a cancel or close control
  - a submit button
  - an error region for validation or API errors
- The email field is empty every time the modal opens.
- The modal layout treats email as the first field in an invitation form, so future fields can be added in the same form area without changing the modal trigger or submission flow.
- Submitting with a blank email prevents the API call and shows `Email is required.`
- Submitting a nonblank email trims the value before sending.
- While the invitation request is in progress:
  - the submit button is disabled
  - the submit button text communicates progress
- On success:
  - the modal closes
  - the email field and modal error state reset
  - the existing success toast `Invitation sent.` is shown
- On failure:
  - the modal remains open
  - the backend error message is shown in the modal error region
  - the submit button becomes available again
- Closing or canceling the modal resets its email, error, selected workspace, and submitting state.

### Workspace Creation

- Workspace creation remains available in the `Workspace management` content area through a `Create workspace` button.
- Pressing `Create workspace` opens a modal dialog above the page.
- The workspace creation modal title identifies the action.
- The modal contains:
  - an explicitly labeled workspace name field
  - a cancel or close control
  - a submit button
  - an error region for validation or API errors
- The workspace name field is empty every time the modal opens.
- The modal layout treats workspace name as the first field in a workspace creation form, so future fields can be added in the same form area without changing the modal trigger or submission flow.
- Submitting with a blank workspace name prevents the API call and shows the existing client-side workspace name validation message.
- Submitting a nonblank workspace name trims the value before sending.
- While the workspace creation request is in progress:
  - the submit button is disabled
  - the submit button text communicates progress
- Successful workspace creation refreshes the workspace list and stats.
- On success:
  - the modal closes
  - the workspace name and modal error state reset
  - the existing success toast `Workspace created.` is shown
- On failure:
  - the modal remains open
  - the existing backend error message is shown in the modal error region
  - the submit button becomes available again
- Closing or canceling the modal resets its workspace name, error, and submitting state.
- The workspace creation form must not remain as a persistent card or column in the Workspace management content.

### Accessibility And Responsive Behavior

- The modal uses `role="dialog"` and `aria-modal="true"`.
- Modal inputs have associated labels.
- Modal close controls are keyboard reachable.
- Pressing Enter in modal text inputs submits the corresponding modal form.
- The page must not introduce horizontal scrolling at common mobile widths.
- The workspace list uses a responsive card/list layout instead of a wide table.
- Buttons and clickable controls have visible hover and focus states consistent with the current app.
- Hover and focus styling must not move controls or resize rows.
- Decorative transitions must be disabled or effectively removed under `prefers-reduced-motion: reduce`.
- Workspace row content must wrap long workspace names, ids, and labels without text overlap.
- Workspace stat detail popup list items must wrap long emails, service names, owner names, environment names, and ids without horizontal overflow.
- At mobile widths, workspace identity, stats, and actions stack vertically in that order.
- At desktop widths, workspace rows may use multiple columns, but controls must remain aligned and readable.
- Text must remain readable in light and dark themes.

## Assumptions

- Workspace stats are required for administered workspaces only, matching the requested workspace management view.
- Existing backend invitation semantics remain acceptable: inviting an unknown email returns `Invitee not found`.
- No new user role selection is needed in the invitation modal.
- Email is the only invited-user detail collected in this iteration, while future iterations may add more fields to the same modal.
- Workspace name is the only workspace detail collected in this iteration, while future iterations may add more fields to the same workspace creation modal.
- Existing app styling is the visual baseline; the UI should become more structured and scannable without introducing a separate visual system.
- UX polish should use the existing CSS/theme-token stack and should not add external fonts, CSS frameworks, or icon dependencies.

## Impact And Regression Considerations

- The workspace list API contract will add stats fields; existing clients that read only known fields should continue working.
- Browser workspace DTO/entity parsing must tolerate the new numeric fields and keep stable fallbacks.
- Workspace creation and invitation flows must continue to work.
- Service Management depends on the same `workspaces` frontend state and must not break when workspace objects gain stats fields.
- Backend stats queries must not expose workspaces outside the signed-in user's membership.
- Workspace stat detail row endpoints or frontend parsing must return/display a consistent row shape for all four supported resource types.
- The generic workspace stat detail route must not shadow more specific workspace management API routes for service catalog, owners, or environments.
- Invitation errors must stay scoped to the modal rather than leaking into unrelated workspace rows.
- Workspace creation errors must stay scoped to the workspace creation modal.
- Moving workspace creation into a modal must not change workspace creation authorization, backend validation, or list refresh behavior.
- UX polish must not hide existing row actions or make stat-detail modals less discoverable.
- Shared admin styling changes must not regress Service Management layout or modal behavior.

## Validation Plan

- Add or update deterministic tests for workspace summary stats where practical.
- Add or update deterministic tests for workspace stat detail rows for services, owners, and environments where practical.
- Add or update frontend parsing/controller tests only if the repository has an existing practical frontend test pattern; otherwise validate with TypeScript build.
- Validate that workspace creation state resets on modal open, close/cancel, and successful submission through tests when practical; otherwise validate with TypeScript build and manual QA.
- Run `npm run build`.
- Run `npm test`.
- Run `git diff --check`.
- Manually inspect the workspace management view at desktop and mobile widths during implementation QA when a browser/dev server is available, including that workspace creation opens in a modal and does not occupy a persistent column.
- Manually click `Users`, `Services`, `Owners`, and `Environments` stat tags for a workspace with data and verify each modal lists the expected rows and starts the title with an uppercase resource label.
- Manually inspect Workspace management at 375px, 768px, 1024px, and 1440px widths for no horizontal scroll, no overlapping text, stable hover/focus states, readable light/dark theme contrast, and reduced-motion behavior.

## Documentation Requirements

- Update `README.md` only if the API contract or admin workflow documentation exists or is introduced by implementation.
- Do not add documentation churn for purely visual layout changes unless needed to describe the admin workflow.

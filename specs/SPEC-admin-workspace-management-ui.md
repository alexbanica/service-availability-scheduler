# SPEC: Administration Workspace Management UI

Status: Approved

## Purpose

Improve the Administration workspace management page so workspace admins can scan existing workspaces, understand basic workspace size, invite users from a focused modal flow, and create workspaces from a focused modal flow that does not compete with the workspace list.

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

## Definitions

- `Workspace management`: The Administration subsection selected by the left-side `Workspace management` tab.
- `Existing workspaces`: Workspaces returned to the signed-in user by the workspace listing flow and for which the signed-in user is the workspace admin.
- `Number of users`: Count of rows in `workspace_users` for the workspace, including admins and members.
- `Number of services`: Count of rows in `services` for the workspace. Environments are not counted as services.
- `Invite user`: The action that creates a pending workspace invitation for an existing user email using the existing invitation endpoint and authorization rules.
- `Create workspace`: The action that creates a workspace using the existing workspace creation endpoint and authorization rules.
- `Popup`: An in-page modal dialog overlay, not a browser `prompt`.

## Inputs And Constraints

- The current frontend uses Vue from `public/index.html` and controller state in `public/ts/controllers/AppController.ts`.
- The current browser workspace entity contains only `id`, `name`, and `adminUserId`; workspace stats require a deterministic data source.
- The workspace list API currently returns only `id`, `name`, and `admin_user_id`.
- Backend domain and service code must preserve onion architecture dependency direction.
- UI design must fit the current application style, support light and dark themes, and avoid horizontal overflow on mobile.
- Form inputs must use explicit labels and visible validation messages.
- The modal must provide submission feedback and preserve existing error behavior from the invitation endpoint.
- Workspace creation must not be a persistent second column next to the workspace list.

## Deterministic Behavior

### Workspace List

- When a signed-in user opens Administration and selects `Workspace management`, the right-hand admin content shows a workspace list as the primary surface.
- The Workspace management content provides a `Create workspace` button near the section header or workspace-list action area.
- The list includes only workspaces where `workspace.adminUserId === user.id`.
- Each workspace row or card shows:
  - workspace name
  - workspace id
  - number of users
  - number of services
  - `Invite user` button
- Workspaces are ordered consistently by the existing workspace listing order unless the implementation already sorts admin workspaces; if sorting is added, it must be alphabetical by workspace name.
- If the user administers no workspaces, show the existing empty state that no administered workspaces are available.

### Workspace Stats

- Workspace stats come from the backend workspace listing contract, not from client-side estimates based on currently loaded services.
- `user_count` is the count of workspace membership rows for that workspace.
- `service_count` is the count of service definition rows for that workspace.
- A workspace with no users beyond the admin reports `1` user.
- A workspace with no services reports `0` services.

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
- Text must remain readable in light and dark themes.

## Assumptions

- Workspace stats are required for administered workspaces only, matching the requested workspace management view.
- Existing backend invitation semantics remain acceptable: inviting an unknown email returns `Invitee not found`.
- No new user role selection is needed in the invitation modal.
- Email is the only invited-user detail collected in this iteration, while future iterations may add more fields to the same modal.
- Workspace name is the only workspace detail collected in this iteration, while future iterations may add more fields to the same workspace creation modal.
- Existing app styling is the visual baseline; the UI should become more structured and scannable without introducing a separate visual system.

## Impact And Regression Considerations

- The workspace list API contract will add stats fields; existing clients that read only known fields should continue working.
- Browser workspace DTO/entity parsing must tolerate the new numeric fields and keep stable fallbacks.
- Workspace creation and invitation flows must continue to work.
- Service Management depends on the same `workspaces` frontend state and must not break when workspace objects gain stats fields.
- Backend stats queries must not expose workspaces outside the signed-in user's membership.
- Invitation errors must stay scoped to the modal rather than leaking into unrelated workspace rows.
- Workspace creation errors must stay scoped to the workspace creation modal.
- Moving workspace creation into a modal must not change workspace creation authorization, backend validation, or list refresh behavior.

## Validation Plan

- Add or update deterministic tests for workspace summary stats where practical.
- Add or update frontend parsing/controller tests only if the repository has an existing practical frontend test pattern; otherwise validate with TypeScript build.
- Validate that workspace creation state resets on modal open, close/cancel, and successful submission through tests when practical; otherwise validate with TypeScript build and manual QA.
- Run `npm run build`.
- Run `npm test`.
- Run `git diff --check`.
- Manually inspect the workspace management view at desktop and mobile widths during implementation QA when a browser/dev server is available, including that workspace creation opens in a modal and does not occupy a persistent column.

## Documentation Requirements

- Update `README.md` only if the API contract or admin workflow documentation exists or is introduced by implementation.
- Do not add documentation churn for purely visual layout changes unless needed to describe the admin workflow.

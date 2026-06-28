# SPEC: Overview Admin Workspace Name Only

Status: Approved

## Purpose

Keep the overview page workspace administration card readable after workspace identifiers changed to UUIDs.

## Problem Statement

The `Workspaces you administer` overview card displayed both the workspace name and `ID <workspace id>`. UUID-length identifiers made the overview item too wide and visually noisy.

## Scope

- Remove the visible workspace UUID from the `Workspaces you administer` card on the overview page.
- Preserve the workspace name display.
- Preserve the existing workspace id data binding used as the Vue list key.

## Out Of Scope

- Changing backend workspace identifiers or API contracts.
- Removing workspace ids from admin data models, service-management flows, route parameters, or persistence.
- Changing the Administration page workspace list unless separately requested.
- Adding truncation, copy controls, or alternate identifier display.

## Definitions

- `Overview page`: The `currentView === 'overview'` section in `public/index.html`.
- `Workspaces you administer`: The overview card listing `adminWorkspaces`.

## Inputs And Constraints

- Workspace ids are UUID strings.
- The frontend still needs workspace ids internally for stable Vue keys and actions.
- The request is limited to removing the visible UUID from the overview card.

## Deterministic Behavior Delivered

- Each administered workspace row in the overview card displays the workspace name only.
- The row no longer displays `ID {{ workspace.id }}`.
- The row still uses `workspace.id` as its Vue `:key`.
- No backend responses, DTOs, controller behavior, or service behavior changed.

## Assumptions

- The phrase "overview page - workspace you administare" refers to the `Workspaces you administer` card in `public/index.html`.
- The UUID should be removed from that overview card only, not from other administrative screens where ids may still be useful for implementation or diagnostics.

## Impact And Regression Considerations

- This is a frontend display-only change with low behavioral risk.
- Internal id usage remains available for stable rendering and workspace actions.
- Existing dirty worktree changes were preserved.

## Validation Performed

- Targeted source inspection confirmed the overview card no longer renders `ID {{ workspace.id }}`.
- `git diff --check` was run.

## Validation Skipped

- `npm run build` was skipped because the `super-agent` workflow only runs checks expected to complete within 10 seconds and the project build is not guaranteed to stay under that limit.
- Browser QA was skipped by design for the `super-agent` workflow.

## Documentation Changes

- No user-facing documentation changes were needed for this display-only adjustment.

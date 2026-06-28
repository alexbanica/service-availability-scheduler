Status: Approved

# Overview Workspace Availability Filter

## Purpose

Allow users to move from the Overview workspace summary directly into the Service Availability view scoped to the workspace they clicked.

## Problem Statement

The Overview page lists administered workspaces, but clicking a workspace did not navigate to Service Availability or apply the workspace filter. Users had to switch views and select the workspace manually.

## Scope

- Make each administered workspace listed in the Overview workspace card clickable.
- On click, switch the app to the `Service Availability` view.
- Set the existing Service Availability workspace filter to the clicked workspace id.
- Preserve the existing persisted workspace filter behavior through the current `workspaceFilter` watcher.
- Preserve existing Overview counts, admin navigation, availability filtering, and backend APIs.

## Out Of Scope

- Changing backend workspace, service, or reservation APIs.
- Changing which workspaces appear in Overview.
- Clearing owner or service-name filters when navigating from Overview.
- Changing Administration workspace management behavior.

## Definitions

- `Overview workspace`: A workspace shown in the `Workspaces you administer` Overview card.
- `Service Availability workspace filter`: The existing `workspaceFilter` state bound to the Workspace select in the Service Availability filters row.

## Inputs And Constraints

- Overview workspace rows use the existing `Workspace` browser entity.
- The clicked workspace id is the filter value.
- The app remains a Vue browser-side TypeScript UI.
- The change is implemented through the existing `currentView` and `workspaceFilter` state.

## Deterministic Behavior Delivered

- When an Overview administered workspace is clicked, the app sets `workspaceFilter` to that workspace's id.
- The app immediately sets `currentView` to `availability`.
- The Service Availability Workspace select shows the clicked workspace when it is present in the existing workspace options.
- The Service Availability service list uses the already-existing filtered-service computation to show services for the clicked workspace.
- The clicked Overview workspace is rendered as a button, so keyboard focus and activation use standard button behavior.

## Assumptions

- The requested phrase `an workspace in the overview` refers to items in the `Workspaces you administer` Overview card.
- Existing owner and service-name filters remain active because the requested change only specifies filtering by clicked workspace.

## Impact And Regression Considerations

- The behavior reuses existing filter persistence, so clicking an Overview workspace updates the stored workspace filter.
- Existing `Go to admin` and general `Go to Service Availability` actions are unchanged.
- No backend behavior changes are introduced.

## Validation Performed

- Ran `npx tsc -p tsconfig.client.json`.

## Validation Skipped

- Full `npm run build` was skipped because the super-agent workflow limits validation to commands expected to complete within 10 seconds, and this repo's build runs clean, install, and both server and client TypeScript compiles.
- Browser/manual QA was skipped by design in the super-agent workflow.

## Documentation Changes

- Added this completed behavior spec.

Status: Approved

# Service Availability Filter Layout

## Purpose

Remove repeated Service Availability page titling from the Service Availability subpage and make the filter controls visually separate from the service cards.

## Problem Statement

The application header and navigation already identify the website and selected Service Availability page. The Service Availability subpage repeated the same title and subtitle immediately above the filters, and the filters had no visible spacing before the following service cards.

## Scope

- Remove the Service Availability subpage header block from the availability view.
- Keep the existing Workspace, Owner, and Search filters as the first content in the availability view.
- Add vertical spacing between the filters and the sections or cards that follow them.
- Preserve existing filtering behavior, navigation, service cards, and reservation actions.

## Out Of Scope

- Changing the browser document title.
- Changing the top application header, primary navigation, or Overview page.
- Changing filter options, filtering logic, service grouping, claims, extensions, or releases.
- Changing backend APIs or persistence.

## Inputs And Constraints

- The view remains the existing Vue template in `public/index.html`.
- The layout remains controlled by the existing stylesheet in `public/styles.css`.
- The filter controls continue to use the existing `workspaceFilter`, `ownerFilter`, and `serviceNameFilter` bindings.

## Deterministic Behavior Delivered

- When the Service Availability view is open, the duplicate subpage `Service Availability` heading and subtitle are no longer rendered above the filters.
- The Workspace, Owner, and Search filters remain visible at the top of the Service Availability content area.
- The filter row has vertical margin above and below it, including spacing before the in-use section or service card grid.
- Existing service cards and in-use sections continue to render after the filters according to the existing Vue conditions.

## Assumptions

- `sub cards` refers to the service card grid and any in-use service cards shown below the filters.
- The top site title and browser document title should remain unchanged because the request only asked to remove the duplicate subpage title and subtitle.

## Impact And Regression Considerations

- This is a markup and CSS-only layout change.
- The removal reduces duplicate heading text in the availability view but does not alter application state or data flow.
- The shared `.filters-row` spacing affects any usage of that class; current usage is the Service Availability filters row.

## Validation Performed

- Ran `git diff --check`.

## Validation Skipped

- `npm run build` was skipped because the super-agent workflow limits validation to commands expected to complete within 10 seconds, and the full build is not guaranteed to stay under that limit.
- Browser/manual QA was skipped by design in the super-agent workflow.

## Documentation Changes

- Added this completed behavior spec.

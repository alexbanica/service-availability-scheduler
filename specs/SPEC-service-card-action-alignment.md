Status: Approved

# Service Card Action Alignment

## Purpose

Make reservation actions on claimed service cards easier to scan and use by positioning them consistently with the Claim action on available service cards.

## Problem Statement

The Extend and Release buttons on service availability cards were visually crowded under the service status text instead of occupying the right-side action area used by available cards' Claim button.

## Scope

- Align service-card action buttons to the right side of each service card.
- Keep Extend and Release grouped together for services claimed by the current user.
- Preserve existing Claim, Extend, and Release behavior.
- Preserve the existing mobile stacked card layout while keeping actions right-aligned within the available row width.

## Out Of Scope

- Changing reservation API behavior.
- Changing claim, extend, or release handlers.
- Changing service filtering, grouping, or card content.
- Changing buttons outside service availability cards.

## Inputs And Constraints

- The service availability card markup remains the existing Vue template in `public/index.html`.
- The layout remains controlled by `public/styles.css`.
- The implementation must avoid unrelated UI refactors because the worktree already contains other in-flight changes.

## Deterministic Behavior Delivered

- Service-card text occupies the flexible left side of the card.
- The service-card action container does not shrink into the text area and is pushed to the card's right side.
- Available service cards continue to show Claim in the right-side action area.
- Claimed service cards owned by the current user show Extend and Release together in the same right-side action area.
- On narrow screens where service cards stack vertically, the action container spans the card width and keeps buttons right-aligned.

## Assumptions

- "Services" refers to the Service Availability card list rendered by the `.service-item` elements.
- "As the claim button in the other cards" means matching the right-side action placement already used by available service cards.

## Impact And Regression Considerations

- This is a CSS-only layout change.
- The change affects `.service-info` and `.service-actions` inside service cards.
- Reservation state and click behavior are unchanged.
- Browser rendering was not manually verified because the selected workflow skips QA by design.

## Validation Performed

- Ran `git diff --check`.

## Validation Skipped

- `npm run build` was skipped because the super-agent workflow limits validation to commands expected to complete within 10 seconds, and the full build is not guaranteed to stay under that limit.
- Browser/manual QA was skipped by design in the super-agent workflow.

## Documentation Changes

- Added this completed behavior spec.

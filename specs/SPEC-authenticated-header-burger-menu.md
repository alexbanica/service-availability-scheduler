# Authenticated Header Burger Menu

Status: Approved

## Purpose

Reduce clutter in the authenticated application header by grouping account and
appearance actions under one burger-menu control.

## Requested Behavior

- Replace the separate authenticated header controls for theme switching,
  account deletion, and logout with one burger-menu trigger.
- Show the current light/dark theme action, `Delete account`, and `Log out`
  inside the menu.
- Preserve the existing account-deletion confirmation and all destructive-action
  safeguards.

## Scope

- Authenticated application header markup, menu state, keyboard dismissal,
  focus behavior, styling, and focused browser tests.

## Out Of Scope

- Login-page header controls.
- Account-deletion API or database behavior.
- Navigation-menu changes.

## Deterministic Behavior Delivered

- The burger trigger exposes its expanded state and opens a dropdown containing
  the three requested actions.
- Opening the menu moves focus to its first action; Escape closes it and restores
  focus to the burger trigger; clicking outside closes it.
- Selecting account deletion closes the dropdown before opening the existing
  typed-email confirmation dialog. Closing that dialog restores focus to the
  burger trigger.
- Theme switching and logout retain their existing behavior.

## Assumptions And Impact

- The burger menu is used at all authenticated viewport sizes, not only narrow
  layouts.
- API contracts, persistence, and public documentation are unaffected.

## Validation Performed

- Focused browser controller/service tests.
- Client TypeScript compilation.
- Repository lint and `git diff --check`.

## Validation Skipped

- Full automated suite, production build, manual browser QA, and independent
  code review are skipped by the requested lower-assurance workflow.

## Documentation Changes

- No user or API documentation changes were needed for this presentation-only
  header adjustment.

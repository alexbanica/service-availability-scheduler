Status: Approved

# Service Availability Auto Refresh

## Purpose

Keep Service Availability data current without requiring users to press a manual refresh button, while making the refresh interval configurable from application configuration.

## Problem Statement

The authenticated application header currently exposes a `Refresh` button. Service availability data should refresh automatically at a configured interval, so users do not need a manual refresh control to see updated service claim and availability state.

## Scope

- Remove the visible manual `Refresh` button from the authenticated application header.
- Preserve automatic refresh of service availability data for signed-in users.
- Use the configured service auto-refresh interval as the source of truth for the browser refresh timer.
- Keep the refresh interval configurable through the existing application configuration contract.
- Preserve existing service availability rendering, filtering, claim, release, extend, overview counts, workspace navigation, theme toggle, and logout behavior.

## Out Of Scope

- Adding a user-facing refresh-rate control in the browser UI.
- Adding per-user or per-session refresh preferences.
- Changing reservation expiration logic or warning notifications.
- Changing backend persistence, workspace authorization, or service catalog management.
- Changing Service Availability filters or service card layout.
- Adding realtime push updates beyond the existing expiration warning events.

## Definitions

- `Manual Refresh button`: The header button labeled `Refresh` that triggers the browser-side `refresh` action.
- `Automatic refresh`: A browser-side timer that reloads service availability data from the existing service-list API without user interaction.
- `Refresh interval`: The numeric interval, in minutes, used by the browser timer between automatic service-list reloads.
- `Configured refresh interval`: The server-loaded `auto_refresh_minutes` value from application configuration, exposed to the browser through the service-list response.

## Inputs And Constraints

- Application-level configuration remains in `config/app.yml`.
- The existing configuration key `auto_refresh_minutes` remains the refresh-rate configuration input.
- The existing service-list API response continues to expose `auto_refresh_minutes` to the browser.
- The browser remains responsible for scheduling the automatic reload after it receives the configured interval.
- The timer must reload only the service availability data needed by the existing app state; it must not perform a full browser page reload.
- The app must continue to work if `auto_refresh_minutes` is absent from configuration by using the existing default value.

## Deterministic Behavior

- When a signed-in user opens the application, the app loads services and starts an automatic service-list refresh timer.
- The timer interval is derived from the latest `auto_refresh_minutes` value received from the service-list API.
- After each automatic service-list reload succeeds, the next automatic refresh is scheduled using the latest configured interval from that response.
- The manual `Refresh` button is not rendered anywhere in the authenticated application header.
- Removing the manual button does not remove or change the theme toggle or `Log out` controls.
- Automatic refresh preserves the currently selected view and active Service Availability filters.
- Automatic refresh updates service claim and availability state using the same data-loading path as the existing manual refresh behavior.
- If the configured interval is missing, non-numeric, zero, or negative after browser parsing, the browser uses a minimum interval of 1 minute for scheduling.
- The application must not create overlapping automatic refresh timers during normal mounted operation.

## Assumptions

- `configurable` means operator-configurable through `config/app.yml`, not user-configurable from the browser UI.
- The existing `auto_refresh_minutes` configuration key is the intended configuration contract and should be reused.
- A configured interval below 1 minute is not required for this app; values below 1 minute are clamped to 1 minute in the browser timer.
- Automatic refresh remains active while the authenticated app is mounted, including when the user is on Overview or Administration, because the loaded service data also feeds overview service counts and existing app state.

## Impact And Regression Considerations

- The primary user-visible change is removal of the manual header refresh control.
- Users can no longer force a service-list reload from the header; data freshness depends on the configured timer and existing claim, release, and extend reload paths.
- Service-list API shape and config loading are part of the refresh contract and should remain backward compatible.
- Timer behavior affects browser-side state freshness and must avoid duplicate timers that increase API load.
- Existing filters and selected workspace state must remain stable across automatic refreshes.
- Existing README configuration documentation already names `auto_refresh_minutes`; update it only if implementation changes the documented operational behavior.

## Acceptance Criteria

- The authenticated header no longer displays a `Refresh` button.
- `auto_refresh_minutes` remains configurable in `config/app.yml`.
- The browser uses the service-list response's `auto_refresh_minutes` value to schedule service-list reloads.
- Automatic refresh reloads services without a full page reload.
- Automatic refresh does not reset the current view, selected workspace filter, owner filter, or service-name filter.
- Automatic refresh does not create overlapping timers during normal app usage.
- Values missing or below 1 minute result in a 1-minute browser refresh interval.
- Existing claim, release, extend, theme toggle, logout, overview, Service Availability, and Administration navigation behavior remains unchanged.

## Validation Plan

- Add or update deterministic browser-side tests if the project has suitable test coverage for the app controller or extracted timer behavior.
- Run the TypeScript build with `npm run build`.
- Run `git diff --check`.
- If a local database is available, start the app with `npm run dev` and manually verify:
  - the header does not show `Refresh`
  - Service Availability still loads services after login
  - configured auto-refresh continues to reload service data without resetting filters
  - theme toggle and logout remain available

## Documentation Requirements

- Keep `README.md` configuration documentation accurate for `auto_refresh_minutes`.
- Do not add documentation for a browser-side refresh-rate control, because that UI is out of scope.

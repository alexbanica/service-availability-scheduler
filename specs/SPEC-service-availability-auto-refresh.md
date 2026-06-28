Status: Approved

# Service Availability Auto Refresh

## Purpose

Keep Service Availability data current through automatic browser refresh while expressing the operator-configured refresh interval in seconds.

## Problem Statement

The auto-refresh configuration previously used a minutes-based key and default. Operators need the interval configured in seconds, with the default set to 60 seconds, and the public documentation must describe all supported configuration inputs.

## Scope

- Replace the auto-refresh configuration key with `auto_refresh_seconds`.
- Default missing `auto_refresh_seconds` to `60`.
- Expose the configured interval from `GET /api/services` as `auto_refresh_seconds`.
- Schedule browser refreshes in seconds.
- Update README configuration documentation.
- Update agent-facing repository guidance for current project standards.

## Out Of Scope

- Adding a browser control for refresh frequency.
- Changing reservation expiry warning behavior.
- Changing claim, release, extend, filtering, workspace, owner, environment, service-management, login, or schema behavior.
- Adding realtime updates beyond the existing expiration warning events.

## Definitions

- `Automatic refresh`: A browser-side timer that reloads service availability data from the existing service-list API without user interaction.
- `Refresh interval`: The numeric interval, in seconds, used by the browser timer between automatic service-list reloads.
- `Configured refresh interval`: The server-loaded `auto_refresh_seconds` value from `config/app.yml`, exposed to the browser through the service-list response.

## Inputs And Constraints

- Application-level timing configuration remains in `config/app.yml`.
- `auto_refresh_seconds` is the refresh-rate configuration input.
- The default refresh interval is 60 seconds when the key is absent.
- `GET /api/services` exposes `auto_refresh_seconds`.
- The browser remains responsible for scheduling automatic reloads after it receives the configured interval.
- The timer reloads service availability data through the existing load path and does not perform a full browser page reload.

## Deterministic Behavior Delivered

- `config/app.yml` configures `auto_refresh_seconds: 60`.
- `ConfigLoaderService` reads `auto_refresh_seconds` and defaults to `60` when absent.
- `GET /api/services` returns `auto_refresh_seconds`.
- Browser service loading maps `auto_refresh_seconds` to `ServicesResponseDto.autoRefreshSeconds`.
- `AppController` stores the interval as seconds and schedules the timer using `intervalSeconds * 1000`.
- Missing, non-numeric, zero, or negative browser values are clamped to a minimum of 1 second before scheduling.
- Existing service-list reload behavior preserves the current view and filters.
- Existing claim, release, extend, theme toggle, logout, overview, Service Availability, and Administration navigation behavior remains unchanged.

## Assumptions

- `configurable` means operator-configurable through `config/app.yml`, not user-configurable from the browser UI.
- The seconds-based key replaces the minutes-based refresh contract for current code and documentation.

## Impact And Regression Considerations

- Operators must use `auto_refresh_seconds` instead of `auto_refresh_minutes`.
- Clients expecting `auto_refresh_minutes` from `/api/services` must update to `auto_refresh_seconds`.
- Timer behavior affects browser-side state freshness and must avoid duplicate timers that increase API load.
- Existing filters and selected workspace state must remain stable across automatic refreshes.

## Acceptance Criteria

- `auto_refresh_seconds` is configurable in `config/app.yml`.
- Missing `auto_refresh_seconds` defaults to `60`.
- `GET /api/services` returns `auto_refresh_seconds`.
- The browser uses the service-list response's `auto_refresh_seconds` value to schedule service-list reloads.
- Automatic refresh reloads services without a full page reload.
- Automatic refresh does not reset the current view, selected workspace filter, owner filter, or service-name filter.
- Automatic refresh does not create overlapping timers during normal app usage.
- Values missing or below 1 second result in a 1-second browser refresh interval.
- README lists supported runtime, app file, and test configuration.

## Validation Performed

- Server TypeScript no-emit check passed.
- Browser TypeScript no-emit check passed.
- Browser TypeScript compilation passed.
- Focused unit coverage for `ConfigLoaderService` was updated for `auto_refresh_seconds` missing, valid, zero, negative, and invalid values.
- Focused config-loader unit test passed.
- Scoped whitespace validation passed for files touched by this change.

## Validation Skipped

- Full build, full test suite, browser QA, and runtime database-backed QA are recorded as skipped in the matching plan according to the `$super-agent` short-validation workflow.

## Documentation Changes

- `README.md` now lists runtime environment variables, `config/app.yml` keys, and test-only environment variables with descriptions.
- `AGENTS.md` now describes the current MySQL-backed architecture, active configuration keys, generated browser bundle expectations, and validation commands.

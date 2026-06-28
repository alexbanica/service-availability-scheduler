Status: Approved

# Service Availability Auto Refresh Implementation Plan

Approved spec reference: `specs/SPEC-service-availability-auto-refresh.md`

## Objective

Implement the approved Service Availability auto-refresh behavior: remove the authenticated header's manual `Refresh` button, preserve configured automatic service-list refresh, and keep refresh scheduling deterministic and non-overlapping.

## Branch

- Target branch: `service-availability-auto-refresh`
- Create the branch from the current working branch only after confirming that doing so will not include unrelated local changes.
- Do not revert or modify unrelated existing worktree changes.

## Scope Boundaries

In scope:

- `public/index.html`
- `public/ts/controllers/AppController.ts`
- `public/ts/services/ReservationService.ts` only if needed to make malformed or missing `auto_refresh_minutes` parsing deterministic.
- `src/services/ConfigLoaderService.ts` only if needed to keep the backend default/config contract deterministic for missing or invalid `auto_refresh_minutes`.
- Focused tests under `src/tests/**` when practical for any backend config parsing changes.
- `README.md` only if implementation changes the documented operational behavior.

Out of scope:

- Backend reservation behavior, database schema, workspace authorization, service management behavior, filters, card layout, and realtime event behavior.
- Browser-side user preference controls for the refresh interval.
- Broad frontend refactors unrelated to refresh scheduling.

## Existing Behavior To Preserve

- `config/app.yml` contains `auto_refresh_minutes`.
- `ConfigLoaderService` loads `auto_refresh_minutes` with a default of `2`.
- `GET /api/services` returns `auto_refresh_minutes`.
- Browser `ReservationService.loadServices()` maps API `auto_refresh_minutes` to `ServicesResponseDto.autoRefreshMinutes`.
- `AppController` stores `autoRefreshMinutes`, calls `loadServices()`, and schedules a timer with `scheduleAutoRefresh()`.
- Claim, release, extend, overview counts, filters, theme toggle, logout, and view navigation continue to use their existing paths.

## Test-First Work

Use exactly one clean-context test-focused subagent before production implementation.

Assignment:

- Read only the approved spec, this approved plan, and the files needed for the assigned tests.
- Determine whether deterministic automated coverage is practical for the changed refresh contract.
- Add or update tests before production implementation when feasible.
- If browser timer behavior cannot be tested with the existing test harness without introducing disproportionate tooling, report that and leave browser timer coverage for build plus manual QA.
- If backend config parsing is changed, add or update focused unit coverage for `ConfigLoaderService` behavior around missing, invalid, zero, negative, and valid `auto_refresh_minutes` values.
- Do not implement production behavior.

Expected output:

- Test changes only, or a written blocker/rationale if no focused automated test fits the existing harness.

## Implementation Steps

Use exactly one clean-context implementation subagent for the initial production implementation.

Assignment:

1. Inspect the approved spec and this plan only, plus the in-scope files needed for edits.
2. Remove the manual header `Refresh` button from `public/index.html`.
3. Remove the browser-exposed `refresh` action from `AppController` if no template or code path uses it after the button is removed.
4. Keep `loadServices()` as the shared data-loading path for initial load, automatic refresh, and claim/release/extend flows.
5. Make refresh interval handling deterministic:
   - schedule from the latest `autoRefreshMinutes` value received by the browser
   - clamp missing, non-finite, zero, or negative browser values to 1 minute
   - clear any existing timer before creating a replacement timer
   - do not create overlapping timers during normal mounted operation
6. If the existing backend or browser parsing can pass `NaN` through the contract, normalize that value at the narrowest appropriate boundary without changing the API field name.
7. Do not add a browser UI for refresh-rate configuration.
8. Do not change README unless the implementation changes the documented operator workflow for `auto_refresh_minutes`.

## Review Requirements

Use exactly one clean-context code-review subagent after implementation.

Assignment:

- Review the diff against `specs/SPEC-service-availability-auto-refresh.md` and this plan.
- Check for spec mismatches, overlapping timer risk, lost refresh paths after claims/releases/extensions, filter/view reset regressions, config contract regressions, and unrelated edits.
- Do not implement fixes.

Route any in-scope review finding requiring code changes to a clean-context implementation subagent with only the approved artifacts, finding details, relevant diff/file context, and the allowed ownership boundary.

## Main-Agent QA

The main agent must run QA after review findings are resolved.

Automated validation:

- `npm test`
- `npm run build`
- `git diff --check`

Manual QA when a local database configuration is available:

- Start the app with `npm run dev`.
- Sign in.
- Verify the authenticated header no longer shows `Refresh`.
- Verify theme toggle and `Log out` remain visible and functional.
- Verify Service Availability loads services.
- Set filters, wait for an automatic refresh, and verify current view and filters are preserved.
- Verify claim, release, and extend still reload service state through their existing flows.

If local database access is unavailable, report manual browser QA as unvalidated and mark delivery draft unless the user explicitly accepts build/test-only validation.

## Documentation

- No README change is required if `auto_refresh_minutes` remains configured through `config/app.yml` as currently documented.
- Update README only if the implementation changes how operators configure the interval.

## Commit And Push

- Commit only files changed for this approved spec and plan.
- Use commit summary `feature: service availability auto refresh`.
- If required validation, review, QA, or documentation is skipped, blocked, incomplete, or failing, use a `DRAFT` commit summary instead.
- Push the implementation branch after accepted review, QA, validation, documentation decisions, and final main-agent acceptance, unless the user instructs otherwise.

## No-Research Constraint For Implementation

Implementation must not perform additional product, architecture, scope, or planning research. It may inspect only:

- repository and workspace instructions
- `specs/SPEC-service-availability-auto-refresh.md`
- this implementation plan
- branch/worktree state
- the in-scope files named above
- minimal adjacent local patterns needed to make safe edits and run validation

## Clean-Context Handoff Requirement

After this plan is approved and its status is updated to `Approved`, implementation must start only in one of these states:

- a new session
- explicitly cleared current context
- explicit user confirmation that continuing implementation in the current context is intentional for this invocation

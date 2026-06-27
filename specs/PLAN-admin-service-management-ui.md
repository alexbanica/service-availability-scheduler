# PLAN: Administration Service Management UI

Status: Approved

Approved spec: `specs/SPEC-admin-service-management-ui.md`

## Objective

Implement the approved Administration Service Management redesign: select one workspace, list only that workspace's services, create services reliably, edit existing services, preserve delete behavior, and fix environment tag entry so visible environment tags are submitted deterministically.

## Branch

- Target branch: current branch `workingspaces`.
- Do not create a new branch unless the user requests one before implementation.
- Preserve unrelated dirty worktree changes. At planning time, workspace-management files and existing `specs/` artifacts are already modified or untracked by other work.
- Keep commits out of scope unless the user explicitly requests a commit later.

## Architecture Approach

- Preserve the repository's DDD/onion dependency direction:
  - Express controller maps HTTP requests and responses.
  - `WorkspaceService` owns authorization and use-case orchestration.
  - `ServiceRepository` owns MySQL persistence and service/environment association mutations.
  - Browser `WorkspaceService` owns API calls and response parsing.
  - Browser `AppController` owns view state and form orchestration.
- Add an update-service backend contract instead of overloading create or delete.
- Use stable `service_id` for edit target identity.
- Reuse the existing selected-workspace catalog endpoint for list rendering.
- Do not add database schema changes unless implementation discovers an unavoidable current schema constraint; if that occurs, stop for spec/plan amendment before continuing.
- Do not implement reservation cleanup for removed service-environment associations because the approved spec marks existing reservations for removed associations as out of scope unless schema constraints require cleanup.

## UX/UI Direction

Use the `ui-ux-pro-max` design-system findings for a professional SaaS/admin dashboard:

- Data-dense admin layout with compact controls and scannable service rows/cards.
- Restrained existing palette and theme tokens rather than a new branded visual system.
- Workspace selector above the service list as the primary scope control.
- One create/edit surface for the selected workspace instead of repeated per-workspace forms.
- Responsive card or row layout, not a wide mobile-breaking table.
- Explicit labels, visible error regions, visible focus states, disabled styling, and stable hover states.

## Affected Files

- `src/controllers/WorkspaceController.ts`
- `src/services/WorkspaceService.ts`
- `src/repositories/ServiceRepository.ts`
- `public/ts/services/WorkspaceService.ts`
- `public/ts/controllers/AppController.ts`
- `public/index.html`
- `public/styles.css`
- `src/tests/unit/workspace-service.test.ts`
- `src/tests/integration/workspace-service-db.test.ts`
- `README.md` only if implementation introduces or documents admin workflow/API behavior; otherwise leave unchanged.

No planned edits:

- `config/schema/*`
- reservation claim/release/extend code
- workspace creation/invitation/user-management behavior
- unrelated workspace-management spec or implementation changes

## Backend Implementation Steps

1. Add a `WorkspaceService.updateService(...)` use case that:
   - asserts the requesting user is an admin of the workspace
   - validates service existence by selected workspace and stable `service_id`
   - trims and validates label, default minutes, owner, and environment names
   - rejects blank service label with `Service name required`
   - rejects no environments with `At least one environment is required`
   - rejects nonpositive default minutes with `Default minutes must be positive`
   - updates the existing service row without changing `service_id`
   - replaces the service's environment association set with the submitted environment names
   - reuses existing workspace environment rows by name
   - creates missing workspace environment rows
   - creates missing service-environment associations with keys `${serviceUuid}:${environmentUuid}`
   - deletes service-environment associations not present in the submitted environment set
   - runs the update in a transaction

2. Add repository methods in `ServiceRepository` as needed:
   - lookup service by workspace and `service_id` including row id, label, owner, and default minutes
   - update service metadata
   - list existing associations for a service
   - delete associations by service row id and excluded environment row ids, or replace associations deterministically
   - keep existing create/delete/list methods backward compatible

3. Add a controller route in `WorkspaceController`:
   - `PATCH /api/workspaces/:workspaceId/services/:serviceId`
   - request fields:
     - `label`
     - `default_minutes`
     - `owner`
     - `environment_names`
   - success response includes `service_id`
   - status mapping follows existing create/delete patterns:
     - `404` for `Workspace not found` or `Service not found`
     - `403` for `Not authorized for workspace`
     - `400` for validation errors

4. Do not alter existing `POST /api/workspaces/:workspaceId/services` or `DELETE /api/workspaces/:workspaceId/services/:serviceId` semantics except where shared helper extraction is required and behavior remains unchanged.

## Frontend Implementation Steps

1. In browser `WorkspaceService`, add `updateService(workspaceId, serviceId, input)` that calls the new `PATCH` route and surfaces backend errors consistently with create/delete.

2. In `AppController`, replace per-workspace visible create forms for the Service Management section with selected-workspace state:
   - `selectedServiceWorkspaceId`
   - selected workspace computed value
   - selected workspace catalog computed or loaded value
   - single create form state
   - edit form state keyed by stable `serviceId`
   - create/edit/delete submitting and error state scoped to selected workspace or selected row

3. Initialize and preserve workspace selection:
   - default to first available workspace when no selection exists
   - preserve selection across refresh when the workspace still exists
   - reset service form state and row errors when the selected workspace changes
   - load service catalog, environments, and owners for the selected workspace on selection and when entering Service Management

4. Fix environment tag handling:
   - ensure commit-by-comma, Enter, Space, blur, and submit all add visible tags
   - avoid writing stale form objects after `addEnvironmentTags`
   - dedupe tags case-insensitively within each form
   - make create and edit submit paths call the same deterministic environment resolver

5. Update `public/index.html` Service Management section:
   - workspace selector at the top
   - selected-workspace summary header
   - selected-workspace service list only
   - create service action/form for admins
   - edit action/form for one service at a time for admins
   - existing delete action for admins
   - non-admin message when selected workspace is view-only
   - empty state for no services in selected workspace

6. Update `public/styles.css`:
   - responsive selected-workspace service management layout
   - compact service rows/cards with metadata and actions
   - consistent input heights and spacing
   - clear disabled, hover, and focus-visible states
   - mobile-safe wrapping for long labels, owners, and environment names

## Test-First Subagent Assignment

Use exactly one clean-context test-focused subagent before production implementation.

Model requirement from workspace instructions: `gpt-5.3-codex-spark`.

Input context for the subagent:

- `specs/SPEC-admin-service-management-ui.md`
- this plan
- `src/services/WorkspaceService.ts`
- `src/repositories/ServiceRepository.ts`
- `src/tests/unit/workspace-service.test.ts`
- `src/tests/integration/workspace-service-db.test.ts`
- minimal entity/repository signatures needed to write tests

Assignment:

- Add or update deterministic tests before production implementation.
- Cover update-service validation:
  - requires workspace admin
  - requires nonblank label
  - requires at least one environment
  - requires positive default minutes
- Cover update-service persistence where supported by the existing database integration test pattern:
  - service `service_id` remains stable
  - label/default minutes/owner update
  - existing environment row is reused
  - new environment row is created
  - removed association no longer appears in the service catalog
- Add focused tests for environment tag state only if a practical frontend/controller test pattern exists; otherwise identify manual QA coverage.
- Do not implement production behavior.
- Report spec or plan conflicts instead of resolving them independently.

## Implementation Subagent Assignment

Use exactly one clean-context implementation subagent after test-first work.

Model requirement from workspace instructions: `gpt-5.3-codex-spark`.

Input context for the subagent:

- approved spec
- approved plan
- tests produced by the test-focused subagent
- exact files listed in this plan
- failing test output

Assignment:

- Implement only the backend, frontend, styling, and tests described in this plan.
- Do not perform product research, architecture research, scope discovery, or plan discovery.
- Preserve unrelated dirty worktree changes.
- Stop and escalate if implementation requires changing approved behavior or schema.

## Code-Review Subagent Assignment

Use exactly one clean-context code-review subagent after implementation.

Model requirement from workspace instructions: `gpt-5.3-codex-spark`.

Input context for the subagent:

- approved spec
- approved plan
- final diff
- relevant test results available at that point

Assignment:

- Review implementation against the approved spec and plan.
- Look for:
  - selected workspace scope leaks
  - missing admin authorization on create/edit/delete
  - edit operations that create replacement services or change `service_id`
  - environment tag loss or stale state writes
  - incorrect association replacement
  - broken create/delete behavior
  - accessibility gaps in labels, errors, and focus states
  - mobile overflow or overlapping text
  - onion architecture violations
  - missing tests for update-service behavior
- Do not implement fixes.
- Report findings with file and line references where possible.

## Main-Agent QA Requirements

After implementation and review findings are resolved, the main agent must run:

- `npm run build`
- `npm test`
- `git diff --check`

Manual QA when a dev server/browser is available:

- Start the app with `npm run dev` if a local database configuration is available.
- Open Administration.
- Click `Service Management`.
- Verify a workspace selector is visible and scopes the service list.
- Switch workspaces and verify only the selected workspace's services appear.
- As a workspace admin, create a service with environments committed by comma, Enter, Space, blur, and submit.
- Verify visible environment tags are included in the create request and service list refresh.
- Edit a service label, default minutes, owner, and environments.
- Verify the service keeps the same `service_id` and the updated environments appear.
- Remove an environment during edit and verify it no longer appears for that service.
- Verify delete still works for admins.
- Verify a non-admin member can view services but cannot create, edit, or delete.
- Check desktop and mobile widths for no horizontal overflow or text overlap.

If the dev server or browser QA is not possible because database configuration is unavailable, report that as unvalidated and mark implementation delivery draft unless the user explicitly accepts build/test-only validation.

## Documentation

- No README update is required for visual-only layout work.
- Update README only if the new `PATCH` service API or admin workflow is documented elsewhere or becomes user-facing documentation during implementation.
- Do not add unrelated documentation churn.

## Validation Pass Criteria

- TypeScript server and browser builds pass.
- Unit tests pass.
- Integration tests pass when `TEST_DATABASE_URL` and `TEST_DATABASE_ALLOW_TRUNCATE=1` are available; otherwise skipped database-backed tests must be reported.
- `git diff --check` passes.
- Review findings are resolved or explicitly accepted as out of scope.
- QA findings are resolved or explicitly accepted as out of scope.

## Commit And Push

- Do not commit or push during implementation unless the user explicitly asks.
- If the user later requests a commit and required validation/review/QA is incomplete, use a `DRAFT` commit summary.

## No-Research Implementation Constraint

The implementation command must not perform additional product, architecture, scope, or planning research. It may inspect only:

- approved spec
- approved plan
- applicable `AGENTS.md` and `~/workspace.md`
- files listed in this plan
- minimal local edit patterns needed to modify those files correctly
- test output and diffs needed to complete validation

## Completion Report Requirements

The implementation completion report must include:

- implemented spec summary
- review findings and resolutions
- QA findings and resolutions
- validation commands and results
- unvalidated areas
- documentation updates or rationale for none
- commit status
- push status
- final or draft delivery status
- final main-agent acceptance confirmation

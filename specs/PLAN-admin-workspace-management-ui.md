# PLAN: Administration Workspace Management UI

Status: Approved

Approved spec: `specs/SPEC-admin-workspace-management-ui.md`

## Objective

Implement the approved `Workspace Stat Popup Detail APIs Bug Fix` iteration for the Administration workspace management UI: clicking `Users`, `Services`, `Owners`, or `Environments` stat tags must fetch from dedicated `/detail/*` backend APIs and show only the corresponding names in the popup.

## Branch

- Target branch: current branch `workingspaces`.
- Do not create a new branch unless the user requests one before implementation.
- Preserve existing unrelated worktree changes.

## Architecture Approach

- Preserve onion architecture:
  - repository adapters own MySQL row queries
  - `WorkspaceService` owns authorization and resource-specific detail methods
  - `WorkspaceController` maps service output to HTTP JSON
  - browser `WorkspaceService` owns HTTP calls and response parsing
  - `AppController` owns modal state and display labels
- Add separate read-only workspace detail API routes:
  - `GET /api/workspaces/:workspaceId/detail/users`
  - `GET /api/workspaces/:workspaceId/detail/services`
  - `GET /api/workspaces/:workspaceId/detail/owners`
  - `GET /api/workspaces/:workspaceId/detail/environments`
- Each detail route returns `{ "items": [{ "name": string }] }`.
- Do not use the previous generic popup route `/api/workspaces/:workspaceId/:resourceType` as the frontend popup contract.
- Keep existing service-management routes unchanged:
  - `GET /api/workspaces/:workspaceId/services`
  - `GET /api/workspaces/:workspaceId/owners`
  - `GET /api/workspaces/:workspaceId/environments`
- Keep existing workspace authorization semantics for detail rows. The popup may list rows only for an authorized workspace member.
- Do not change workspace stat count semantics, create workspace behavior, invite behavior, owner/environment creation behavior, or service management behavior.

## Affected Files

- `src/services/WorkspaceService.ts`
- `src/controllers/WorkspaceController.ts`
- `src/repositories/ServiceRepository.ts`
- `public/ts/services/WorkspaceService.ts`
- `public/ts/controllers/AppController.ts`
- `public/index.html`
- `public/styles.css`
- `src/tests/unit/workspace-service.test.ts`
- `src/tests/integration/workspace-service-db.test.ts`
- `README.md` only if implementation discovers existing admin-workflow documentation that contradicts the fixed behavior; otherwise leave unchanged.

## Test-First Subagent Assignment

Use exactly one clean-context test-focused subagent before production implementation.

Model requirement from workspace instructions: `gpt-5.3-codex-spark`.

Input context for the subagent:

- `specs/SPEC-admin-workspace-management-ui.md`
- this plan
- existing workspace service and repository test files listed above
- minimal signatures for current `WorkspaceService`, `WorkspaceController`, `WorkspaceRepository`, and `ServiceRepository`

Assignment:

- Add or update deterministic tests for workspace detail row behavior covering:
  - users returns `{ name: email }` rows.
  - services returns `{ name: service label }` rows.
  - owners returns `{ name: owner name }` rows.
  - environments returns `{ name: environment name }` rows.
  - authorization is enforced before rows are returned.
  - detail rows are ordered by displayed name where repository behavior is testable.
- Add or update integration coverage where practical for service, owner, and environment detail data coming from the database.
- Add or update controller-level tests only if an existing practical Express/controller test pattern exists; otherwise report route response shape as covered by service/repository tests plus build/manual QA.
- Inspect whether there is a practical frontend test pattern for popup item parsing and rendering. If none exists, report frontend coverage as TypeScript build plus manual QA.
- Do not implement production behavior.
- Report blockers, missing repository helpers, route conflicts, or spec/plan conflicts.

## Implementation Subagent Assignment

Use exactly one clean-context implementation subagent after test-first work.

Model requirement from workspace instructions: `gpt-5.3-codex-spark`.

Input context for the subagent:

- approved spec
- approved plan
- failing or updated tests from the test-focused subagent
- exact files listed in this plan

Assignment:

1. In `WorkspaceService`, expose deterministic workspace detail methods or a constrained dispatcher that returns `Array<{ name: string }>` for:
   - users from workspace user emails
   - services from service labels
   - owners from owner names
   - environments from environment names
2. Preserve authorization by asserting workspace membership before returning any detail rows.
3. In `ServiceRepository`, add or reuse repository methods needed to list service labels, owner names, and environment names by workspace with ascending display-name ordering.
4. In `WorkspaceController`, add the four dedicated `GET /api/workspaces/:workspaceId/detail/*` routes. Each route must respond with `{ items }` on success and reuse existing workspace error mapping.
5. Ensure the dedicated detail routes do not shadow or alter existing service-management routes.
6. Remove frontend dependence on `WorkspaceService.listWorkspaceRows(workspaceId, resourceType)` calling `/api/workspaces/:workspaceId/:resourceType`.
7. In browser `WorkspaceService`, add explicit detail API methods or a constrained dispatcher that maps resource type to the approved `/detail/*` path and parses `{ items: [{ name }] }`.
8. In `AppController`, keep the existing popup loading, close, error, empty, request-id, and stale-result protections, but store and render item names rather than resource-specific row objects or ids.
9. In `public/index.html`, render each popup row as the item `name` only, with uppercase resource labels for title and empty state.
10. In `public/styles.css`, make only minimal overflow/wrapping adjustments needed for long popup names.
11. Do not change create workspace, invite user, create owner, create environment, or service management flows except where strictly required to avoid route or state regressions.

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
  - frontend still calling the old generic popup route
  - missing dedicated detail route for any of users, services, owners, or environments
  - response shape not matching `{ items: [{ name }] }`
  - popup rendering ids or metadata instead of names only
  - services, owners, or environments still not listing in the popup
  - route regressions affecting service catalog, owners, or environments management APIs
  - workspace access leaks
  - stale async popup fetch results overwriting closed or newer modal state
  - unnecessary changes to create/invite/service-management behavior
  - onion architecture violations
  - missing deterministic tests for backend popup detail rows
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
- Click `Workspace management`.
- For a workspace with data, click `Users`, `Services`, `Owners`, and `Environments`.
- Verify each popup opens above the page and lists the expected names only.
- Verify each popup title starts with `Users`, `Services`, `Owners`, or `Environments`.
- Verify empty states, if encountered, use the uppercase resource label.
- Verify closing a popup during loading does not reopen it or overwrite a later popup.
- Verify browser network calls use `/api/workspaces/:workspaceId/detail/users`, `/detail/services`, `/detail/owners`, or `/detail/environments` for the popup.
- Verify the existing create workspace, invite user, create owner, create environment, and Service Management flows still render normally.

If the dev server or browser QA is not possible because database configuration is unavailable, report that as unvalidated and mark delivery draft unless the user explicitly accepts build/test-only validation.

## Documentation

- No README update is expected for this bug fix unless implementation discovers existing admin-workflow documentation that says the opposite of the fixed behavior.
- Do not add unrelated documentation churn.

## Validation Pass Criteria

- TypeScript server and browser builds pass.
- Unit tests pass.
- Integration test behavior is preserved; database-backed integration tests may remain skipped unless `TEST_DATABASE_URL` and `TEST_DATABASE_ALLOW_TRUNCATE=1` are available.
- `git diff --check` passes.
- Review findings are either resolved or explicitly accepted as out of scope.
- QA findings are either resolved or explicitly accepted as out of scope.

## Commit And Push

- Do not commit or push during implementation unless the user explicitly asks.
- If the user later requests a commit and required validation/review/QA is incomplete, use a `DRAFT` commit summary.

## No-Research Implementation Constraint

The implementation command must not perform additional product, architecture, scope, or planning research. It may inspect only:

- approved spec
- approved plan
- applicable `AGENTS.md` and `~/workspace.md`
- files listed in this plan
- minimal local patterns needed to edit those files correctly
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
- whether final main-agent acceptance was completed

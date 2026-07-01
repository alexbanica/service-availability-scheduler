# Workspace Owner And Environment Deletion Implementation Plan

Status: Approved

## Approved Spec

- `specs/SPEC-workspace-owner-environment-deletion.md`

## Branch Policy

- Stay on the current branch unless the user explicitly requests a new branch.
- Preserve unrelated dirty worktree changes, including the existing unrelated
  `AGENTS.md` edit and API contract documentation spec/plan files.
- Do not commit or push unless the user explicitly requests it.

## Ownership Boundaries

- In scope:
  - workspace owner/environment delete API routes;
  - workspace service/repository delete behavior;
  - owner/environment popup row identifiers;
  - browser popup delete controls and confirmation state;
  - service-management state refresh after deletion;
  - focused tests for the approved behavior;
  - `swagger.yml` and `http/api.http` contract examples.
- Out of scope:
  - unrelated admin UI redesign;
  - workspace/user/service deletion changes beyond preserving existing service
    delete behavior;
  - new bulk actions;
  - commits, pushes, or branch changes without explicit user direction.

## Affected Files

- `src/services/WorkspaceService.ts`
- `src/repositories/ServiceRepository.ts`
- `src/controllers/WorkspaceController.ts`
- `public/ts/services/WorkspaceService.ts`
- `public/ts/controllers/AppController.ts`
- `public/index.html`
- `public/styles.css`
- `config/schema/services.sql`
- `config/migrations/*`
- `src/tests/unit/workspace-service.test.ts`
- `src/tests/integration/workspace-service-db.test.ts`
- `src/tests/unit/workspace-controller-missing-auth-user.test.ts`
- Browser/unit tests if existing patterns allow focused coverage for
  `public/ts` parsing or controller state.
- `swagger.yml`
- `http/api.http`

## Implementation Steps

1. Add test-first backend coverage.
   - Extend fake service repositories in `workspace-service.test.ts` with owner
     and environment delete operations.
   - Add tests for admin and manager success, member and non-member denial,
     missing workspace, missing owner, and missing environment.
   - Add tests that owner deletion detaches affected services without deleting
     them.
   - Add tests that environment deletion removes only matching associations and
     preserves affected services.
   - Update popup-row tests so owner rows include `ownerId` and environment rows
     include `environmentId` while retaining `name`.

2. Implement repository and service behavior.
   - Add repository methods to delete an owner by workspace and ID after setting
     matching `services.owner_id` to `NULL`.
   - Add repository methods to delete an environment by workspace and ID while
     deleting matching `service_environments` associations and preserving
     `services`.
   - Use transactions in `WorkspaceService` for each delete flow.
   - Gate both delete flows with the existing resource administrator role check.
   - Return deterministic not-found errors when no target row exists in the
     target workspace.
   - Expand owner/environment popup detail rows with stable identifiers.

3. Update schema and migrations as needed.
   - Ensure fresh schema supports owner deletion by using nullable owner
     references that can be detached before delete.
   - Add a deterministic migration if existing released schemas need foreign-key
     behavior adjusted for owner deletion or zero-environment service
     persistence.
   - Keep migration tracking conventions under `config/migrations`.

4. Add controller routes.
   - Add `DELETE /api/workspaces/:workspaceId/owners/:ownerId`.
   - Add `DELETE /api/workspaces/:workspaceId/environments/:environmentId`.
   - Map `Workspace not found` and target not-found errors to `404`.
   - Map workspace authorization failures to `403`.
   - Keep existing auth and activation middleware.
   - Extend missing-auth-user route coverage for the new endpoints.

5. Update browser service APIs.
   - Parse popup rows as `{ name, ownerId?, environmentId? }`.
   - Add `deleteOwner(workspaceId, ownerId)` and
     `deleteEnvironment(workspaceId, environmentId)` methods.
   - Preserve existing service delete API behavior.

6. Update browser popup UI.
   - Extend `workspaceRowsModal` row state with optional owner/environment IDs.
   - Render delete buttons next to owner and environment names only when the
     current workspace role is `admin` or `manager`.
   - Open a confirmation modal before sending owner/environment delete requests.
   - Reuse the existing deletion confirmation pattern where practical while
     keeping labels and submit text correct for service, owner, and environment
     actions.
   - Disable duplicate submission while deletion is pending.
   - Refresh the popup rows, workspace counts, service management options, and
     affected service state after successful deletion.
   - Preserve member read-only popup behavior and service delete confirmation.

7. Update service-management visibility.
   - Ensure service-management listing can represent services with no owner and
     services with zero environments after environment deletion.
   - Keep the reservation availability workflow unclaimable for
     zero-environment services because no service-environment row exists.
   - Preserve create/edit validation requiring at least one environment.

8. Update contract docs.
   - Document the two new delete endpoints in `swagger.yml`.
   - Expand popup row schema docs for owner/environment identifiers while
     retaining `name`.
   - Add `DELETE` examples for owner and environment resources in
     `http/api.http`.

9. Final review and QA.
   - Review the diff for spec match, role leakage, cross-workspace isolation,
     accidental service deletion, and stale UI state.
   - Run validation commands listed below.
   - Fix in-scope issues discovered by review or validation.

## Test-First And Subagent Requirements

- Test-first is applicable because this changes workspace resource business
  behavior and persistence semantics.
- Use exactly one clean-context test-focused subagent before production
  implementation if implementation starts from this plan.
- Use no more than one active implementation worker for production changes.
- Use no more than one active review subagent after implementation.
- Subagents must use `gpt-5.3-codex-spark` per workspace instructions.
- The main agent owns final QA and validation.

## Validation Commands

- `npm run lint`
- `npm run build`
- `npm test`
- `git diff --check`

Run `npm run build` and `npm test` sequentially because this repository's build
process can remove/reinstall `node_modules`.

## Documentation

- Required: `swagger.yml` and `http/api.http`.
- Not required unless implementation reveals a documented operational behavior
  change: README or AGENTS updates.

## Commit And Push

- Do not commit or push by default.
- If the user later requests a commit, run `npm run format` first and commit
  only accepted in-scope changes.

## No-Research Constraint For Implementation

Implementation must use this approved plan, the approved spec, repository
instructions, current branch/worktree state, and directly affected local files.
Do not reopen product discovery or change approved behavior during
implementation. If implementation reveals a spec or plan conflict, stop and ask
for an amendment.

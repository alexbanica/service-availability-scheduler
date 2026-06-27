# PLAN: Administration Workspace Management UI

Status: Approved

Approved spec: `specs/SPEC-admin-workspace-management-ui.md`

## Objective

Implement the approved Administration workspace management UI behavior: administered workspace list with backend-provided user and service stats, an email-only invite modal structured for future invited-user fields, and a workspace-name-only create-workspace modal structured for future workspace fields.

## Branch

- Target branch: current branch `workingspaces`.
- Do not create a new branch unless the user requests one before implementation.
- Preserve existing unrelated worktree changes, including the currently modified `package.json`, unless implementation directly requires changing them.

## Architecture Approach

- Preserve onion architecture:
  - repository layer owns MySQL aggregation queries
  - service layer exposes workspace summaries for the authenticated user
  - controller maps service output to API response fields
  - browser service/entity/controller consume the API contract
- Extend the existing `/api/workspaces` response with additive stat fields:
  - `user_count`
  - `service_count`
- Keep existing invitation endpoint and backend invitation semantics unchanged.
- Reuse the existing modal overlay/card styling pattern where practical, with workspace-invite-specific classes only where needed.
- Keep workspace creation in the Workspace management section through a button-triggered modal, not a persistent card or column, so the administered workspace list remains the primary right-hand content.
- Reuse the existing modal overlay/card styling pattern for both invitation and workspace creation, with flow-specific classes only where needed.

## Affected Files

- `src/entities/Workspace.ts`
- `src/repositories/WorkspaceRepository.ts`
- `src/services/WorkspaceService.ts`
- `src/controllers/WorkspaceController.ts`
- `public/ts/entities/Workspace.ts`
- `public/ts/services/WorkspaceService.ts`
- `public/ts/controllers/AppController.ts`
- `public/index.html`
- `public/styles.css`
- `src/tests/unit/workspace-service.test.ts`
- `src/tests/integration/workspace-service-db.test.ts`
- `README.md` only if implementation adds user-facing workflow notes; otherwise leave unchanged.

## Test-First Subagent Assignment

Use exactly one clean-context test-focused subagent before production implementation.

Model requirement from workspace instructions: `gpt-5.3-codex-spark`.

Input context for the subagent:

- `specs/SPEC-admin-workspace-management-ui.md`
- this plan
- existing test files listed above
- minimal repository/entity/service/controller signatures needed to write tests

Assignment:

- Add or update deterministic tests for workspace summary stats.
- Cover that workspace summaries expose administered/member workspaces for the user with `user_count` and `service_count`.
- Cover that workspace creation still works with the extended workspace entity/summary shape if existing tests are affected.
- Inspect whether there is a practical frontend controller/modal test pattern for workspace creation modal state. If none exists, report test-first coverage as not practical for the frontend modal and rely on TypeScript build plus main-agent manual QA for that UI behavior.
- Do not implement production behavior.
- Report any spec or plan conflicts instead of resolving them independently.

## Implementation Subagent Assignment

Use exactly one clean-context implementation subagent after test-first work.

Model requirement from workspace instructions: `gpt-5.3-codex-spark`.

Input context for the subagent:

- approved spec
- approved plan
- failing or updated tests from the test-focused subagent
- exact files listed in this plan

Assignment:

1. Extend workspace domain/entity shape to carry `userCount` and `serviceCount`.
2. Update `WorkspaceRepository.listByUser` to return workspace rows with:
   - `COUNT(DISTINCT wu_stats.user_id)` as user count
   - `COUNT(DISTINCT s.id)` as service count
   while preserving membership filtering to the signed-in user and stable ordering.
3. Keep `findById`, `insert`, and `countByAdmin` behavior compatible with the updated entity constructor.
4. Update `WorkspaceController` to include `user_count` and `service_count` in `/api/workspaces`.
5. Update browser `Workspace` entity and `public/ts/services/WorkspaceService.ts` parsing with numeric fallbacks.
6. In `AppController`:
   - replace per-workspace inline invite state with modal state:
     - selected invite workspace
     - invite email
     - invite error
     - invite submitting
     - modal open/close/reset methods
   - keep existing `WorkspaceService.invite` call
   - reset modal state on open success, close, cancel, and successful submission
   - replace persistent workspace creation form state usage with create-workspace modal state:
     - create modal open flag
     - workspace name
     - workspace error
     - workspace submitting
     - modal open/close/reset/cancel methods
   - keep existing `WorkspaceService.create` call
   - reset workspace creation modal state on open, close, cancel, and successful submission
   - refresh workspaces after successful workspace creation so stats remain current
7. In `public/index.html`:
   - make the admin workspace list the primary content in the right-hand block
   - show workspace name, id, user count, service count, and `Invite user`
   - replace the persistent create-workspace card/column with a `Create workspace` button in the Workspace management header or workspace-list action area
   - add an invite modal with `role="dialog"`, `aria-modal="true"`, labeled email input, close/cancel controls, submit progress text, and modal error region
   - add a create-workspace modal with `role="dialog"`, `aria-modal="true"`, labeled workspace name input, close/cancel controls, submit progress text, and modal error region
   - structure the create-workspace modal body as a form area where future workspace fields can be added after workspace name without changing the trigger or submit flow
   - ensure pressing Enter in the workspace name input submits the create-workspace modal form
8. In `public/styles.css`:
   - style the workspace list as responsive cards or rows that do not overflow mobile widths
   - ensure the workspace list card/list spans the available admin content width and is not constrained by a persistent create-workspace column
   - style the create-workspace action and modal consistently with the invite modal and existing theme tokens
   - use existing color tokens and theme variables
   - provide clear hover/focus states
   - avoid a wide table layout
9. Do not change invitation acceptance, user lookup, email sending, roles, or bulk invite behavior.
10. Do not change workspace creation authorization, backend endpoint semantics, workspace limit behavior, or successful list refresh semantics.
11. Do not modify unrelated `package.json` changes unless they are required to compile or test this implementation.

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
  - missing or incorrect stats semantics
  - workspace access leaks
  - broken workspace creation or invitation behavior
  - frontend state that can leak stale email/error/submitting state between workspaces
  - frontend state that can leak stale workspace name/error/submitting state between create-workspace modal opens
  - modal accessibility gaps
  - mobile overflow or text overlap risks
  - the workspace creation form remaining as a persistent card/column instead of moving behind a button-triggered modal
  - onion architecture violations
  - missing tests for stats contract
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
- Verify the right-hand block lists administered workspaces with user and service counts.
- Verify the create-workspace form is not visible as a persistent card or column.
- Verify `Create workspace` is available as a button near the Workspace management header or workspace-list action area.
- Verify the list fits desktop and mobile widths without horizontal overflow.
- Click `Create workspace`.
- Verify the modal opens above the page, has `role="dialog"`/`aria-modal="true"`, contains a labeled workspace name field, and has close/cancel controls.
- Submit blank workspace name and verify the existing workspace-name-required client validation appears without an API request.
- Type a workspace name and press Enter; verify the submit path runs.
- Create a workspace and verify the modal closes, `Workspace created.` appears, and the workspace list refreshes with `1` user and `0` services.
- Reopen `Create workspace` and verify the workspace name and error state are reset.
- Click `Invite user` for a workspace.
- Verify the modal opens above the page, names the workspace, and contains a labeled email field.
- Submit blank email and verify `Email is required.` appears without an API request.
- Submit an existing invitee email and verify success toast plus modal close.
- Submit a duplicate/member/unknown email case when data is available and verify the modal remains open with backend error text.

If the dev server or browser QA is not possible because database configuration is unavailable, report that as unvalidated and mark delivery draft unless the user explicitly accepts build/test-only validation.

## Documentation

- No README update is required for the visual/admin workflow change unless implementation introduces new setup, API usage documentation, or user-facing admin workflow documentation.
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
- final main-agent acceptance confirmation

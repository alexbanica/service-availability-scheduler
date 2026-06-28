# PLAN: Delete Action Confirmations

Status: Approved

Approved spec: `specs/SPEC-delete-action-confirmations.md`

## Objective

Implement the approved delete-confirmation behavior so user-visible destructive delete actions prompt for explicit confirmation before sending any backend delete request, starting with the current Service Management service delete action.

## Branch

- Target branch: current branch `workingspaces`.
- Do not create a new branch unless the user requests one before implementation.
- Preserve unrelated dirty worktree changes. At planning time, existing admin UI files, backend service files, test files, and other spec/plan artifacts are already modified by other work.
- Keep commits out of scope unless the user explicitly requests a commit later.

## Architecture Approach

- Keep confirmation behavior in the browser UI layer because the requirement is user interaction before invoking an existing destructive API call.
- Preserve the existing DDD/onion dependency direction:
  - no backend domain or repository dependency on browser confirmation behavior
  - no backend contract change for service deletion
  - no change to `WorkspaceService.deleteService` request semantics
- Prefer an in-page confirmation modal consistent with existing admin modal behavior.
- Use browser-native `confirm(...)` only if implementation discovers that existing modal state cannot be safely extended without a larger UI refactor; if that fallback is used, document it in the completion report.
- Keep future delete actions easy to route through the same frontend confirmation state or helper.

## Affected Files

- `public/ts/controllers/AppController.ts`
- `public/index.html`
- `public/styles.css`
- `public/ts/services/WorkspaceService.ts` only if implementation needs a test seam or type refinement without changing delete semantics
- `README.md` only if admin workflow documentation explicitly describes delete behavior; otherwise leave unchanged

No planned edits:

- `src/controllers/WorkspaceController.ts`
- `src/services/WorkspaceService.ts`
- `src/repositories/ServiceRepository.ts`
- database schema or seed files
- reservation claim, release, or extend flows
- workspace creation, invitation, owner creation, or environment creation semantics

## Test-First Subagent Assignment

Use exactly one clean-context test-focused subagent before production implementation.

Model requirement from workspace instructions: `gpt-5.3-codex-spark`.

Input context for the subagent:

- `specs/SPEC-delete-action-confirmations.md`
- this plan
- `public/ts/controllers/AppController.ts`
- `public/index.html`
- `public/ts/services/WorkspaceService.ts`
- existing test files only if a practical frontend/controller test pattern exists

Assignment:

- Determine whether the repository has a practical automated frontend/controller test pattern for browser confirmation behavior.
- If a practical pattern exists, add deterministic tests before production implementation covering:
  - pressing Service Management `Delete` opens confirmation before `WorkspaceService.deleteService` is called
  - canceling confirmation does not call `WorkspaceService.deleteService`
  - confirming confirmation calls the existing delete flow
  - duplicate confirm while submitting is prevented
- If no practical frontend/controller test pattern exists, report that automated frontend confirmation coverage is unsupported and define the manual QA checks from the approved spec as the test coverage path.
- Do not implement production behavior.
- Report spec or plan conflicts instead of resolving them independently.

## Implementation Subagent Assignment

Use exactly one clean-context implementation subagent after test-first work.

Model requirement from workspace instructions: `gpt-5.3-codex-spark`.

Input context for the subagent:

- approved spec
- approved plan
- tests produced by the test-focused subagent, if any
- `public/ts/controllers/AppController.ts`
- `public/index.html`
- `public/styles.css`
- `public/ts/services/WorkspaceService.ts` only if needed by the accepted test seam or type refinement

Assignment:

1. Add delete-confirmation state in `AppController` for the pending destructive action:
   - selected action type
   - target workspace id
   - target service id
   - target label or fallback identifier
   - submitting state
   - visible error state only if needed for confirmed-delete failures
2. Replace the current Service Management delete button behavior so pressing `Delete` opens the confirmation prompt instead of directly calling `WorkspaceService.deleteService`.
3. Add cancel/close behavior that resets pending confirmation state and sends no delete request.
4. Add confirm behavior that:
   - verifies selected workspace and workspace-admin authorization using the same checks as the existing delete flow
   - calls the existing `WorkspaceService.deleteService` only after explicit confirmation
   - prevents duplicate submission while the delete request is in flight
   - preserves existing successful-delete behavior: reset active edit form for the deleted service, show `Service deleted.`, and reload selected-workspace service data
   - preserves existing failed-delete behavior through the current toast or equivalent visible error path
5. Expose the confirmation state and handlers to the Vue template.
6. Add an in-page confirmation modal in `public/index.html`:
   - uses `role="dialog"` and `aria-modal="true"`
   - names the destructive action
   - identifies the target service by label when available, otherwise by `service_id`
   - provides explicit cancel and confirm controls
   - keeps controls keyboard reachable
7. Add CSS in `public/styles.css` only as needed to match existing admin modal styling, disabled states, focus states, and responsive behavior.
8. Do not change backend delete authorization, routes, persistence behavior, or response semantics.

## Code Review Subagent Assignment

Use exactly one clean-context code-review subagent after production implementation.

Model requirement from workspace instructions is not specified for review agents, but keep the assignment clean-context and scoped.

Input context for the subagent:

- approved spec
- approved plan
- implementation diff
- relevant snippets from affected files

Assignment:

- Review the delivered changes against the approved spec and plan.
- Identify missing confirmation coverage, accidental backend semantic changes, authorization regressions, duplicate-submission risks, modal accessibility regressions, and conflicts with unrelated dirty worktree changes.
- Do not implement fixes.
- Report findings with file and line references.

## Main-Agent QA And Validation

After implementation and review findings are resolved, the main agent must run:

- `npm run build`
- `npm test`
- `git diff --check`

Manual QA requirements when a dev server/browser is available:

- Open Administration `Service Management`.
- Select a workspace with at least one service.
- Press the service-row `Delete` action and verify a confirmation prompt appears before any delete request is sent.
- Cancel or close the confirmation and verify the service remains listed and `Service deleted.` is not shown.
- Press `Delete` again, confirm, and verify the existing successful-delete behavior: service disappears after refresh, active edit state for that service is cleared, and `Service deleted.` is shown.
- Force or simulate a failed confirmed delete when practical and verify the existing error behavior remains visible.
- Verify the confirmation modal is keyboard reachable and usable at common mobile and desktop widths without text overlap or horizontal overflow.

## Documentation Requirements

- Update `README.md` only if it already documents Service Management delete behavior and would become stale.
- Do not add unrelated documentation churn.

## Commit And Push

- Do not commit or push unless the user explicitly requests it after implementation, review, and QA.
- If a commit is later requested and required validation, review, or QA is skipped, blocked, incomplete, or failing, use a `DRAFT` commit summary.

## No-Research Implementation Constraints

- Implementation must use only the approved spec, this approved plan, applicable instructions, the affected files listed above, tests created by the test-focused subagent, and minimal local edit patterns needed to modify those files.
- Do not perform product research, architecture research, scope discovery, or plan discovery during implementation.
- Stop for spec or plan amendment if implementation requires changing approved behavior.

# PLAN: Overview Active Claims Unclaim Confirmation

Status: Approved

Approved spec: `specs/SPEC-overview-active-claims-unclaim-confirmation.md`

## Objective

Implement the approved Overview active-claims behavior: each active claim shown in the Overview card must include workspace context and activate a confirmation popup before unclaiming through the existing release flow.

## Branch

- Target branch: current branch `main`.
- Do not create a new branch unless the user requests one before implementation.
- Preserve unrelated dirty worktree changes, including the existing `.codex/tasks` change observed during planning.
- Do not commit or push unless the user explicitly requests it after implementation, review, and QA.

## Architecture Approach

- Keep the change in the browser UI layer because it is a presentation and confirmation-flow change before calling an existing API.
- Preserve the existing DDD/onion dependency direction:
  - no backend domain, controller, service, repository, schema, or API contract changes
  - no change to `ReservationService.release(serviceKey)` semantics
  - no generated `public/js` bundle edits
- Use an in-page modal consistent with the app's existing modal pattern.
- Reuse the existing successful release behavior for confirmed Overview unclaim: call `ReservationService.release`, reload services, and show `Service released.`.
- Keep Service Availability `Release` buttons on their existing direct-release path, per approved spec.

## Affected Files

- `public/ts/controllers/AppController.ts`
- `public/index.html`
- `public/styles.css` only if needed for active-claim button layout, disabled state, modal spacing, or responsive polish
- `README.md` only if it already documents Overview active-claim or release behavior that would become stale

No planned edits:

- `public/js/**`
- `src/controllers/**`
- `src/services/**`
- `src/repositories/**`
- `config/schema/**`
- `config/seed/**`
- backend reservation tests, unless implementation uncovers an unexpected type or contract issue that requires plan amendment

## Test-First Subagent Assignment

Use exactly one clean-context test-focused subagent before production implementation.

Model requirement from workspace instructions: `gpt-5.3-codex-spark`.

Input context for the subagent:

- `specs/SPEC-overview-active-claims-unclaim-confirmation.md`
- this plan
- `public/ts/controllers/AppController.ts`
- `public/index.html`
- `public/ts/services/ReservationService.ts`
- existing `src/tests/**` files only to confirm whether a practical frontend/controller test pattern exists

Assignment:

1. Determine whether the repository has a practical automated frontend/controller test pattern for Vue/browser modal behavior.
2. If a practical pattern exists without adding broad new test infrastructure, add deterministic tests before production implementation covering:
   - Overview active-claim row exposes workspace context
   - activating a row opens confirmation before `ReservationService.release` is called
   - cancel/close does not call `ReservationService.release`
   - confirm calls `ReservationService.release` with the selected `serviceKey`
   - duplicate confirm while submitting is prevented
3. If no practical frontend/controller test pattern exists, report that automated frontend confirmation coverage is unsupported and define the approved manual QA checks as the test coverage path.
4. Do not implement production behavior.
5. Report spec or plan conflicts instead of resolving them independently.

## Implementation Subagent Assignment

Use exactly one clean-context implementation subagent after test-first work.

Model requirement from workspace instructions: `gpt-5.3-codex-spark`.

Input context for the subagent:

- approved spec
- approved plan
- test-focused subagent output and any tests it created
- `public/ts/controllers/AppController.ts`
- `public/index.html`
- `public/styles.css`
- `public/ts/services/ReservationService.ts` only for existing release API reference

Assignment:

1. Add typed pending Overview unclaim state in `AppController` containing at minimum:
   - `serviceKey`
   - service label
   - environment name
   - workspace name
   - submitting state
   - optional visible error state if using modal-local errors instead of toast-only failures
2. Add handlers in `AppController`:
   - open the pending unclaim popup from an Overview active-claim item
   - close/cancel and clear pending state without calling release
   - confirm unclaim with duplicate-submission protection
3. Implement confirm behavior by reusing existing release semantics:
   - call `ReservationService.release(pending.serviceKey)`
   - call `loadServices()` after success
   - clear/close pending popup after success
   - show `Service released.`
   - on failure, show the existing error message via toast or an equivalent visible modal error and clear the submitting flag
4. Expose the new pending state and handlers to the Vue template.
5. Update the Overview `Your active claims` markup in `public/index.html`:
   - render each active claim as a keyboard-reachable activatable control
   - display service label, environment name, and `Workspace: {{ item.service.workspaceName }}`
   - open the pending unclaim popup on activation
6. Add a confirmation modal in `public/index.html`:
   - use `role="dialog"` and `aria-modal="true"`
   - ask whether to unclaim the selected claim
   - identify service, environment, and workspace
   - provide explicit cancel/no and confirm/yes controls
   - disable confirm and close controls as appropriate while submitting
7. Add or adjust `public/styles.css` only as needed:
   - maintain the existing Overview visual style
   - keep button rows readable as controls
   - prevent text overlap and horizontal overflow on mobile and desktop
8. Preserve the existing Service Availability release buttons and the existing `release(serviceKey)` handler behavior outside the new Overview confirmation flow.
9. Do not edit generated browser bundles under `public/js`.

## Code Review Subagent Assignment

Use exactly one clean-context code-review subagent after production implementation.

Input context for the subagent:

- approved spec
- approved plan
- implementation diff
- relevant snippets from affected files

Assignment:

- Review the delivered changes against the approved spec and plan.
- Identify missing workspace display, accidental backend/API changes, release-flow regressions, duplicate-submission risks, modal accessibility regressions, Service Availability release behavior regressions, generated-bundle edits, and conflicts with unrelated dirty worktree changes.
- Do not implement fixes.
- Report findings with file and line references.

## Main-Agent QA And Validation

After implementation and review findings are resolved, the main agent must run:

- `npx tsc -p tsconfig.client.json --noEmit`
- `npm run build`
- `npm test`
- `git diff --check`

Manual QA requirements when a dev server/browser is available:

- Open Overview with at least one claim owned by the current user.
- Verify every active-claim row shows service, environment, and `Workspace: <name>`.
- Activate an Overview active-claim row and verify the unclaim confirmation popup opens before any release request is sent.
- Cancel or close the popup and verify the claim remains active and `Service released.` is not shown.
- Activate the row again, confirm, and verify the selected claim is released, the Overview count/list refreshes, and `Service released.` is shown.
- Double-click or repeatedly press confirm while submitting and verify duplicate release requests are prevented.
- Force or simulate a failed confirmed release when practical and verify a visible error appears without success messaging.
- Verify Service Availability release buttons still behave directly as before this spec.
- Verify the active-claim rows and popup are keyboard reachable and usable at common mobile and desktop widths without text overlap or horizontal overflow.

## Documentation Requirements

- Update `README.md` only if it already documents Overview active-claim behavior or the release/unclaim workflow in a way that would become stale.
- Do not add unrelated documentation churn.

## Commit And Push

- Do not commit or push unless the user explicitly requests it after implementation, review, and QA.
- If a commit is later requested and required validation, review, or QA is skipped, blocked, incomplete, or failing, use a `DRAFT` commit summary.

## No-Research Implementation Constraints

- Implementation must use only the approved spec, this approved plan, applicable instructions, the affected files listed above, tests created by the test-focused subagent if any, and minimal local edit patterns needed to modify those files.
- Do not perform product research, architecture research, scope discovery, or plan discovery during implementation.
- Stop for spec or plan amendment if implementation requires changing approved behavior.

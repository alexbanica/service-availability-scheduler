# Self-Service Account Deletion Implementation Plan

Status: Approved

Approved spec:
`specs/SPEC-self-service-account-deletion.md`

## Objective

Implement the approved self-service account-deletion contract without expanding
or reinterpreting its product behavior. Delivery includes deterministic
test-first coverage, atomic database deletion, current-user authentication
existence checks, the authenticated API, the browser confirmation flow, API and
user documentation, independent review, main-agent QA, commit, and push.

## Implementation Constraints

- Implementation starts only in a fresh session, after context is cleared, or
  after the user explicitly confirms same-context implementation.
- Implementation research is limited to the approved spec, this plan,
  applicable instructions, current branch/worktree state, files listed here,
  and minimal local edit patterns needed to perform the approved work.
- Workers must not perform product research, architecture research, scope
  discovery, planning research, or plan discovery.
- The implementation must stop for a spec or plan amendment if the approved
  behavior cannot be implemented as written.
- Preserve unrelated user changes and do not commit credentials, `.env` files,
  database dumps, `node_modules`, `dist`, or generated `public/js` bundles.
- The account target always comes from server-authenticated identity.
- The shared-owned-workspace conflict and deletion execute atomically.
- No database migration is planned because the existing schema supports ordered
  transactional deletion. A schema change discovered to be necessary requires
  stopping for plan amendment rather than silently adding a migration.
- Test-first development applies to account-deletion rules, data integrity,
  authentication invalidation, API behavior, and browser workflow because they
  change business, security, and user-visible behavior.
- Test-first development is not separately applicable to documentation-only
  edits; those are validated against the approved contract and implementation.

## Expected Files

### Approved Artifacts And Guidance

- `specs/SPEC-self-service-account-deletion.md`
- `specs/PLAN-self-service-account-deletion.md`
- `AGENTS.md`

### Server Production

- `src/repositories/AccountDeletionRepository.ts` (new)
- `src/services/AccountDeletionService.ts` (new)
- `src/controllers/AccountController.ts` (new)
- `src/controllers/AuthMiddleware.ts`
- `src/controllers/AuthController.ts`
- `src/service-availability-scheduler.ts`

`AuthController.ts` is listed only for registering the existing authentication
dependencies needed by current-user existence validation if the minimal local
pattern requires that registration there. Account deletion itself belongs in
the dedicated account controller.

### Browser Production

- `public/ts/services/ApiService.ts`
- `public/ts/services/AuthService.ts`
- `public/ts/controllers/AppController.ts`
- `public/index.html`
- `public/styles.css`

### Tests

- `src/tests/unit/account-deletion-service.test.ts` (new)
- `src/tests/unit/account-deletion-controller.test.ts` (new)
- `src/tests/unit/auth-middleware-controller.test.ts`
- `src/tests/unit/activation-gated-endpoints.test.ts`
- `src/tests/unit/browser-auth-services.test.ts`
- `src/tests/unit/app-controller-renewal-scheduling.test.ts`
- `src/tests/integration/account-deletion-db.test.ts` (new)

Existing test files may be adjusted only where the stricter authentication
dependency or new browser service contract requires their fixtures to provide
the same runtime dependency. Unrelated test behavior must remain unchanged.

### Contracts And Documentation

- `swagger.yml`
- `http/api.http`
- `README.md`

## Intended Component Boundaries

- `AccountDeletionRepository` owns SQL needed to identify blocking owned
  workspaces and delete the approved row categories through a supplied
  transaction connection. It does not accept a client-selected target user.
- `AccountDeletionService` owns confirmation normalization, current-user lookup,
  the transaction boundary, conflict handling, ordered deletion, rollback, and
  the exact shared-workspace conflict result.
- `AccountController` owns `DELETE /api/users/me`, request-shape validation,
  authenticated identity extraction, and mapping deterministic service outcomes
  to `204`, `400`, `401`, `409`, or `500`.
- `AuthMiddleware` continues to verify the JWT and additionally resolves the
  token's user ID against the database before accepting authentication. Runtime
  composition must always provide that dependency. The authenticated identity
  used downstream is aligned with the current database user.
- `AuthService` and `ApiService` own the browser request and token clearing;
  `AppController` owns modal state, user-scoped browser-state cleanup, timer and
  event shutdown, error persistence, and redirect orchestration.
- The existing generic resource-delete modal remains unchanged. Account
  deletion uses dedicated state because it requires typed confirmation and has
  different session consequences.

## Dependency-Aware Work Graph

The main agent supervises all agents, dependencies, active-work limits,
integration points, and handoffs. Maximum planned concurrency is three active
test-focused agents, three active implementation agents, and two active review
agents. This stays within both the repository limit of five agents per type and
the available session capacity. Every assignment is sized for no more than five
minutes of active subagent work.

### Test-First Units

#### T1 - Account Deletion Service Rules

- Type: test-focused.
- Boundary: confirmation normalization, missing-user handling, conflict
  short-circuit, commit, rollback, and exact conflict result.
- Owned files: `src/tests/unit/account-deletion-service.test.ts`.
- Dependencies: approved spec and plan only.
- Acceptance criteria: deterministic failing tests describe the service
  contract without production implementation and do not duplicate SQL adapter
  assertions.
- Validation: run only this test file and confirm failures are attributable to
  missing approved production behavior.
- Assignment: one clean-context test-focused subagent, maximum five minutes.

#### T2 - Account Deletion Database Integrity

- Type: test-focused integration.
- Boundary: real-schema conflict preservation, sole-owned workspace cleanup,
  shared-workspace preservation, all attributable row categories, reservation
  release by deletion, and transaction rollback evidence.
- Owned files: `src/tests/integration/account-deletion-db.test.ts`.
- Dependencies: approved spec and plan only.
- Acceptance criteria: deterministic fixtures cover both user-ID and normalized
  email matching and prove no mutation on `409`.
- Validation: run only this integration test with the documented test-database
  environment when available; otherwise report the environment blocker while
  preserving the authored test.
- Assignment: one clean-context test-focused subagent, maximum five minutes.

#### T3 - Authentication And API Contract

- Type: test-focused.
- Boundary: exact request validation/status mapping, activated and non-activated
  access, deleted-user JWT rejection, `/api/me` and `/api/renew` rejection, and
  downstream protected-route regression behavior.
- Owned files: `src/tests/unit/account-deletion-controller.test.ts`,
  `src/tests/unit/auth-middleware-controller.test.ts`, and
  `src/tests/unit/activation-gated-endpoints.test.ts`.
- Dependencies: approved spec and plan only.
- Acceptance criteria: tests cover `204`, all specified `400` cases, `401`, the
  exact `409` body, `500`, and the mandatory runtime current-user dependency.
- Validation: run the three owned unit-test files and confirm expected
  pre-production failures.
- Assignment: one clean-context test-focused subagent, maximum five minutes.

#### T4 - Browser Confirmation And Session Cleanup

- Type: test-focused.
- Boundary: DELETE payload transport, typed-email gating, dedicated modal state,
  persistent `409` message, failure session preservation, duplicate-submit
  prevention, user-scoped storage cleanup, event/timer shutdown, and successful
  redirect.
- Owned files: `src/tests/unit/browser-auth-services.test.ts` and
  `src/tests/unit/app-controller-renewal-scheduling.test.ts`.
- Dependencies: approved spec and plan only.
- Acceptance criteria: browser tests exercise behavior rather than relying only
  on source-text assertions and retain existing renewal/activation coverage.
- Validation: run the two owned browser test files and confirm expected
  pre-production failures.
- Assignment: one clean-context test-focused subagent, maximum five minutes.

### Development Units

#### D1 - Account Deletion Application Service

- Type: implementation.
- Boundary: service contract, normalized confirmation, current-user lookup,
  transaction orchestration, conflict result, commit, and rollback.
- Owned files: `src/services/AccountDeletionService.ts`.
- Dependencies: T1 completed.
- Acceptance criteria: T1 passes; no SQL, Express, or browser dependencies leak
  into confirmation and orchestration behavior beyond the established database
  transaction boundary pattern.
- Validation: T1 and focused TypeScript server check.
- Assignment: one clean-context implementation subagent, maximum five minutes.

#### D2 - Account Deletion Persistence Adapter

- Type: implementation.
- Boundary: blocking-workspace query and ordered deletes for owned workspace and
  attributable user data using parameterized SQL on the supplied connection.
- Owned files: `src/repositories/AccountDeletionRepository.ts`.
- Dependencies: T2 completed.
- Acceptance criteria: T2 passes against an available test database; deletes
  are scoped exactly by current user ID, normalized email, owned workspace IDs,
  and captured service-environment keys.
- Validation: T2 plus focused TypeScript server check. If database execution is
  unavailable, static/type validation is recorded and integration validation
  remains explicitly blocked.
- Assignment: one clean-context implementation subagent, maximum five minutes.

#### D3 - Authenticated API And Immediate Token Invalidation

- Type: implementation.
- Boundary: account controller, strict body/status mapping, database-backed
  current-user authentication, runtime dependency registration, and composition
  of the account-deletion service.
- Owned files: `src/controllers/AccountController.ts`,
  `src/controllers/AuthMiddleware.ts`, `src/controllers/AuthController.ts`, and
  `src/service-availability-scheduler.ts`.
- Dependencies: T3, D1, and D2 completed.
- Acceptance criteria: T3 passes; current valid users retain normal behavior;
  deleted or missing users receive `401` on every protected route; the endpoint
  does not require activation.
- Validation: T3, affected authentication/controller tests, and focused server
  TypeScript check.
- Assignment: one clean-context implementation subagent, maximum five minutes.

#### D4 - Browser Deletion Workflow

- Type: implementation.
- Boundary: DELETE body support, browser account-deletion service, dedicated
  confirmation modal, exact conflict display, state cleanup, stopping background
  work, and login redirect.
- Owned files: `public/ts/services/ApiService.ts`,
  `public/ts/services/AuthService.ts`, `public/ts/controllers/AppController.ts`,
  `public/index.html`, and `public/styles.css`.
- Dependencies: T4 completed. It may proceed in parallel with D1 and D2 because
  the API contract is fixed by the approved spec; final integration waits for
  D3.
- Acceptance criteria: T4 passes; existing logout, token renewal, activation
  banner, and generic delete confirmation behavior remain green.
- Validation: T4 and focused browser TypeScript check.
- Assignment: one clean-context implementation subagent, maximum five minutes.

#### D5 - Contract And Documentation Alignment

- Type: documentation/contract implementation.
- Boundary: OpenAPI operation/schema/responses, authenticated HTTP example,
  README behavior, and durable authorization/workspace-deletion guidance.
- Owned files: `swagger.yml`, `http/api.http`, `README.md`, and `AGENTS.md`.
- Dependencies: approved spec and plan. Final verification depends on D3 and D4.
- Acceptance criteria: exact path, body, status codes, `409` text, pre-activation
  access, local-vs-external deletion limits, and shared-workspace prerequisite
  match production behavior.
- Validation: manual contract comparison against the approved spec and any
  repository contract checks discovered in the already-listed test scope.
- Assignment: one clean-context implementation subagent, maximum five minutes.

### Integration Points Owned By The Main Agent

- Serialize any fixture updates needed because `AuthMiddleware` gains a required
  current-user dependency; workers must not broaden edits into test files owned
  by another active unit.
- Reconcile the D1 service boundary with the D2 repository API before D3 starts.
- Integrate controller registration and runtime composition only after both
  backend behavior units are ready.
- Compare browser error handling and OpenAPI error text byte-for-byte with the
  approved spec.
- Inspect all agent edits immediately on completion and preserve useful partial
  work if a five-minute limit is reached. A timed-out unit is stopped, reported,
  and split into smaller non-overlapping work before reassignment to a new
  clean-context agent.

### Independent Review Units

#### R1 - Backend Security And Data Integrity Review

- Type: code review; no implementation.
- Boundary: D1-D3 and their tests.
- Owned review scope: account target integrity, confirmation enforcement,
  transaction/locking correctness, complete FK-safe deletion order, normalized
  email scoping, no-mutation conflict behavior, error mapping, missing-user JWT
  rejection, and regression risk.
- Dependencies: D1-D3 completed and focused tests run.
- Acceptance criteria: findings identify spec/plan mismatches, missing tests,
  privacy/security risks, determinism issues, or explicitly report none.
- Validation: inspect focused diff and test evidence.
- Assignment: one clean-context code-review subagent, maximum five minutes.

#### R2 - Browser And Contract Review

- Type: code review; no implementation.
- Boundary: D4-D5 and their tests.
- Owned review scope: discoverability, typed confirmation, accessibility,
  pending/error states, exact `409` message, cleanup/redirect sequencing,
  existing delete-modal regression, OpenAPI/example accuracy, and documentation.
- Dependencies: D4-D5 completed and focused tests run.
- Acceptance criteria: findings identify spec/plan mismatches, missing tests,
  UX/accessibility regressions, contract drift, or explicitly report none.
- Validation: inspect focused diff and test evidence.
- Assignment: one clean-context code-review subagent, maximum five minutes.

### Review-Fix Units

- The main agent triages every R1/R2 finding against the approved artifacts.
- Each valid finding is assigned to a new clean-context implementation subagent
  with only the exact finding, relevant approved behavior, owned files, and
  focused validation.
- Backend and browser/documentation fixes may run concurrently only when their
  ownership does not overlap.
- Review agents never implement fixes.

## Main-Agent QA And Validation

After integration and review fixes, the main agent owns final QA and runs, in
this order where practical:

1. Focused account-deletion service, controller, middleware, browser, and
   database integration tests.
2. `npx tsc -p tsconfig.json --noEmit`.
3. `npx tsc -p tsconfig.client.json --noEmit`.
4. `npm run lint`; every reported lint issue must be fixed before handoff.
5. Inspect the lint diff for unrelated churn.
6. `npm test`.
7. `npm run build`.
8. If a usable runtime database configuration is available, perform a bounded
   `npm start` smoke check; otherwise report it as not run without implying
   runtime validation.
9. Browser QA of modal open/cancel, mismatched email gating, exact `409` display,
   success cleanup/redirect, narrow and wide layouts, keyboard focus, dialog
   labels, and non-activated visibility when the environment permits it.
10. API QA confirming no mutation on conflict, atomic success, shared resource
    preservation, active reservation release, and stale-token `401` behavior.
11. Run `npm run format` as the main agent before staging accepted changes.
12. Inspect the formatting diff for unrelated churn and revert only unrelated
    formatting changes without disturbing user work.
13. Re-run affected checks after any format or QA fix.
14. `git diff --check`.

Any unavailable database, browser, network, or runtime validation is reported
as blocked. Delivery remains `DRAFT` if required validation is skipped, blocked,
incomplete, or failing.

## Git And Delivery Policy

- Expected base branch: current `main`, presently tracking `origin/main`.
- At implementation start, re-check `git status --short --branch` and confirm the
  expected base before creating `feature/self-service-account-deletion`.
- Preserve the approved spec and plan plus all accepted in-scope implementation
  changes on that feature branch.
- Before committing, reconcile every modified, added, deleted, renamed, and
  untracked path. Classify and preserve unrelated user changes.
- Stage every accepted in-scope path, then inspect both the staged path list and
  complete staged diff. Confirm no generated bundles, dependency directories,
  credentials, dumps, or unrelated hunks are staged.
- Commit all accepted in-scope changes, including the approved spec and approved
  plan, using the repository convention, normally
  `feature: add self-service account deletion`. Include `DRAFT` in the commit
  subject if required review, QA, documentation, or validation remains skipped,
  blocked, incomplete, or failing.
- Push the feature branch and verify it is not ahead of its configured upstream.
- After commit and push, inspect final `git status` and do not report completion
  while any accepted in-scope change remains outside the commit.

## Completion Report Requirements

The final implementation report must state:

- the delivered spec behavior;
- code-review and QA findings;
- findings resolved;
- validation run and validation not run;
- database/browser/runtime limitations or remaining risks;
- API, HTTP example, README, and guidance updates;
- every remaining changed path and whether it is related;
- commit and push status;
- whether delivery is final or draft;
- every required step skipped, blocked, or unvalidated;
- whether the Definition of Done was fully satisfied; and
- confirmation that final main-agent acceptance was completed.

# OneSignal Email Delivery Implementation Plan

Status: Approved

## Approved Spec Reference

- `specs/SPEC-onesignal-email-delivery.md`

## Branch Policy

- Do not create a new branch unless the user explicitly requests one.
- Before implementation edits, inspect `git status --short --branch` and
  preserve unrelated worktree changes, including the currently untracked Google
  auth planning artifacts.
- Do not commit or push unless the user explicitly asks for commit or push.

## Ownership Boundaries

Implement only the approved OneSignal transactional email delivery scope:

- Required OneSignal configuration and template ID mapping.
- Repository `templates/` files for password reset, activation, and workspace
  invitation templates.
- Durable email job persistence, migration, schema, and repository behavior.
- Asynchronous email worker with three total attempts.
- Platform-admin failed-email retrigger API that requeues permanently failed
  OneSignal email jobs.
- OneSignal template-triggering adapter and failure logging.
- Controller/service wiring where token or invitation links are currently
  logged.
- Tests for job creation, worker delivery, retry/failure paths, and unchanged
  API responses.
- Contract and operations documentation updates required by the spec.

Do not change:

- Token hashing, expiry, validation, or consumption semantics.
- API response bodies except documentation text.
- Browser route behavior, auth/session behavior, or invitation acceptance
  behavior.
- OneSignal browser SDK, push notifications, SMS, marketing email, segments,
  aliases, journeys, or automatic template creation.
- Admin UI for email jobs.

## Likely Affected Files

- `src/service-availability-scheduler.ts`
- `src/controllers/AuthController.ts`
- `src/controllers/WorkspaceController.ts`
- `src/services/ConfigLoaderService.ts`
- New email service, worker, template metadata, and OneSignal adapter modules
  under `src/services/`.
- New email job repository under `src/repositories/`.
- New email job entity/DTO types under `src/entities/` or local service types,
  following existing patterns.
- New schema and migration files under `config/schema` and
  `config/migrations`.
- New template files under `templates/`.
- `src/tests/unit/auth-controller-password-login.test.ts`
- `src/tests/unit/google-auth-controller.test.ts`
- `src/tests/unit/workspace-service.test.ts` or controller-level workspace
  tests added/updated for invitation delivery wiring.
- New unit tests for email configuration, job repository, worker, template
  metadata, retrigger API, and OneSignal delivery.
- Integration migration tests if required by existing migration coverage.
- `AGENTS.md`
- `swagger.yml`
- `http/api.http`
- README or equivalent runtime docs if a current configuration section exists.

## Test-First Expectations

- This is behavior-changing business/domain-adjacent work because registration,
  reset, and invitation flows gain required async delivery behavior.
- Use one clean-context test-focused subagent before production implementation.
- The test-focused subagent must use `gpt-5.3-codex-spark` per workspace
  guidance.
- The test-focused subagent owns deterministic tests only and must not implement
  production delivery code beyond test fakes or scaffolding required by failing
  tests.
- If the test-focused subagent reaches 5 minutes, interrupt it, preserve usable
  tests, split remaining test work, and continue with a new clean-context
  test-focused subagent.

## Implementation Worker Policy

- Use no more than one active clean-context implementation worker at a time.
- Because this scope spans persistence, async worker behavior, several token
  flows, and documentation, split production work into deterministic subtasks if
  delegated:
  1. Configuration, template files, and template metadata.
  2. Email job schema, migration, repository, and tests.
  3. OneSignal adapter and async worker with retry/failure logging.
  4. AuthController password reset and activation queue wiring.
  5. Workspace invitation queue wiring.
  6. Failed-email retrigger API and docs.
  7. Documentation and contract text sync.
- Size each delegated subtask for no more than 5 minutes of active worker time.
- Workers must stay inside the approved spec and plan and must not perform new
  product research or architecture research.

## Ordered Implementation Steps

1. Re-read applicable instructions and approved artifacts, then inspect branch
   and worktree state.
2. Add failing tests for:
   - Required OneSignal configuration and template ID parsing.
   - Template files containing required metadata and placeholders.
   - Email job repository create, claim, mark-sent, retry, and permanent-failure
     behavior.
   - OneSignal request payload with `email_to`, `template_id`, `custom_data`,
     `include_unsubscribed`, stable idempotency key, and sender overrides.
   - Password reset known-email queues email job and preserves `{ ok: true }`.
   - Password reset unknown-email does not queue email job and preserves
     `{ ok: true }`.
   - Password registration queues account activation email job.
   - Non-authoritative Google registration queues account activation email job.
   - Workspace invitation queues workspace invitation email job and keeps raw
     code out of the API response.
   - Worker retries failed jobs up to 3 attempts total.
   - Platform-admin failed-email retrigger endpoint resets permanently failed
     matching jobs to retryable state and returns `{ ok: true, retried: n }`.
   - Failed-email retrigger endpoint rejects unauthenticated, non-activated, and
     non-platform-admin callers.
   - Failed-email retrigger endpoint supports optional `email_kind` and
     `job_ids` filters and does not send email synchronously.
   - Every failed attempt logs email kind, template ID, user ID when available,
     recipient, attempt number, payload key list, and non-secret failure
     details without raw URLs or tokens.
3. Implement required email configuration parsing and startup validation.
4. Add `templates/password-reset.html`,
   `templates/account-activation.html`, and
   `templates/workspace-invitation.html` with subject, preheader, placeholder,
   HTML, and text sections for manual OneSignal copying.
5. Add email job schema and migration using existing migration conventions.
6. Implement email job repository and deterministic claim/update operations.
7. Implement template metadata and payload builders for each email kind.
8. Implement OneSignal template delivery adapter using `globalThis.fetch` with
   injectable fetch for tests.
9. Implement async email worker with deterministic retry scheduling, stable
   idempotency key reuse, success recording, and failure logging.
10. Implement platform-admin `POST /api/email-jobs/failed/retry` endpoint that
    requeues permanently failed jobs without sending synchronously.
11. Wire worker startup and retrigger controller dependencies in
    `src/service-availability-scheduler.ts`.
12. Replace raw-link logging in `AuthController` with email job enqueueing for
    password reset and account activation.
13. Replace raw-link logging in `WorkspaceController` with email job enqueueing
    for workspace invitations.
14. Remove obsolete fallback logger-only behavior and update affected tests.
15. Update `AGENTS.md`, `swagger.yml`, `http/api.http`, and runtime docs as
    required by the approved spec.
16. Run targeted tests while iterating, then full validation.
17. Perform main-agent review for spec match, raw secret/link leakage, response
    compatibility, async retry behavior, migration safety, and documentation
    sync.
18. Run final QA commands and produce the completion report.

## Validation Commands

- `npm run build`
- `npm run lint`
- `npm test`
- `git diff --check`

`npm run format` is required before any commit if the user requests a commit.

## Review And QA

- After implementation, use no more than one clean-context code-review subagent
  at a time.
- Review focus:
  - Spec and plan match.
  - No OneSignal secrets exposed to browser, docs examples, logs, or responses.
  - No raw reset, activation, or invitation links in logs.
  - Raw links remain out of API responses.
  - Password reset enumeration resistance remains unchanged.
  - Startup errors are deterministic for missing OneSignal configuration.
  - Email jobs are durable and not sent before the triggering domain action
    succeeds.
  - Worker retries each job at most 3 attempts total.
  - Failed-email retrigger API is platform-admin-only, does not send
    synchronously, and cannot expose raw payload secrets.
  - Failure logs include template ID and user ID when available without leaking
    raw token URLs.
  - OneSignal message ID is recorded on success.
- The main agent owns QA and must not delegate final QA to a QA subagent.

## Documentation And Contracts

- Update `AGENTS.md` for durable behavior and configuration guidance.
- Update `swagger.yml` descriptions that currently describe links as only
  logged until email delivery exists.
- Update `http/api.http` comments where token source guidance mentions logs.
- Update README or equivalent runtime docs for:
  - required OneSignal environment variables
  - required template IDs
  - manual copy from `templates/` into OneSignal
  - async worker/retry behavior
  - failed-email retrigger API
  - email job failure monitoring
- Do not add real secrets or provider account-specific values to docs.

## Commit And Push Expectations

- Do not commit by default.
- If the user asks for a commit after implementation and validation passes, use
  a conventional message such as:
  `feature: Add OneSignal email delivery`
- Include `DRAFT` in the commit subject if required validation, review, manual
  OneSignal QA, or documentation remains incomplete.
- Do not push unless the user explicitly asks.

## No-Research Constraints For Implementation

- Implementation must use this approved spec and plan as the behavior source.
- Do not reopen product questions unless implementation reveals missing,
  incorrect, ambiguous, or materially different behavior.
- Do not add OneSignal dashboard template creation, segments, aliases, journeys,
  marketing features, or retry counts beyond 3 total attempts without a spec and
  plan amendment.

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

- Optional development-disabled OneSignal configuration mode selected by a
  missing or blank `ONESIGNAL_APP_ID`.
- Required OneSignal configuration and template ID mapping when
  `ONESIGNAL_APP_ID` is present.
- Repository `templates/` files for password reset, activation, and workspace
  invitation templates.
- Durable email job persistence, migration, schema, and repository behavior.
- Asynchronous email worker with three total attempts.
- Platform-admin failed-email retrigger API that requeues permanently failed
  OneSignal email jobs.
- OneSignal template-triggering adapter and failure logging.
- Development-disabled transactional email logger that logs generated email
  requests instead of creating email jobs or calling OneSignal.
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
- Production fallback semantics when OneSignal is configured; failed OneSignal
  delivery must still use durable jobs, retries, and retriggering rather than
  raw-link fallback logs.

## Likely Affected Files

- `src/service-availability-scheduler.ts`
- `src/controllers/AuthController.ts`
- `src/controllers/WorkspaceController.ts`
- `src/services/ConfigLoaderService.ts`
- `src/services/TransactionalEmailService.ts`
- `src/services/EmailTemplateService.ts`
- `src/services/EmailWorkerService.ts`
- `src/services/OneSignalEmailDeliveryService.ts`
- `src/service-availability-scheduler.ts`
- `src/tests/unit/auth-controller-password-login.test.ts`
- `src/tests/unit/google-auth-controller.test.ts`
- `src/tests/unit/workspace-controller-missing-auth-user.test.ts`
- `src/tests/unit/config-loader-service.test.ts`
- `src/tests/unit/email-worker-service.test.ts`
- `src/tests/unit/onesignal-email-delivery-service.test.ts`
- New or updated unit tests for development-disabled logging behavior.
- `AGENTS.md`
- `swagger.yml`
- `http/api.http`
- README or equivalent runtime docs if a current configuration section exists.

## Test-First Expectations

- This is behavior-changing business/domain-adjacent work because registration,
  reset, and invitation flows gain a development-disabled delivery path that
  logs generated links instead of queueing provider delivery.
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
   - Missing or blank `ONESIGNAL_APP_ID` loads configuration successfully.
   - Development-disabled mode does not require
     `ONESIGNAL_REST_API_KEY`, `APP_PUBLIC_BASE_URL`, or template ID env vars.
   - Development-disabled mode uses `APP_PUBLIC_BASE_URL` when present and
     otherwise derives `http://localhost:<PORT>` with `PORT` defaulting to
     `3000`.
   - Present `ONESIGNAL_APP_ID` still requires REST API key, public base URL,
     and all template IDs.
   - Password reset known-email logs a development-disabled email request,
     preserves `{ ok: true }`, and does not enqueue an email job.
   - Password reset unknown-email preserves `{ ok: true }` and logs no email
     request.
   - Password registration logs a development-disabled account activation email
     request after user/token creation and does not enqueue an email job.
   - Non-authoritative Google registration logs a development-disabled account
     activation email request after user/token creation and does not enqueue an
     email job.
   - Workspace invitation logs a development-disabled workspace invitation email
     request, keeps raw code out of the API response, and does not enqueue an
     email job.
3. Extend `ConfigLoaderService` OneSignal config to represent enabled versus
   development-disabled mode.
4. Preserve deterministic startup failures for partial OneSignal configuration
   whenever `ONESIGNAL_APP_ID` is present.
5. Add or update a development-disabled transactional email delivery component
   that receives the same generated payloads as the normal queue path and logs:
   email kind, recipient, optional user ID, payload key list, payload values,
   and a clear `ONESIGNAL_APP_ID` disabled message.
6. Change `TransactionalEmailService` to use the disabled logger instead of
   `EmailJobRepository.create()` when OneSignal is disabled.
7. Ensure `EmailWorkerService` is not started in development-disabled mode and
   the OneSignal adapter is not instantiated with missing credentials.
8. Keep existing production enabled-mode queueing, worker, retry, retrigger,
   failure logging, API response shapes, and docs behavior unchanged when
   `ONESIGNAL_APP_ID` is configured.
9. Update `AGENTS.md`, README, Swagger descriptions, and HTTP comments only
   where they currently imply OneSignal is always required or links are never
   logged under any mode.
10. Run targeted tests while iterating, then full validation.
11. Perform main-agent review for spec match, disabled-mode raw URL logging
   boundary, production no-fallback preservation, response compatibility, async
   retry behavior, and documentation sync.
12. Run final QA commands and produce the completion report.

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
- No raw reset, activation, or invitation links in logs when OneSignal is
  enabled.
- Raw reset, activation, or invitation links are logged only in
  development-disabled mode when `ONESIGNAL_APP_ID` is missing or blank.
  - Raw links remain out of API responses.
  - Password reset enumeration resistance remains unchanged.
- Startup errors are deterministic for missing OneSignal configuration when
  `ONESIGNAL_APP_ID` is present.
- Startup succeeds and OneSignal API calls are skipped when `ONESIGNAL_APP_ID`
  is missing or blank.
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
- Update `swagger.yml` descriptions only if needed to distinguish production
  OneSignal delivery from development-disabled logging.
- Update `http/api.http` comments where token source guidance mentions logs.
- Update README or equivalent runtime docs for:
  - optional `ONESIGNAL_APP_ID` dev-disable behavior
  - required OneSignal environment variables when OneSignal is enabled
  - required template IDs
  - manual copy from `templates/` into OneSignal
  - async worker/retry behavior
  - failed-email retrigger API
  - email job failure monitoring
  - warning that disabled-mode logs raw email URLs for local testing only
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

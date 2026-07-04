# OneSignal Email Delivery

Status: Approved

## Purpose

Send the application's transactional emails asynchronously through OneSignal
using manually managed OneSignal templates and durable retry tracking, while
allowing local development to disable OneSignal by omitting `ONESIGNAL_APP_ID`
and log the generated email request instead.

## Problem

Password reset, account activation, and workspace invitation flows currently
generate one-time links and log those links server-side with a TODO to replace
logging when email delivery exists. That behavior must end: raw reset,
activation, and invitation links should no longer be logged as an operational
fallback.

The app needs a deterministic asynchronous email-delivery contract that
preserves existing security behavior, triggers OneSignal templates with the
right recipient and template ID, sends per-email payload data where required,
and records every delivery failure with enough context to diagnose the failed
template without exposing credentials or raw secrets in normal API responses.

## Scope

- Add asynchronous OneSignal email delivery for password reset links.
- Add asynchronous OneSignal email delivery for account activation links created
  by password registration.
- Add asynchronous OneSignal email delivery for account activation links created
  by non-authoritative Google registration.
- Add asynchronous OneSignal email delivery for workspace invitation links.
- Remove the current server-side fallback logging of raw reset, activation, and
  invitation links.
- Add durable email job tracking so email work is queued after the triggering
  business operation and sent outside the HTTP response path.
- Retry failed email jobs up to 3 send attempts total.
- Add an authenticated API call that lets an operator retrigger email jobs that
  permanently failed OneSignal delivery.
- Log every failed send attempt with email kind, OneSignal template ID, user ID
  when available, recipient email, attempt number, non-secret payload metadata,
  and non-secret OneSignal failure details.
- Create a repository `templates/` folder containing one file per application
  email template so the user can manually copy the content into OneSignal.
- Trigger OneSignal by recipient email and configured OneSignal template ID.
- Send per-template `custom_data` payload to OneSignal for email-specific
  values such as links, nicknames, workspace names, and expiry text.
- Add server configuration for OneSignal app ID, REST API key, public app base
  URL, and template IDs.
- Add an explicit development-disabled mode: when `ONESIGNAL_APP_ID` is missing
  or blank, the app must not call OneSignal and must log the generated
  transactional email request instead.
- Keep raw password reset tokens, activation tokens, and workspace invitation
  codes out of API responses.
- Update durable repository guidance and operational documentation so future
  agents and operators know OneSignal template delivery is required.
- Update Swagger and HTTP examples where descriptions still say links are
  logged until email delivery exists.

## Out Of Scope

- Marketing email, newsletters, broadcasts, digests, or unsubscribe preference
  management.
- Push notifications, SMS, in-app messaging, or OneSignal browser SDK setup.
- Automatically creating or updating templates in OneSignal.
- Managing OneSignal users, aliases, segments, or journeys.
- Bulk email sending.
- Delivery-status webhooks from OneSignal.
- Admin UI for email jobs.
- Changing token generation, hashing, expiry, validation, or consumption
  semantics.
- Returning raw links, raw tokens, or raw invitation codes from API endpoints.
- Production fallback delivery when OneSignal is partially configured or fails.

## Definitions

- Transactional email: A service email triggered by a specific user or admin
  action, such as requesting a password reset, registering an account, or
  inviting someone to a workspace.
- Email kind: One of `password_reset`, `account_activation`, or
  `workspace_invitation`.
- OneSignal email delivery: A server-side request to OneSignal's email message
  API using the configured OneSignal app ID, REST API key, recipient email, and
  template ID.
- Development-disabled email delivery: A local-development mode selected by a
  missing or blank `ONESIGNAL_APP_ID` where the application does not create
  email jobs, does not call OneSignal, and logs the generated transactional
  email request, including the generated URL payload needed for manual local
  testing.
- Public app base URL: The externally reachable base URL used to create absolute
  links in email payloads, for example
  `https://service-availability.example.com`.
- Email job: A durable record representing one logical email to send to one
  recipient with one template and payload.
- Send attempt: One request from the app to OneSignal for an email job.
- Retrigger: An explicit API action that moves permanently failed email jobs back
  into retryable delivery after an operator chooses to retry OneSignal
  integration failures.
- Template source file: A repository file under `templates/` containing the
  manually maintained subject/preheader/body contract that the user copies into
  OneSignal.

## Inputs And Constraints

- OneSignal email delivery uses environment-based configuration:
  - `ONESIGNAL_APP_ID`: optional switch. When missing or blank, OneSignal
    delivery is disabled and development-disabled logging is used.
  - `ONESIGNAL_REST_API_KEY`: required only when `ONESIGNAL_APP_ID` is present.
  - `APP_PUBLIC_BASE_URL`: required only when `ONESIGNAL_APP_ID` is present;
    when OneSignal is disabled and this value is absent, generated links use
    `http://localhost:<PORT>` with `PORT` defaulting to `3000`.
  - `ONESIGNAL_TEMPLATE_PASSWORD_RESET_ID`: required only when
    `ONESIGNAL_APP_ID` is present.
  - `ONESIGNAL_TEMPLATE_ACCOUNT_ACTIVATION_ID`: required only when
    `ONESIGNAL_APP_ID` is present.
  - `ONESIGNAL_TEMPLATE_WORKSPACE_INVITATION_ID`: required only when
    `ONESIGNAL_APP_ID` is present.
  - `ONESIGNAL_EMAIL_FROM_NAME`: optional sender display-name override.
  - `ONESIGNAL_EMAIL_FROM_ADDRESS`: optional sender address override.
  - `ONESIGNAL_EMAIL_REPLY_TO_ADDRESS`: optional reply-to override.
- When `ONESIGNAL_APP_ID` is present, OneSignal email delivery is required for
  this feature. Missing or partial required OneSignal configuration fails
  startup with deterministic configuration errors.
- When `ONESIGNAL_APP_ID` is missing or blank, startup succeeds in
  development-disabled mode even if the REST API key, template IDs, or
  `APP_PUBLIC_BASE_URL` are also missing.
- `APP_PUBLIC_BASE_URL` is trimmed and stored without a trailing slash.
- OneSignal credentials are secrets and must never be logged, returned in API
  responses, committed, or exposed to browser JavaScript.
- Template IDs are configuration values and are safe to log as operational
  identifiers.
- Email links are absolute URLs constructed from `APP_PUBLIC_BASE_URL` plus the
  existing route path:
  - `/reset-password/<token>`
  - `/activate-account/<token>`
  - `/workspace-invitations/<code>`
- The app sends OneSignal email messages to direct email addresses rather than
  requiring pre-created OneSignal users or segments.
- OneSignal delivery requests are transactional and include delivery to
  unsubscribed email subscriptions.
- The app uses one stable idempotency key per email job and reuses that key for
  retries of the same job.
- Each job is attempted at most 3 times total: the first send attempt plus up to
  2 retry attempts.
- Email sending is asynchronous relative to the user-facing HTTP request.
- Development-disabled logging is a local testing convenience and is not a
  durable delivery mechanism.

## Template Files

- Create `templates/password-reset.html`.
- Create `templates/account-activation.html`.
- Create `templates/workspace-invitation.html`.
- Each file includes:
  - template name
  - subject
  - preheader
  - required `custom_data` keys
  - HTML body intended to be copied into OneSignal
  - plain-text fallback content intended to be copied into OneSignal if needed
- Template files use placeholder names that match the `custom_data` keys sent by
  the app.
- Template files must not include real secrets, real tokens, or environment
  values.
- The app does not parse the HTML files at runtime; runtime delivery uses
  configured OneSignal template IDs and generated `custom_data`.

## Email Inventory

### Password Reset Email

- Email kind: `password_reset`.
- Template file: `templates/password-reset.html`.
- Template ID configuration: `ONESIGNAL_TEMPLATE_PASSWORD_RESET_ID`.
- Trigger: A known user successfully requests password reset after the
  configured CAPTCHA check passes.
- Recipient: The normalized email address for the matched user account.
- User ID: The matched user ID.
- Required payload:
  - `reset_url`
  - `expires_in_minutes`
  - `recipient_email`
- Subject: `Reset your Service Availability Scheduler password`
- Preheader: `Use this link to choose a new password.`
- Primary action label: `Reset password`
- Body requirements:
  - State that a password reset was requested for the account.
  - Include the reset link as both a button-style HTML link and a plain fallback
    URL.
  - State that the link expires according to the configured password reset token
    lifetime.
  - Tell the recipient to ignore the email if they did not request the reset.
  - Do not include the password, password hash, bearer token, or any account
    enumeration hint.

### Account Activation Email

- Email kind: `account_activation`.
- Template file: `templates/account-activation.html`.
- Template ID configuration: `ONESIGNAL_TEMPLATE_ACCOUNT_ACTIVATION_ID`.
- Trigger: A non-activated user is created by password registration or by
  non-authoritative Google registration.
- Recipient: The normalized email address for the created user.
- User ID: The created user ID.
- Required payload:
  - `activation_url`
  - `nickname`
  - `recipient_email`
- Subject: `Activate your Service Availability Scheduler account`
- Preheader: `Confirm your account to finish setup.`
- Primary action label: `Activate account`
- Body requirements:
  - Greet the user by nickname when available.
  - State that activation is required before protected actions are available.
  - Include the activation link as both a button-style HTML link and a plain
    fallback URL.
  - State that opening the link activates the existing account.
  - Do not say the user has received `platform_admin` access in the email.

### Workspace Invitation Email

- Email kind: `workspace_invitation`.
- Template file: `templates/workspace-invitation.html`.
- Template ID configuration: `ONESIGNAL_TEMPLATE_WORKSPACE_INVITATION_ID`.
- Trigger: A workspace admin or manager creates a new pending workspace
  invitation.
- Recipient: The normalized invited email address.
- User ID: The invited user ID when the invited email already belongs to a user;
  otherwise `null`.
- Required payload:
  - `invitation_url`
  - `workspace_name`
  - `expires_in_hours`
  - `recipient_email`
- Subject: `You have been invited to a Service Availability Scheduler workspace`
- Preheader: `Open the invitation to join the workspace.`
- Primary action label: `Open invitation`
- Body requirements:
  - State that the recipient was invited to a workspace.
  - Include the workspace name when it is available.
  - Include the invitation link as both a button-style HTML link and a plain
    fallback URL.
  - State that accepted invitations grant member access.
  - State that the invitation expires according to the configured workspace
    invitation lifetime.
  - Tell the recipient to ignore the email if they did not expect the
    invitation.

## Deterministic Behavior

### Delivery Configuration

- Startup succeeds in development-disabled mode when `ONESIGNAL_APP_ID` is
  missing or blank.
- In development-disabled mode:
  - OneSignal API calls are never attempted.
  - Email jobs are not created for reset, activation, or invitation email
    requests.
  - The app logs the generated email kind, recipient email, optional user ID,
    payload key list, and generated payload values, including reset,
    activation, or invitation URLs.
  - The log clearly states that OneSignal email delivery is disabled because
    `ONESIGNAL_APP_ID` is not configured.
  - The user-facing HTTP response shape and status remain unchanged.
  - Unknown-email password reset requests still do not create tokens and still
    do not log any reset email request.
- Startup fails if `ONESIGNAL_APP_ID` is present but any other required
  OneSignal delivery setting is missing or malformed.
- Runtime app-info and browser APIs do not expose OneSignal configuration or
  enabled state.
- Outside development-disabled mode, there is no server-log fallback for raw
  links.
- Operators who need a failed link outside development-disabled mode must use
  the app's token/invitation data repair process outside this feature scope; the
  application does not print raw link secrets as fallback delivery.

### Email Job Creation

- After the relevant domain transaction succeeds, the app creates an email job
  with email kind, recipient email, optional user ID, template ID, payload,
  stable idempotency key, status, attempt count, and timestamps.
- In development-disabled mode, after the relevant domain transaction succeeds,
  the app logs the generated email request instead of creating an email job.
- Job creation happens after token or invitation creation so the queued payload
  can include the generated absolute URL.
- If email job creation fails after the domain action succeeded, the user-facing
  response follows existing business semantics and the failure is logged without
  raw link secrets.
- Email jobs must not be created for unknown-email password reset requests.
- Email job payload storage may contain the generated absolute URL because the
  worker must send it to OneSignal, but logs must not print raw URLs containing
  reset tokens, activation tokens, or invitation codes.
- Development-disabled logs are the only exception where generated URL payloads
  may be printed, because they replace provider delivery for local testing when
  `ONESIGNAL_APP_ID` is not configured.

### Asynchronous Worker

- Email jobs are sent by an asynchronous worker in the application process.
- The HTTP request that created the token or invitation does not wait for
  OneSignal delivery to complete.
- The worker claims pending or retryable jobs deterministically so concurrent
  loops do not send the same job at the same time.
- A successful OneSignal response marks the job `sent` and records the
  OneSignal message ID when returned.
- A failed OneSignal response, empty message ID, malformed response, timeout, or
  network error records a failed attempt.
- Failed jobs with fewer than 3 attempts return to a retryable state.
- Failed jobs with 3 attempts are marked permanently failed.
- Retry timing must be deterministic and documented in code. A simple short
  backoff such as immediate first retry loop eligibility, then 1 minute, then 5
  minutes is acceptable if tests can control time.
- Email jobs are not retried more than 3 times.

### OneSignal Request Contract

- The app sends email through OneSignal's email message API with:
  - configured `app_id`
  - `email_to` containing the single recipient address
  - configured `template_id`
  - generated `custom_data`
  - `include_unsubscribed: true`
  - stable job `idempotency_key`
  - optional sender fields only when configured
- The app authenticates with the REST API key using OneSignal's required
  authorization header format.
- The app treats OneSignal's returned message ID as the email ID to store for
  diagnostics.
- Non-2xx responses, 2xx responses without a usable message ID, malformed
  success responses, and fetch/network errors are treated as delivery failures.

### Failure Logging

- Every failed send attempt logs:
  - email job ID
  - email kind
  - OneSignal template ID
  - user ID when available
  - recipient email
  - attempt number
  - final-attempt flag
  - non-secret payload key list
  - non-secret OneSignal status, error code, warning, or response summary when
    available
- Failure logs must not include:
  - `ONESIGNAL_REST_API_KEY`
  - reset token
  - activation token
  - invitation code
  - absolute reset, activation, or invitation URL
  - bearer token
  - password or password hash
- Successful send logs may include email job ID, email kind, template ID, user
  ID, recipient email, attempt number, and OneSignal message ID, but no raw
  secret links.

### Failed Email Retrigger API

- Add `POST /api/email-jobs/failed/retry`.
- The endpoint requires authentication, activation, and the existing
  `platform_admin` role.
- The endpoint accepts an optional JSON body:
  - `email_kind`: optional filter for one email kind.
  - `job_ids`: optional array of email job IDs to retry.
- If neither filter is supplied, all permanently failed email jobs are
  retriggered.
- If both filters are supplied, only permanently failed jobs matching both the
  listed job IDs and email kind are retriggered.
- Retriggering a failed job:
  - changes its status back to retryable or pending
  - resets its attempt count to 0
  - clears its next-attempt delay so the async worker may send it promptly
  - preserves recipient email, user ID, template ID, payload, original job ID,
    and idempotency key unless implementation discovers OneSignal requires a new
    idempotency key for manual retrigger; if so, stop for spec amendment before
    implementation
  - records an updated timestamp
- The endpoint never sends email synchronously. It only makes jobs eligible for
  the async worker.
- The endpoint response is:
  - `200`
  - `{ "ok": true, "retried": <number> }`
- If no failed jobs match the filters, the endpoint returns
  `{ "ok": true, "retried": 0 }`.
- The endpoint must not return raw payload URLs, reset tokens, activation
  tokens, invitation codes, or OneSignal secrets.
- The endpoint logs the operator user ID, filter summary, and number of jobs
  retriggered without logging raw secret payload values.

### Password Reset

- Unknown-email password reset requests still return `{ ok: true }` without
  creating a token and without creating an email job.
- Known-email password reset requests still create a reset token exactly as
  today.
- After token creation, the app queues a `password_reset` email job.
- The API response remains `{ ok: true }` for known and unknown email addresses.
- The response does not wait for OneSignal delivery.

### Account Activation

- Password registration still creates a non-activated user, a single active
  activation token, and the normal authenticated session response.
- Non-authoritative Google registration still creates a non-activated user,
  creates a single active activation token, and returns the normal
  authenticated session response.
- After activation token creation, the app queues an `account_activation` email
  job.
- Registration and Google-auth responses do not wait for OneSignal delivery.

### Workspace Invitations

- Workspace invitation creation still requires an authenticated, activated
  workspace admin or manager.
- Workspace invitation creation still creates a pending invitation with a hashed
  invitation code and no raw code in the API response.
- After invitation creation, the app queues a `workspace_invitation` email job.
- The invitation creation API response remains the existing created invitation
  response shape and status.
- The response does not wait for OneSignal delivery.

## Persistence

- Add deterministic migration and schema files for email job tracking.
- The email job table must support at least:
  - job ID
  - email kind
  - recipient email
  - optional user ID
  - OneSignal template ID
  - JSON payload
  - idempotency key
  - status
  - attempt count
  - next attempt timestamp
  - last attempt timestamp
  - OneSignal message ID
  - last non-secret error summary
  - created and updated timestamps
- The table must support deterministic claiming of pending/retryable jobs.
- The table must support deterministic bulk retrigger of permanently failed
  jobs with optional email-kind and job-ID filters.
- Migration files must follow the repo's existing migration naming convention.

## Assumptions

- The OneSignal account, email channel, sender, DNS records, and account
  verification are operational prerequisites managed outside this repository.
- The user will manually copy files from `templates/` into OneSignal and then
  configure the resulting template IDs in environment variables.
- Direct email targeting is acceptable for this application's transactional
  emails.
- The current link routes remain the durable browser surfaces for password
  reset, activation, and invitation acceptance.
- Three total send attempts are sufficient for this phase.

## Regression Impact

- Authentication and invitation flows gain required OneSignal configuration at
  startup only when `ONESIGNAL_APP_ID` is configured.
- Local development can run without OneSignal configuration by omitting
  `ONESIGNAL_APP_ID`, but reset, activation, and invitation links will appear in
  server logs.
- Token and invitation flows gain a required database-backed email job write
  after successful domain creation.
- Password reset must preserve enumeration resistance.
- Registration and invitation APIs may return success before email delivery is
  complete, so operators must monitor email job failure logs.
- Manual OneSignal template drift can break delivered email content even when
  app tests pass.
- Tests must cover asynchronous job creation and worker delivery without making
  real OneSignal network requests.

## Validation Plan

- Unit-test configuration parsing for complete and missing OneSignal settings.
- Unit-test configuration parsing for development-disabled mode when
  `ONESIGNAL_APP_ID` is absent, including no requirement for REST API key,
  template IDs, or `APP_PUBLIC_BASE_URL`.
- Unit-test that development-disabled mode derives a localhost public base URL
  from `PORT` or `3000` when `APP_PUBLIC_BASE_URL` is absent.
- Unit-test template metadata files for required names, subjects, and
  placeholders.
- Unit-test email job repository creation, claiming, success marking, retry
  scheduling, and permanent failure after 3 attempts.
- Unit-test OneSignal delivery request body, authorization header, template ID,
  `custom_data`, `include_unsubscribed`, idempotency key reuse, and failure
  classification using a fake fetch implementation.
- Unit-test password reset, account activation, non-authoritative Google
  registration, and workspace invitation flows for:
  - email job queued after successful domain action
  - development-disabled logging happens after successful domain action without
    creating email jobs
  - no email job for unknown reset email
  - unchanged API response shapes
  - no raw link fallback logs
- Unit-test worker behavior for async send success, retryable failure, and final
  failure logging.
- Unit-test failed-email retrigger API authorization, filter behavior, response
  shape, no synchronous send behavior, and no raw secret leakage.
- Run `npm run build`.
- Run `npm run lint`.
- Run `npm test`.
- Run `git diff --check`.
- Manual QA with real OneSignal credentials and manually copied templates is
  required before final production confidence; without it, delivery remains
  draft even if automated validation passes.

## Documentation Needs

- Update `AGENTS.md` authentication/account-state and configuration sections to
  say reset, activation, and invitation links are queued for asynchronous
  OneSignal template email delivery when `ONESIGNAL_APP_ID` is configured, and
  logged only in development-disabled mode when `ONESIGNAL_APP_ID` is absent.
- Update `swagger.yml` descriptions that currently say reset, activation, or
  invitation links are logged until email delivery exists, and document the
  failed-email retrigger endpoint.
- Update `http/api.http` comments only if needed to reflect that raw tokens are
  obtained from delivered email, not API responses or server logs. Add a request
  example for the failed-email retrigger endpoint.
- Add or update README/operator setup documentation for optional
  `ONESIGNAL_APP_ID` dev-disable behavior, required OneSignal environment
  variables when enabled, manual template-copy process, and email job
  monitoring.
- Do not document OneSignal secrets in examples with real values.

## External References

- OneSignal email setup requires an email provider/sender/DNS verification
  outside this app.
- OneSignal email messages accept direct email recipients, template IDs,
  `custom_data`, sender fields, `include_unsubscribed`, and `idempotency_key`.
- OneSignal transactional email guidance recommends `include_unsubscribed` for
  service-related messages such as password resets.

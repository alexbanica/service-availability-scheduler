# Service Availability Scheduler

Minimal Node.js app to claim services per environment with password-based or
Google login, workspace administration, and timed reservations.

Authentication uses application bearer JWT tokens. Password login calls
`POST /api/login`; Google login calls `POST /api/google-auth` when configured.
Clients send the returned token with protected API calls using the
`Authorization: Bearer <token>` header.

## Setup

1) Install dependencies

```bash
npm install
```

2) Build the TypeScript server and frontend

```bash
npm run build
```

3) Create the database in MariaDB (tables are created automatically on startup)

4) Set your MariaDB connection string

```bash
export DATABASE_URL='mysql://user:password@host:3306/database_name'
export SESSION_SECRET='replace-with-a-long-random-secret'
```

5) Start the server

```bash
npm start
```

Open `http://localhost:3000`.

## Configuration

### Runtime environment

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | None | MariaDB connection string used by the server, for example `mysql://user:password@host:3306/database_name`. The database must already exist; tables are created automatically on startup. |
| `SESSION_SECRET` | Yes | None outside local development | JWT signing secret. Required for normal startup. `npm run dev` and `NODE_ENV=test` fall back to a development-only default. |
| `RUN_MIGRATIONS_ON_STARTUP` | No | `true` | When true, runs checked-in SQL migrations on startup. Set to `false` to skip startup migrations when running migrations separately. |
| `PORT` | No | `3000` | HTTP port used by `npm start` and `npm run dev`. |
| `APP_VERSION` | No | `development` | Version string exposed in page footers. Docker images built with `docker/build.sh --release <tag>` set this to the release tag automatically. |
| `GOOGLE_AUTH_CLIENT_ID` | No | Disabled | Public Google OAuth client ID that enables Google Identity Services login/register. No client secret or Google API access token is used. |
| `GOOGLE_RECAPTCHA_SITE_KEY` | No | Disabled | Public Google reCAPTCHA v3 site key used by the login/register page. |
| `GOOGLE_RECAPTCHA_SECRET_KEY` | No | Disabled | Private Google reCAPTCHA v3 secret key used only by the server for siteverify validation. Keep it out of source control. |
| `GOOGLE_RECAPTCHA_MIN_SCORE` | No | `0.5` | Minimum accepted reCAPTCHA v3 score for password reset requests and password registration. |
| `ONESIGNAL_APP_ID` | No | Disabled | OneSignal app ID used for transactional email delivery. Omit or leave blank for local development-disabled mode. |
| `ONESIGNAL_REST_API_KEY` | When enabled | None | OneSignal REST API key used only by the server. Keep it out of source control. |
| `APP_PUBLIC_BASE_URL` | When enabled | `http://localhost:<PORT>` when disabled | Public app origin/base URL used to build email links, for example `https://app.example.com`. Trailing slashes are ignored. Do not include query strings or fragments. |
| `ONESIGNAL_TEMPLATE_PASSWORD_RESET_ID` | When enabled | None | OneSignal template ID for password reset email. |
| `ONESIGNAL_TEMPLATE_ACCOUNT_ACTIVATION_ID` | When enabled | None | OneSignal template ID for account activation email. |
| `ONESIGNAL_TEMPLATE_WORKSPACE_INVITATION_ID` | When enabled | None | OneSignal template ID for workspace invitation email. |
| `ONESIGNAL_EMAIL_FROM_NAME` | No | OneSignal default | Optional sender display-name override. |
| `ONESIGNAL_EMAIL_FROM_ADDRESS` | No | OneSignal default | Optional sender address override. |
| `ONESIGNAL_EMAIL_REPLY_TO_ADDRESS` | No | OneSignal default | Optional reply-to address override. |

### OneSignal transactional email setup

Password reset, account activation, and workspace invitation links are queued as
durable email jobs and sent asynchronously through OneSignal templates. Startup
fails when `ONESIGNAL_APP_ID` is configured but any required OneSignal setting
is missing.

When `ONESIGNAL_APP_ID` is omitted or blank, OneSignal delivery is disabled for
local development. In that mode the app does not create email jobs or call
OneSignal. Instead, it logs the generated transactional email request, including
raw reset, activation, or invitation URLs, so local testers can copy the link.
Do not use disabled mode for production.

Copy the repository template source files into OneSignal manually:

- `templates/password-reset.html`
- `templates/account-activation.html`
- `templates/workspace-invitation.html`

Each file lists the subject, preheader, required `custom_data` keys, HTML body,
and plain-text fallback. Template placeholders must use OneSignal Liquid syntax
such as `{{ message.custom_data.reset_url }}`. The app does not create or
update OneSignal templates.
Email jobs retry up to three total attempts. Failed attempts are logged with
email kind, template ID, user ID when available, recipient, attempt number,
payload key names, and non-secret failure details. Raw reset, activation, and
invitation URLs are not logged when OneSignal is enabled.

Platform admins can requeue permanently failed jobs without sending email
synchronously:

```http
POST /api/email-jobs/failed/retry
Authorization: Bearer <platform-admin-token>
Content-Type: application/json

{ "email_kind": "password_reset", "job_ids": ["<email-job-id>"] }
```

### Google Cloud OAuth client setup

Google login and registration use Google Identity Services with a browser
credential callback. The app needs only a public OAuth 2.0 Web application
client ID in `GOOGLE_AUTH_CLIENT_ID`; it does not use a Google client secret,
OAuth redirect endpoint, Google API access token, or extra Google API scopes.

Create the client ID in Google Cloud:

1. Open the Google Auth Platform Clients page in Google Cloud Console.
2. Create or select the Google Cloud project for this deployment.
3. Register the app branding/consent information if Google Cloud asks for it.
4. Create a client with application type `Web application`.
5. Add each app origin under Authorized JavaScript origins. Origins include only
   scheme, host, and optional port, with no path:
   - `http://localhost`
   - `http://localhost:3000`
   - your production origin, for example `https://app.example.com`
6. Leave Authorized redirect URIs empty for this app unless the implementation
   is changed to use a redirect-based Google flow.
7. Copy the generated client ID, which looks like
   `1234567890-example.apps.googleusercontent.com`.
8. Configure the server and restart it:

```bash
export GOOGLE_AUTH_CLIENT_ID='1234567890-example.apps.googleusercontent.com'
```

The Google button is hidden when `GOOGLE_AUTH_CLIENT_ID` is unset. After it is
set, the login page loads the Google Identity Services script from
`https://accounts.google.com/gsi/client`, renders the Google button, receives an
ID token credential in the browser, and sends it to `POST /api/google-auth` for
server-side verification.

Google requires HTTPS origins for non-localhost browser applications. Local
development may use localhost over HTTP, but the exact localhost port must be
listed when it is not the default port.

### Free Google reCAPTCHA setup

Password-reset requests and password-based registration use Google reCAPTCHA v3.
This is separate from the Google OAuth client ID used for Google Identity
Services; `GOOGLE_AUTH_CLIENT_ID` does not enable reCAPTCHA.

Create or select reCAPTCHA keys in the reCAPTCHA Admin Console:

1. Choose reCAPTCHA v3 when registering the site.
2. Add every served domain that should use the key, including localhost domains
   for local development and production domains as needed.
3. Copy the site key into `GOOGLE_RECAPTCHA_SITE_KEY`.
4. Copy the secret key into `GOOGLE_RECAPTCHA_SECRET_KEY`.
5. Keep the secret key out of source control and deployment logs.
6. Start with the default score threshold, then tune
   `GOOGLE_RECAPTCHA_MIN_SCORE` from observed staging or production behavior.

When reCAPTCHA is not fully configured, password-reset requests and
password-based registration fail closed until both keys are supplied. Google auth
login and registration remain controlled only by `GOOGLE_AUTH_CLIENT_ID`.

### Application file config

Edit `config/app.yml` for app timing behavior.

| Key | Default | Unit | Description |
| --- | --- | --- | --- |
| `expiry_warning_minutes` | `5` | minutes | Lead time for reservation expiry warning events. |
| `auto_refresh_seconds` | `60` | seconds | Browser service-availability auto-refresh interval returned by `/api/services`. Values below `1` second are clamped by the browser scheduler. |
| `jwt_expires_in_seconds` | `3600` | seconds | JWT access token lifetime in seconds. |
| `password_reset_token_expires_in_seconds` | `3600` | seconds | Password reset token lifetime in seconds. |
| `workspace_invitation_expires_in_seconds` | `86400` | seconds | Workspace invitation lifetime in seconds. |
| `run_migrations_on_startup` | `true` | boolean | Controls whether startup runs pending SQL migrations from `config/migrations`. |

`JWT_EXPIRES_IN_SECONDS` (environment variable) takes precedence over
`jwt_expires_in_seconds` in `config/app.yml`.

`PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS` (environment variable) takes
precedence over `password_reset_token_expires_in_seconds` in
`config/app.yml`.

`WORKSPACE_INVITATION_EXPIRES_IN_SECONDS` (environment variable) takes
precedence over `workspace_invitation_expires_in_seconds` in `config/app.yml`.

`RUN_MIGRATIONS_ON_STARTUP` (environment variable) takes precedence over
`run_migrations_on_startup` in `config/app.yml`.

## CI/CD and release publishing

This repository now validates pull requests and `main` branch pushes with a
GitHub Actions workflow and publishes container images on tag pushes only.

- **Validation workflow (`.github/workflows/ci.yml`)**
  - Triggers: `pull_request` to `main` (opened, reopened, ready for review,
    synchronize) and `push` on `main`.
  - Uses the checked-in repository commands only:
    - `npm ci`
    - `npm run lint`
    - `npm test`
  - Lint is mutation-aware: the workflow records a tracked-file baseline before lint
    and fails if tracked files change after lint.
  - `npm test` runs the project suite without dedicated CI database credentials;
    database integration tests remain skipped unless existing `TEST_DATABASE_URL`
    and `TEST_DATABASE_ALLOW_TRUNCATE=1` are provided.

- **Release workflow (`.github/workflows/publish-docker-images.yml`)**
  - Triggers only on Git tag pushes (`push` + `tags: - '*'`).
  - Tag input handling is owned by `docker/build.sh --emit-github-matrix`:
    - exact lower-case safe tag pattern only (`^[a-z0-9_][a-z0-9_.-]*$`)
    - full image tag length limit of 128 characters
    - immutable tag mapping: `<tag>-node24-alpine`
    - moving latest tag mapping: `latest-node24-alpine`
  - Two-job design:
    - `prepare-release`: checks out the tag target commit and emits release matrix to
      `GITHUB_OUTPUT` in GitHub matrix format without build or registry credentials.
    - `publish`: depends on preparation, checks out the same tag target, logs in to
      Forgejo on a native `ubuntu-24.04-arm` GitHub-hosted runner, and runs one
      ordinary `docker build` followed by pushes for both emitted tags.
  - Publication matrix is the single source of truth for image name, context,
    dockerfile, platform, and `APP_VERSION`.
  - Registry target is:
    `forgejo.alexlab.nl/alexlab/service-availability-scheduler:<tag>-node24-alpine`
    and the same image is published as
    `forgejo.alexlab.nl/alexlab/service-availability-scheduler:latest-node24-alpine`.
  - Build platform is `linux/arm64` only. The publish job verifies both the native
    runner architecture and emitted platform before building. It does not install
    QEMU, create a Buildx builder, or pull the Buildx BuildKit helper image.
  - The publish step records the pushed digest in the workflow summary, and the
    workflow performs `docker logout forgejo.alexlab.nl` unconditionally at the end.
  - Workflow permissions remain `contents: read`; secrets are not available to the
    validation workflow.
  - Required secrets for release publication:
    - `FORGEJO_REGISTRY_USERNAME`
    - `FORGEJO_REGISTRY_TOKEN`

- **Local build compatibility**
  - `docker/build.sh --release <tag>` remains available and defaults to the checked-in
    local `.env` registry.
  - Local behavior still includes the release tag and moving `latest` tags unless
    `--no-latest` is passed.
  - CI always publishes the moving latest tag; `--no-latest` is a local-build
    option only.

No `swagger.yml` or `http/*.http` changes are required for this automation-only
delivery because no API contract or request/response surface changed.

Workspace admins define workspace owners, environments, and services from the
admin UI. Service creation selects existing workspace-scoped owners and
environments; it does not create them inline.

## Workspace Administration

Workspace memberships are role-scoped per workspace:

- `admin`: manage users, invitations, owners, environments, and services.
- `manager`: manage non-user resources and pending invitations.
- `member`: inspect workspace details and use reservation workflows after
  activation.

The Administration view is visible to authenticated users. Workspace Management
and Service Management list the current user's workspaces for inspection, while
mutation controls are shown only when the selected workspace role permits them.
User Management remains limited to admin workspaces for accepted user removal
and role changes.

Invitations are email-address based, expire after the configured invitation
lifetime, and always grant accepted invitees the `member` role. Invitation
links use `/workspace-invitations/<code>` and preserve login or registration
handoff context. Raw invitation codes are never returned by API responses.

Resource administrators can remove pending invitations. Owner and environment
deletion is an approved spec: deletion must be confirmed, must be scoped to the
workspace, and must detach affected services without deleting those services.

## Self-Service Account Deletion

Authenticated users, including users who have not activated their accounts, can
choose `Delete account` from the signed-in header. The confirmation dialog
describes the permanent deletion and requires the user to type the current
account email. Comparison trims surrounding whitespace and ignores letter case;
the destructive action remains disabled until the values match.

Before deletion, users must remove every other member from each workspace they
own. If an owned workspace still has another member, deletion is rejected and
no data is changed. Ownership transfer and automatic successor promotion are
not supported.

Successful deletion permanently removes the local account and its password or
Google-link identity, platform roles, password-reset and activation tokens,
workspace memberships, reservations, attributable invitations and email jobs,
and sole-member owned workspaces with their services, owners, environments, and
related local records. Shared workspaces not owned by the user and their
resources remain; only the deleting user's attributable records are removed
from them. The app immediately clears the bearer token and user-scoped browser
state, stops authenticated background activity, and redirects to `/login`.
Previously issued tokens no longer authenticate because the local user no
longer exists.

Deletion affects application database data only. It cannot delete or recall the
user's Google account, delivered or in-flight email, provider-retained data,
browser history, backups, or infrastructure logs governed by external retention
policies.

## Authentication API Contract

- `POST /api/login`: accepts `{ "email": "user@example.com", "password": "secret" }`, returns:
  - `ok: true`
  - `user`
  - `token`
  - `token_type: "Bearer"`
  - `expires_in_seconds`
  - `user.activated`.
- `POST /api/google-auth`: accepts `{ "credential": "...", "g_csrf_token": "...", "invitation_code": "..." }` when `GOOGLE_AUTH_CLIENT_ID` is configured. The body CSRF token must match the `g_csrf_token` cookie set by Google Identity Services. It creates or links a local user, applies new-user invitation codes when the verified Google email matches, and returns the same application bearer token shape as password login. Google ID tokens are never used as application bearer tokens.
- `POST /api/password-reset/captcha`: legacy compatibility endpoint returning
  `410` because local math CAPTCHA challenges are no longer created.
- `POST /api/password-reset/request`: accepts `{ "email": "...", "recaptcha_token": "..." }`, verifies Google reCAPTCHA v3 action `password_reset_request`, and creates or replaces an
  active reset token for existing users. Response is generic and does not expose
  whether an account exists. Known-account reset links are queued for
  asynchronous OneSignal email delivery when enabled, or logged only in
  development-disabled mode.
- `POST /api/password-reset/validate`: validates `{ "token" }` and returns `ok: true` for active tokens.
- `POST /api/password-reset`: accepts `{ "token": "...", "password": "...", "confirm_password": "..." }`, requires matching password and confirmation, sets the user password, and returns generic success. Responses are generic and do not return a token.
- `POST /api/register/captcha`: legacy compatibility endpoint returning `410`
  because local math CAPTCHA challenges are no longer created.
- `POST /api/register`: accepts registration values, validates required fields
  before CAPTCHA or persistence work, validates `recaptcha_token` with Google
  reCAPTCHA v3 action `register`, creates a non-activated user, creates a
  one-time activation token, and returns the authenticated bearer token payload
  with `activated: false`.
  The activation link is queued for asynchronous OneSignal email delivery when
  enabled, or logged only in development-disabled mode.
- `POST /api/account-activation/validate`: validates `{ "token": "..." }` and returns
  `ok: true` for a valid activation token.
- `POST /api/account-activation`: accepts `{ "token": "..." }`, activates the
  user, grants `platform_admin`, and returns the standard authenticated bearer
  token payload for the activated user.
- `POST /api/renew`: protected endpoint that issues a replacement token and
  returns the same response shape.
- `POST /api/logout`: protected endpoint maintained for compatibility; server-side
  logout is stateless.
- `GET /api/me`: protected endpoint returning authenticated user identity from the
  token context.
  `GET /api/me` and `/api/renew` include `activated` in the returned user object.
- `DELETE /api/users/me`: protected endpoint available before activation. It
  accepts exactly `{ "confirmation_email": "current-user@example.com" }` and
  returns `204` after atomic permanent deletion. It returns `400` for an absent,
  malformed, extra-field, non-string, or non-matching confirmation body; `401`
  for an absent or invalid bearer token or a deleted user; `409` when an owned
  workspace still has another member; and `500` when atomic deletion fails.
- Protected API calls send `Authorization: Bearer <token>`.
- Sensitive authentication, registration, CAPTCHA, reset, and activation
  endpoints are rate limited and return `429` with `{ "error": "Too many requests" }`
  when a request exceeds its current limit window.

Activation policy:
- Non-activated users may call: `/api/register/*`, `/api/account-activation/*`,
  `/api/renew`, `/api/logout`, `/api/me`, `DELETE /api/users/me`, `/api/app-info`,
  page routes, and static assets.
- Protected service, reservation, workspace, owner, environment, invitation, and
  workspace-user APIs require activation and return `403` when a non-activated user
  calls them.

Client stores the token in `localStorage` (`auth_token`) and calls
`/api/renew` before expiry when possible. A failed authorized call (`401`) clears
the token and redirects to `/login`.

Browser pages load Vue from the installed pinned `vue` package through the local
`/vendor/vue/vue.global.prod.js` route rather than from an external CDN.

Reset, activation, and invitation URLs are queued for asynchronous OneSignal
email delivery when OneSignal is enabled. Raw token and invitation URLs are
never returned in API responses. They are logged only in local
development-disabled mode when `ONESIGNAL_APP_ID` is omitted or blank.

### Migrations

Application startup now runs two schema setup paths:

- base schema bootstrap (`config/schema/*.sql`) creates missing base tables, and
- checked-in SQL migrations in `config/migrations` apply incremental changes to existing databases.

`config/migrations` files are table-scoped and ordered with deterministic naming,
for example `0001_users_add_password_hash.sql` and `0002_password_reset_tokens_create_table.sql`.

Startup behavior is controlled by `run_migrations_on_startup` (or
`RUN_MIGRATIONS_ON_STARTUP`), and defaults to enabled. Disabling startup
migrations keeps the server runnable while migration execution is managed
explicitly.

Run pending migrations explicitly (including when startup migrations are
disabled) with:

```bash
npm run migrate
```

### Test environment

| Name | Required | Default | Description |
| --- | --- | --- | --- |
| `TEST_DATABASE_URL` | No | None | MariaDB connection string used by integration tests that exercise schema and repository behavior. |
| `TEST_DATABASE_ALLOW_TRUNCATE` | No | Not enabled | Set to `1` to allow integration tests to truncate tables in the configured test database. |

## Schema + seed data

Schema files live in `config/schema` with one `<table>.sql` per table.
Optional seed data lives in `config/seed` with one `<table>.sql` per table.
On startup, any schema file whose table is missing is executed once, and its
matching seed file (if present) is executed immediately afterward.
The current schema targets an empty database and uses UUID string identifiers
for users, workspaces, services, environments, owners, and relationships.

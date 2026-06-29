# Service Availability Scheduler

Minimal Node.js app to claim services per environment with password-based login and
timed reservations.

Authentication uses email + password + bearer JWT tokens. Clients call
`POST /api/login` to receive a signed token, then send that token with protected
API calls using the `Authorization: Bearer <token>` header.

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
| `SESSION_SECRET` | No | `dev-secret-change-me` | JWT signing secret. Set this outside local development. |
| `RUN_MIGRATIONS_ON_STARTUP` | No | `true` | When true, runs checked-in SQL migrations on startup. Set to `false` to skip startup migrations when running migrations separately. |
| `PORT` | No | `3000` | HTTP port used by `npm start` and `npm run dev`. |
| `APP_VERSION` | No | `development` | Version string exposed in page footers. Docker images built with `docker/build.sh --release <tag>` set this to the release tag automatically. |

### Application file config

Edit `config/app.yml` for app timing behavior.

| Key | Default | Unit | Description |
| --- | --- | --- | --- |
| `expiry_warning_minutes` | `5` | minutes | Lead time for reservation expiry warning events. |
| `auto_refresh_seconds` | `60` | seconds | Browser service-availability auto-refresh interval returned by `/api/services`. Values below `1` second are clamped by the browser scheduler. |
| `jwt_expires_in_seconds` | `3600` | seconds | JWT access token lifetime in seconds. |
| `password_reset_token_expires_in_seconds` | `3600` | seconds | Password reset token lifetime in seconds. |
| `run_migrations_on_startup` | `true` | boolean | Controls whether startup runs pending SQL migrations from `config/migrations`. |

`JWT_EXPIRES_IN_SECONDS` (environment variable) takes precedence over
`jwt_expires_in_seconds` in `config/app.yml`.

`PASSWORD_RESET_TOKEN_EXPIRES_IN_SECONDS` (environment variable) takes
precedence over `password_reset_token_expires_in_seconds` in
`config/app.yml`.

`RUN_MIGRATIONS_ON_STARTUP` (environment variable) takes precedence over
`run_migrations_on_startup` in `config/app.yml`.

Workspace admins define workspace owners, environments, and services from the
admin UI. Service creation selects existing workspace-scoped owners and
environments; it does not create them inline.

## Authentication API Contract

- `POST /api/login`: accepts `{ "email": "user@example.com", "password": "secret" }`, returns:
  - `ok: true`
  - `user`
  - `token`
  - `token_type: "Bearer"`
  - `expires_in_seconds`
- `POST /api/password-reset/captcha`: returns `challenge_id` and `challenge_prompt`.
- `POST /api/password-reset/request`: validates CAPTCHA and creates or replaces an
  active reset token for existing users. Response is generic and does not expose
  whether an account exists.
- `POST /api/password-reset/validate`: validates `{ "token" }` and returns `ok: true` for active tokens.
- `POST /api/password-reset`: accepts `{ "token": "...", "password": "...", "confirm_password": "..." }`, requires matching password and confirmation, sets the user password, and returns generic success. Responses are generic and do not return a token.
- `POST /api/renew`: protected endpoint that issues a replacement token and
  returns the same response shape.
- `POST /api/logout`: protected endpoint maintained for compatibility; server-side
  logout is stateless.
- `GET /api/me`: protected endpoint returning authenticated user identity from the
  token context.
- Protected API calls send `Authorization: Bearer <token>`.

Client stores the token in `localStorage` (`auth_token`) and calls
`/api/renew` before expiry when possible. A failed authorized call (`401`) clears
the token and redirects to `/login`.

Reset URLs are currently logged temporarily for existing users and include a TODO
note to replace this with email delivery. Reset URLs are never returned in API
responses.

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

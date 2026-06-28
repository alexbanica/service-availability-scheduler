# Service Availability Scheduler

Minimal Node.js app to claim services per environment with email-only login and timed reservations.

Authentication uses email + bearer JWT tokens. Clients call `POST /api/login` to
receive a signed token, then send that token with protected API calls using the
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
| `PORT` | No | `3000` | HTTP port used by `npm start` and `npm run dev`. |
| `APP_VERSION` | No | `development` | Version string exposed in page footers. Docker images built with `docker/build.sh --release <tag>` set this to the release tag automatically. |

### Application file config

Edit `config/app.yml` for app timing behavior.

| Key | Default | Unit | Description |
| --- | --- | --- | --- |
| `expiry_warning_minutes` | `5` | minutes | Lead time for reservation expiry warning events. |
| `auto_refresh_seconds` | `60` | seconds | Browser service-availability auto-refresh interval returned by `/api/services`. Values below `1` second are clamped by the browser scheduler. |
| `jwt_expires_in_seconds` | `3600` | seconds | JWT access token lifetime in seconds. |

`JWT_EXPIRES_IN_SECONDS` (environment variable) takes precedence over
`jwt_expires_in_seconds` in `config/app.yml`.

Workspace admins define workspace owners, environments, and services from the
admin UI. Service creation selects existing workspace-scoped owners and
environments; it does not create them inline.

## Authentication API Contract

- `POST /api/login`: accepts `{ "email": "user@example.com" }`, returns:
  - `ok: true`
  - `user`
  - `token`
  - `token_type: "Bearer"`
  - `expires_in_seconds`
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

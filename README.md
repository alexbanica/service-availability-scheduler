# Service Availability Scheduler

Minimal Node.js app to claim services per environment with email-only login and timed reservations.

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

## Config

Edit `config/app.yml` for `expiry_warning_minutes` and `auto_refresh_minutes`.
Workspace admins define workspace owners, environments, and services from the
admin UI. Service creation selects existing workspace-scoped owners and
environments; it does not create them inline.

## Schema + seed data

Schema files live in `config/schema` with one `<table>.sql` per table.
Optional seed data lives in `config/seed` with one `<table>.sql` per table.
On startup, any schema file whose table is missing is executed once, and its
matching seed file (if present) is executed immediately afterward.
The current schema targets an empty database and uses UUID string identifiers
for users, workspaces, services, environments, owners, and relationships.

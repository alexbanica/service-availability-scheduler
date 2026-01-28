# Service Availability Scheduler

Minimal Node.js app to claim services per environment with email-only login and timed reservations.

## Setup

1) Install dependencies

```bash
npm install
```

2) Create the database and tables in MariaDB

```sql
-- Run this inside your MariaDB client
SOURCE schema.sql;
```

3) Insert users manually

```sql
INSERT INTO users (email, nickname) VALUES ('jane@example.com', 'Jane');
```

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

Edit `config/services.yml` to define environments and services, plus `expiry_warning_minutes` and `auto_refresh_minutes`.

## Schema

See `schema.sql` for the full schema. Tables:
- `users`: pre-created emails + nicknames
- `reservations`: service claims with expiry and release timestamps

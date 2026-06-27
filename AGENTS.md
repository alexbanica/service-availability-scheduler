# AGENTS

## Scope
This repository is a TypeScript/Node.js reservation app for claiming services per environment with email-only login and timed reservations.

## Workflow
- Read `~/workspace.md` before implementation work.
- Behavior changes require an approved spec before implementation.
- Keep behavior deterministic and testable.
- Do not commit credentials, `.env` files, or local database dumps.

## Project Architecture
- The project is implemented with Domain Driven Design and onion architecture.
- Dependency direction is inward: controllers and infrastructure adapters may depend on service/domain contracts; entities, DTOs, and core services must stay independent of Express, MySQL, browser DOM, and filesystem/runtime details.
- `src/service-availability-scheduler.ts` is the server entrypoint and composition root.
- `src/controllers`: Express controllers and middleware for auth, pages, services, and reservations.
- `src/services`: application use cases for config loading, service catalog lookup, user login, and reservation lifecycle.
- `src/repositories`: persistence adapters; `AbstractMysqlRepository` centralizes shared MySQL behavior.
- `src/entities`: domain entities such as users, reservations, and service definitions.
- `src/dtos`: application and API data transfer objects.
- `src/helpers`: deterministic date/time helpers and other pure utilities.
- `src/db.ts`: MySQL connection and schema/seed initialization boundary.
- `public/ts`: browser-side TypeScript organized by controllers, services, helpers, DTOs, and entities.
- `config/app.yml` and `config/services.yml`: runtime behavior and service catalog configuration.
- `config/schema` and `config/seed`: startup-created schema and optional seed data.

## Naming Standards
- Interfaces are suffixed with `Interface`.
- Abstract classes are prefixed with `Abstract`.
- Implementations of abstract classes remove the `Abstract` prefix and keep the remaining name.
- Service implementations match interface names without suffix.

## Validation
- Build server and browser TypeScript with `npm run build`.
- Run lint/format only when those changes are intended, because `npm run lint` uses autofix.
- Start production build with `npm start`.
- Start development server with `npm run dev`.

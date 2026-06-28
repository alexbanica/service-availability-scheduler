# SPEC: Remove Unused Services YAML Catalog

Status: Approved

## Purpose

Remove the obsolete YAML service catalog path so the repository reflects the current database-backed workspace service model.

## Problem Statement

`config/services.yml` is no longer loaded by the server, but it remained in the repository and Docker image. Stale TypeScript code also remained for building a service list from a YAML-shaped app config DTO. This made the runtime source of service catalog data ambiguous.

## Scope

- Remove the unused `config/services.yml` file.
- Remove Docker image copying of `config/services.yml`.
- Remove unused TypeScript code that only supported the old YAML service catalog path.
- Update agent-facing repository instructions that still described `config/services.yml` as runtime service catalog configuration.
- Preserve the current database-backed service catalog behavior.

## Out Of Scope

- Changing service, workspace, owner, environment, reservation, or login behavior.
- Changing database schema or seed behavior.
- Adding service catalog import/export behavior.
- Removing `js-yaml`, because `config/app.yml` still uses YAML parsing.
- Rewriting historical approved specs or plans that mention older implementation scope.

## Inputs And Constraints

- The server entrypoint loads `config/app.yml` for timing configuration.
- Workspace owners, environments, and services are runtime data managed through the application and stored in MySQL.
- Startup schema initialization reads `config/schema` and optional matching SQL files under `config/seed`.
- The cleanup must remain limited to unused YAML service catalog artifacts and stale references.

## Deterministic Behavior Delivered

- `config/services.yml` is absent from the repository.
- Runtime Docker images no longer copy `config/services.yml`.
- The old `ServiceCatalogService` and `AppConfigDto` YAML catalog DTOs are absent.
- Repository instructions identify `config/app.yml` as timing configuration and describe services as MySQL-backed application data.
- Existing runtime behavior remains database-backed and unchanged.

## Assumptions

- No external deployment depends on `config/services.yml` being present as a mounted or inspected file, because the application no longer reads it.
- Historical specs and plans are retained as historical artifacts unless they are part of active runtime, documentation, or build behavior.

## Impact And Regression Considerations

- Docker builds should no longer fail if `config/services.yml` is absent.
- TypeScript compilation should not require the removed stale classes because no active imports referenced them.
- Operators must manage services through the app and database-backed admin flows, not through YAML edits.

## Validation Performed

- Targeted repository searches were used to identify active and stale references before edits.
- Post-change targeted searches were run for the removed YAML catalog file and stale TypeScript class names.
- `node_modules/.bin/tsc -p tsconfig.json --noEmit` was run.
- `git diff --check` was run.

## Validation Skipped

- `npm run build` was skipped because it runs clean, install, server compile, and client compile and may exceed 10 seconds.
- Full `npm test` was skipped because it is broader than this cleanup and may exceed 10 seconds.
- Docker build validation was skipped because Docker operations are not guaranteed to complete within 10 seconds.

## Documentation Changes

- Updated `AGENTS.md` so future agents do not treat `config/services.yml` as active runtime configuration.

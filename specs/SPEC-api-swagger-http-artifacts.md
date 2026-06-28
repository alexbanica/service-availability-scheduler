# API Swagger And HTTP Artifacts

Status: Approved

## Purpose

Provide checked-in API documentation and runnable HTTP examples for the current Service Availability Scheduler API surface.

## Problem Statement

The repository was missing a Swagger/OpenAPI file and an `http/` folder, which made the current API contract harder to inspect and exercise from HTTP clients.

## Scope

- Add a root `swagger.yml` OpenAPI document for the existing Express routes.
- Add an `http/` folder containing request examples for the same route set.
- Cover authentication, service availability, reservation actions, workspace management, workspace service management, owners, environments, detail rows, invitations, and event streams.
- Document bearer-token authentication for protected routes.

## Out Of Scope

- Runtime Swagger UI hosting.
- Route implementation changes.
- API behavior changes.
- Generated clients.
- Exhaustive database integration validation.

## Definitions

- Swagger file: the checked-in OpenAPI YAML artifact at `swagger.yml`.
- HTTP folder: the checked-in request-example folder at `http/`.
- Protected route: an endpoint requiring `Authorization: Bearer <token>`.

## Inputs And Constraints

- The OpenAPI and HTTP examples must match the current Express controller route paths and request/response names.
- The artifacts must not include real credentials, real bearer tokens, database dumps, or environment-specific secrets.
- Examples must use replaceable variables for token, workspace, owner, environment, service, and service-key values.
- The change is documentation-only and must not modify production TypeScript behavior.

## Deterministic Behavior Delivered

- `swagger.yml` documents the current API route set with OpenAPI 3.0.3, bearer authentication, request bodies, common error responses, and response schemas.
- `http/api.http` provides variable-driven example requests for login, auth renewal, current user, logout, service listing, claim/release/extend, workspace listing/creation, workspace services, owners, environments, workspace detail rows, and invitations.
- Server-sent event routes are represented in the OpenAPI artifact as `text/event-stream` responses.

## Assumptions

- A root-level `swagger.yml` is the expected Swagger artifact location because no prior repository convention existed.
- A single `http/api.http` file is sufficient for the missing HTTP folder because the current API surface is compact enough to keep examples discoverable in one place.

## Impact And Regression Considerations

- No runtime code paths are changed.
- The primary regression risk is documentation drift if routes change without updating these artifacts.
- The OpenAPI artifact is hand-authored from the current controllers and is not automatically generated.

## Validation Performed

- Verified `swagger.yml` parses successfully with the repository's installed `js-yaml` dependency.
- Ran `git diff --check`.

## Validation Skipped

- `npm run lint` was skipped because this documentation-only change does not touch linted TypeScript and the `super-agent` workflow skips commands expected to exceed 10 seconds.
- `npm run build` was skipped because it is expected to exceed 10 seconds and performs `npm install`.
- `npm test` was skipped because the full automated test suite is expected to exceed 10 seconds and this change does not modify runtime code.
- Manual API calls were skipped because they require a running app and seeded local data.

## Documentation Changes

- Added `swagger.yml`.
- Added `http/api.http`.

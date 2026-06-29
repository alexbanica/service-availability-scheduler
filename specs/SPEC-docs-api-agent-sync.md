# API And Agent Documentation Sync

Status: Approved

## Purpose

Keep the repository's manual API documentation and agent guidance aligned with the current implemented authentication, account, configuration, and workspace API surface.

## Requested Behavior

The root `swagger.yml`, `http/api.http`, and `AGENTS.md` files must reflect the latest implemented service behavior, including password-based JWT login, password reset, registration, account activation, public app metadata, activation-gated protected APIs, and current runtime configuration keys.

## Scope

- Update OpenAPI documentation for the current Express controller routes.
- Update HTTP request examples for the current public and protected API surface.
- Update repository agent guidance where it still describes stale product behavior, runtime configuration, or migration naming examples.
- Create this completed-work spec and its matching completed-work plan under `specs/`.

## Out Of Scope

- Production TypeScript behavior changes.
- Database schema or migration changes.
- Generated browser bundles.
- Commit or push.

## Inputs And Constraints

- `$super-agent` was explicitly requested, so this is a direct lower-assurance documentation sync.
- Manual documentation is source controlled and not generated.
- Protected workspace, service, reservation, and event APIs require an activated authenticated user and can return `403`.
- Passwords are at least 8 characters.
- Reset and activation links are logged server-side until email delivery exists.

## Deterministic Behavior Delivered

- `swagger.yml` documents password login, reset CAPTCHA/request/validate/consume, registration CAPTCHA/register, activation validate/activate, `/api/app-info`, activation state in user payloads, and relevant request/response schemas.
- `http/api.http` includes example requests for the current unauthenticated account endpoints and password login payload.
- `AGENTS.md` describes the app as password/JWT, registration, activation, and password-reset based, and lists current config/env keys and migration file naming examples.

## Assumptions

- The latest implemented behavior is the current checked-out controller and service code on `main`.
- The request is documentation-only because no runtime behavior change was requested.

## Impact And Regression Considerations

- Runtime behavior is unchanged.
- API consumers and future agents get less stale guidance for current auth/account flows.
- The OpenAPI file remains manual and can drift again if future route changes do not update it.

## Validation Performed

- Parsed `swagger.yml` with `js-yaml`.
- Ran `git diff --check`.

## Validation Skipped

- `npm run build`, `npm run lint`, and `npm test` were skipped because `$super-agent` allows only checks expected to complete within 10 seconds and those commands are expected to exceed that limit in this repo.
- QA and code review were skipped by `$super-agent` design.

## Documentation Changes

- Updated `AGENTS.md`.
- Updated `swagger.yml`.
- Updated `http/api.http`.

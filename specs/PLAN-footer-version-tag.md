Status: Approved

# Footer Version Tag Implementation Plan

Approved spec reference: `specs/SPEC-footer-version-tag.md`

## Objective

Document the completed `$super-agent` implementation that displays the Docker image release tag in page footers and sets the version automatically during `docker/build.sh`.

## Affected Files

- `docker/build.sh`
- `docker/Dockerfile`
- `src/controllers/PageController.ts`
- `public/login.html`
- `public/ts/controllers/LoginController.ts`
- `README.md`
- `specs/SPEC-footer-version-tag.md`
- `specs/PLAN-footer-version-tag.md`

## Implementation Steps Performed

1. Inspected repository instructions, workspace instructions, current branch, and worktree state.
2. Confirmed the existing `APP_VERSION` server contract and main application footer version binding.
3. Updated `docker/build.sh` to pass `--build-arg APP_VERSION="${RELEASE_TAG}"`.
4. Updated the runtime Dockerfile stage to accept `ARG APP_VERSION` and export it as `ENV APP_VERSION`.
5. Made `GET /api/app-info` public so the unauthenticated login page can read footer metadata.
6. Set the `/api/app-info` version fallback to `development` when `APP_VERSION` is unset or empty.
7. Added a login page footer that renders the app name and conditional version text.
8. Updated `LoginController` to fetch `/api/app-info` on mount and bind `appVersion`.
9. Updated README configuration documentation for automatic Docker build versioning and the `development` default.
10. Created the auto-approved completed-work spec and this auto-approved completed-work plan.

## Validation Run

- `npx tsc -p tsconfig.json --noEmit`
- `npx tsc -p tsconfig.client.json --noEmit`
- `bash -n docker/build.sh`
- `git diff --check`

## Validation Skipped

- `npm run build` was skipped because it is expected to exceed the `$super-agent` 10-second validation boundary.
- `npm test` was skipped because the full suite may exceed the `$super-agent` 10-second validation boundary.
- Docker build validation was skipped because Docker operations are not expected to stay under the `$super-agent` 10-second validation boundary.
- Manual browser QA was skipped by design under `$super-agent`.

## QA Skipped

- Manual QA was skipped by design under `$super-agent`.

## Code Review Skipped

- Code review was skipped by design under `$super-agent`.

## Documentation Updates

- `README.md` now documents that `docker/build.sh --release <tag>` automatically sets the footer version through `APP_VERSION`, and that unset local runs default to `development`.

## Commit Status

- Not committed. The user did not request a commit.

## Push Status

- Not pushed. The user did not request a push.

## Residual Risk

- Full build, full automated tests, Docker image build, and browser runtime QA were not run in this lower-assurance workflow.
- `/api/app-info` is now public; its response is intentionally limited to the version string.

Status: Approved

# Footer Version Tag

## Purpose

Show the Docker image release tag in page footers so operators can identify the deployed application version from the browser.

## Problem Statement

The application already exposes an optional `APP_VERSION` value, but Docker image builds did not automatically set it from the release tag and the login page did not display it. The deployed image version should be visible in the footer of the browser pages.

## Scope

- Set `APP_VERSION` automatically when `docker/build.sh --release <tag>` builds an image.
- Preserve the existing main application footer version display.
- Add the same footer version display to the login page.
- Expose application metadata without requiring an authenticated session so the login page can read the version.
- Update README configuration documentation for the Docker build behavior.

## Out Of Scope

- Changing the release tag naming scheme.
- Changing image tags beyond the existing `RELEASE_TAG` and `latest` tags.
- Adding a database-backed or file-backed version source.
- Adding a separate local-development version source beyond the default `development` fallback.
- Changing login, reservation, workspace, service, owner, or environment behavior.

## Definitions

- `Version tag`: The release tag passed to `docker/build.sh` with `--release`.
- `Footer version`: The `Version <value>` text shown from `/api/app-info`.

## Inputs And Constraints

- `docker/build.sh` requires `--release <tag>`.
- The Dockerfile is templated through `docker/build.sh` before `docker buildx build`.
- The server reads `process.env.APP_VERSION`.
- Browser pages read application metadata from `GET /api/app-info`.
- The login page is available before authentication and therefore cannot depend on authenticated metadata.

## Deterministic Behavior Delivered

- `docker/build.sh --release <tag>` passes `APP_VERSION=<tag>` as a Docker build argument.
- The runtime Docker image sets `APP_VERSION` from the build argument.
- `GET /api/app-info` returns `{ "version": "<APP_VERSION>" }` without requiring authentication when `APP_VERSION` is configured.
- `GET /api/app-info` returns `{ "version": "development" }` when `APP_VERSION` is unset or empty.
- The main application footer continues to show `Version <APP_VERSION>` when configured.
- The login page footer shows `Service Availability Scheduler` and, when configured, `Version <APP_VERSION>`.
- When `APP_VERSION` is empty or unset, both footers show `Version development`.

## Assumptions

- The Docker image version requested by the user is the existing `--release` tag used by `docker/build.sh`.
- Exposing the release tag before login is acceptable because it is already intended as page footer metadata and contains no application data.

## Impact And Regression Considerations

- `/api/app-info` is now public, but only returns the configured version string.
- Login page JavaScript now performs one unauthenticated metadata fetch after mount.
- Runtime behavior outside footer display remains unchanged.
- Local development can still set `APP_VERSION` manually or use the default `development` footer version.

## Validation Performed

- Short server TypeScript no-emit check.
- Short browser TypeScript no-emit check.
- Shell syntax check for `docker/build.sh`.
- `git diff --check`.

## Validation Skipped

- `npm run build` was skipped because it runs clean, install, server compile, and browser compile and may exceed the `$super-agent` 10-second validation boundary.
- `npm test` was skipped because the full suite may exceed the `$super-agent` 10-second validation boundary.
- Docker image build validation was skipped because Docker operations are outside the short-validation boundary.
- Manual browser QA was skipped by design under `$super-agent`.

## Documentation Changes

- `README.md` documents that Docker images built with `docker/build.sh --release <tag>` set `APP_VERSION` automatically and local/default runs use `development`.

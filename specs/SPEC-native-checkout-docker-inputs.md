# Spec: Native Checkout Docker Inputs

Status: Approved

## Purpose

Remove obsolete source-download-era Docker inputs while retaining the existing
GitHub Actions checkout as the release image source.

## Requested Behavior

- The checked-out repository root remains the Docker build context.
- The wrapper passes only Dockerfile inputs that are consumed.
- `docker/.env` contains only active image-tag and local-registry defaults.

## Scope

- `docker/.env`, `docker/build.sh`, and inspection of the Dockerfile and
  publication workflow.

## Out Of Scope

- Application behavior, image base digest, tags, ARM64 runner selection,
  registry credentials, Docker execution, and live publication.

## Definitions And Constraints

`Native checkout` means project files populated by `actions/checkout` form the
root Docker build context. `BASE_IMAGE_VERSION` remains an image-tag suffix even
though the Dockerfile base is digest-pinned.

## Deterministic Behavior Delivered

1. Unused build-base, GitHub repository, legacy Docker CLI, and upload-tuning
   `.env` entries are absent.
2. The wrapper no longer substitutes unused Dockerfile placeholders or passes
   unused GitHub/release build arguments.
3. `APP_VERSION`, tags, registry selection, and root context remain unchanged.

## Assumptions And Impact

The existing Dockerfile already prohibits GitHub downloads and secret mounts.
No API, runtime, or documentation contract changes.

## Validation Performed

- Wrapper syntax check.
- Workflow-equivalent metadata emission and `git diff --check`.

## Validation Skipped

- Full project tests, Docker builds, hosted GitHub Actions, Forgejo login/push,
  QA, and independent code review.

## Documentation Changes

Only this retrospective spec and its matching plan were added.

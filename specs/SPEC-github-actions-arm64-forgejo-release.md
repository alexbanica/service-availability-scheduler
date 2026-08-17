# Native ARM64 GitHub Actions Forgejo Release

Status: Approved

## Purpose

Publish this project's ARM64-only container image from a native GitHub-hosted
ARM64 runner without QEMU, a separately provisioned Buildx builder, or
`docker/build-push-action`.

## Requested Behavior

The tag release workflow must avoid the failing Buildx bootstrap that pulls the
`moby/buildkit:buildx-stable-1` helper image. Because this project releases only
`linux/arm64`, its publication job must build directly on an ARM64 environment
with the Docker Engine already provided by that environment.

## Scope

- Run the image publication job on GitHub's `ubuntu-24.04-arm` hosted runner.
- Retain tag-only release triggering, metadata preparation, immutable image
  naming, moving latest tag publication, Forgejo login, read-only GitHub
  permissions, digest reporting, and unconditional Forgejo logout.
- Replace QEMU setup, Buildx setup, `docker/build-push-action`, and its GitHub
  Actions cache configuration with one ordinary `docker build` and one
  push per emitted tag in each image-matrix row.
- Verify the runner reports `aarch64` and the emitted platform is exactly
  `linux/arm64` before building.
- Document the release workflow in operator documentation.
- Isolate the Docker build-script contract test from an ambient runner
  `GITHUB_OUTPUT` while preserving explicit output paths supplied by individual
  metadata-mode cases.
- Do not create, update, require, or retain workflow-specific unit tests for
  GitHub Actions configuration; remove the existing release and validation
  workflow parser tests.
- Do not make Forgejo repository privacy or anonymous-pull denial a release
  acceptance check.

## Out Of Scope

- Changing the default-branch validation workflow.
- Changing `docker/build.sh`, `docker/Dockerfile`, the image contents, the local
  build interface, or the release tag and registry mapping.
- Adding multi-platform publication or restoring an x64/emulated release path.
- Changing Forgejo organization visibility, credentials, TLS, or registry
  configuration.
- Changing application or API behavior; `swagger.yml` and `http/*.http` are
  unaffected.
- Performing a live tag push, image build, registry login, or publication.

## Definitions

- **Native ARM64 runner:** GitHub-hosted Ubuntu selected by
  `runs-on: ubuntu-24.04-arm`, with an `aarch64` host architecture.
- **Ordinary Docker build:** `docker build` executed through the runner's
  preinstalled Docker Engine, without invoking `docker buildx` or a Buildx
  setup action.

## Inputs And Constraints

- The release trigger remains every pushed Git tag.
- The unprivileged preparation job continues to validate the tag and emit the
  matrix through `docker/build.sh --emit-github-matrix`.
- The only supported publication platform is `linux/arm64`.
- The image remains
  `forgejo.alexlab.nl/alexlab/service-availability-scheduler:<tag>-node24-alpine`.
- Each release also publishes
  `forgejo.alexlab.nl/alexlab/service-availability-scheduler:latest-node24-alpine`.
- `APP_VERSION`, context, Dockerfile, platform, and image references come from
  the validated matrix through step environment variables.
- Publication uses only `FORGEJO_REGISTRY_USERNAME` and
  `FORGEJO_REGISTRY_TOKEN`.
- GitHub workflow permissions remain `contents: read`.

## Deterministic Behavior Delivered

1. The preparation job checks out the tag target and emits the validated release
   matrix without registry credentials or Docker execution.
2. The dependent publication job starts on `ubuntu-24.04-arm` and checks out the
   same tag target.
3. The job logs in to `forgejo.alexlab.nl` with the existing pinned login action.
4. Before building, the step fails unless `uname -m` is `aarch64` and the matrix
   platform is `linux/arm64`.
5. For each matrix row, the job executes exactly one `docker build` with the
   emitted platform, Dockerfile, application version, immutable image tag,
   latest image tag, and context.
6. The job pushes both the immutable release image and the moving latest image.
7. It obtains the pushed repository digest from the local Docker image metadata
   and writes both tags and the digest to `GITHUB_STEP_SUMMARY`.
8. Forgejo logout runs with `if: always()` after the publication step.
9. The build-script test harness removes the parent process's `GITHUB_OUTPUT`
   before spawning `docker/build.sh`. A case that needs an output file must pass
   its own explicit path, so the missing-output case behaves identically on a
   developer machine and inside GitHub Actions.
10. `AGENTS.md` makes GitHub Actions workflow tests explicitly out of policy.
    The two existing workflow parser tests are removed; workflow changes use
    direct syntax and static inspection rather than unit-test maintenance.
11. Release acceptance no longer depends on Forgejo repository privacy or an
    anonymous-pull denial check.

The workflow contains no QEMU setup, Buildx setup, `docker buildx` command,
`docker/build-push-action`, or `type=gha` Docker layer-cache configuration.

## Assumptions

- GitHub makes `ubuntu-24.04-arm` available to this repository. GitHub's current
  hosted-runner reference lists it as a standard ARM64 label.
- The GitHub ARM64 image continues to include a usable Docker Client and Docker
  Server; the current runner-image manifest lists both.
- The pinned base image remains available from its upstream registry. Removing
  the Buildx helper pull does not remove normal base-image network access needed
  by `docker build`.
- Cross-run Docker layer caching is intentionally removed. Each ephemeral
  publication runner may perform a clean image build.

## Impact

- The reported failure path is removed because the workflow no longer creates a
  Buildx Docker-container builder or pulls its BuildKit helper image.
- ARM64 publication no longer incurs x64 emulation overhead.
- Releases lose the prior GitHub Actions Docker layer cache and may take longer
  when dependencies and image layers are not already present on the runner.
- Local `docker/build.sh` behavior remains unchanged and may still use Buildx;
  the GitHub release workflow uses only its non-building metadata mode.
- The failing build-script contract is corrected without weakening production
  validation: only inherited test-process state is removed.
- Release delivery no longer remains draft solely because repository privacy or
  anonymous-pull denial was not verified.

## Validation Performed

- Direct `js-yaml` static inspection parsed both GitHub Actions workflows after
  the test-policy change.
- Repository-path checks confirmed both workflow-specific unit-test files are
  absent.
- The focused Docker build-script contract test passed with a valid ambient
  `GITHUB_OUTPUT`, reproducing the GitHub Actions environment that previously
  caused the missing-output assertion to fail.
- `git diff --check` passed before the completed-work artifacts were written and
  is rerun during final reconciliation.

## Validation Skipped

- Full lint, full tests, TypeScript builds, and Docker builds exceed the
  `$super-agent` short-validation limit and were not run.
- No workflow-specific unit test is run because repository guidance now excludes
  that test category.
- No live GitHub Actions run, tag push, Forgejo login/push, or runtime ARM64
  image validation was performed.
- QA and independent code review are skipped by the requested workflow.

## Documentation Changes

`README.md` now documents the native `ubuntu-24.04-arm` publication job,
ordinary Docker build/push sequence, architecture guards, removal of the Buildx
helper path, removal of workflow Docker layer caching, and removal of the
Forgejo privacy acceptance check.

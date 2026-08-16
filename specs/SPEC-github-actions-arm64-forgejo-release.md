# GitHub Actions CI And Private ARM64 Forgejo Release

Status: Approved

## Purpose

Add repository-scoped GitHub Actions that continuously validate the Node.js
project and publish this repository's release image for `linux/arm64` when a Git
tag is pushed, without publishing any image outside the private Forgejo
container registry.

## Iteration 2026-08-16 - Single-Build Release Metadata Handoff

The first implementation attempt exposed an execution conflict in the approved
plan: `docker/build.sh` was required to perform the release build as the image
inventory source of truth, while `docker/build-push-action` was independently
required to perform the cached build and push. Running both would duplicate the
release build and could duplicate publication; mentioning either path without
executing it would create a false contract.

This iteration preserves the approved external release behavior and resolves
the conflict by adding a non-building metadata mode to `docker/build.sh`. The
tag-validation job invokes that mode to validate the tag and emit the complete
current image matrix. The publication job consumes that matrix in one real
`docker/build-push-action` execution per script-managed image. The workflow does
not reconstruct an independent image name, Dockerfile, context, platform,
application version, or cache scope, and `docker/build.sh` does not perform a
second CI build or push.

## Problem

The repository has no checked-in GitHub Actions workflow. Pull requests and
changes merged or pushed to the default branch therefore have no repository
defined lint or test gate.

The existing Docker release path is designed for an operator's local build:

- `docker/build.sh` loads `docker/.env`, whose registry is
  `registry.pi.home:5000`;
- it builds the single `service-availability-scheduler` image and tags both the
  requested release and a moving `latest` variant with a Node base-image suffix;
- it accepts a platform override but does not default release automation to
  `linux/arm64`;
- the Dockerfile downloads a GitHub archive by release name during the build
  rather than consuming the exact source already checked out by CI; and
- the build requires a local GitHub-auth secret file even though its
  authorization header is currently commented out.

Those behaviors are not a deterministic, secret-minimized CI release contract
and do not target the requested private registry. The CI path must be made
explicit without breaking the documented local build command or changing its
local registry default.

## Confirmed Repository Evidence

- Local Git metadata resolves `origin/HEAD` to `origin/main`, the invoking
  checkout is on `main`, and `main` tracks `origin/main`.
- `package.json` defines `npm run lint` as ESLint with `--fix` and defines
  `npm test` as the Node test runner over `src/tests/**/*.test.ts`.
- Database integration tests are part of that test glob but skip unless both
  `TEST_DATABASE_URL` and `TEST_DATABASE_ALLOW_TRUNCATE=1` are supplied.
- `package-lock.json` exists with lockfile version 3.
- `docker/build.sh` manages one image,
  `service-availability-scheduler`, and currently emits
  `<release>-node24-alpine` and `latest-node24-alpine` tags.
- `docker/Dockerfile` is the only Dockerfile in scope and produces one final
  runtime image.
- No `.github` workflow exists in the current checkout.

## Scope

- Add GitHub Actions validation for pull requests targeting the repository
  default branch and for pushes to that branch, including merge commits.
- Run the repository's existing lint and test entry points in validation jobs.
- Add tag-triggered release automation for every pushed Git tag.
- Build every final image managed by this repository's `docker/build.sh` and
  Dockerfile inputs; the current image inventory is exactly one image.
- Build release images only for `linux/arm64`.
- Publish release images only under
  `forgejo.alexlab.nl/alexlab` and require private access.
- Define deterministic source selection, image naming, tag mapping,
  authentication, permissions, caching, and failure behavior.
- Add a deterministic, non-building GitHub Actions metadata-output mode to
  `docker/build.sh` so the workflow can consume the script-managed image
  inventory without triggering a duplicate build.
- Make only the scoped Dockerfile, build-script, package-script, workflow,
  ignore-file, and documentation changes needed to establish this contract.
- Preserve the documented local Docker build interface and its existing local
  registry default.

## Out Of Scope

- Adding GitHub Actions to any sibling workspace project.
- Running GitHub Actions on non-default branches except through a pull request
  targeting the default branch.
- Publishing images from pull requests or default-branch pushes.
- Publishing to GitHub Container Registry, Docker Hub,
  `registry.pi.home:5000`, or any registry other than
  `forgejo.alexlab.nl` from CI.
- Publishing `linux/amd64` or a multi-platform manifest.
- Creating or changing the Forgejo organization, its visibility, users, teams,
  tokens, reverse proxy, TLS certificates, or registry service configuration.
- Creating GitHub repository secrets or changing GitHub repository settings.
- Supplying a CI database or making currently optional database integration
  tests mandatory.
- Changing application behavior, public APIs, `swagger.yml`, or `http/*.http`.
- Automatically updating base-image versions or dependency versions.
- Performing a production deployment of a published image.

## Definitions

- **Default branch**: the branch referenced by `origin/HEAD`. For this
  repository it is currently `main`.
- **Validation workflow**: the unprivileged GitHub Actions behavior that runs
  lint and tests without registry credentials or image publication.
- **Release workflow**: the GitHub Actions behavior triggered only by a pushed
  Git tag and permitted to authenticate to Forgejo and publish an image.
- **Release tag**: the exact short Git tag name from the tag-push event.
- **Release source**: the immutable commit targeted by the pushed Git tag and
  checked out by the release job.
- **Image base name**:
  `forgejo.alexlab.nl/alexlab/service-availability-scheduler`.
- **Version image tag**: `<release-tag>-node24-alpine`, preserving the current
  build-script suffix.
- **Moving image tag**: `latest-node24-alpine`, currently produced by local
  `docker/build.sh` but intentionally not published by CI under this spec.
- **Private image**: an image whose anonymous registry pull is denied and whose
  authenticated access is governed by the private Forgejo `alexlab` owner.
- **Release metadata mode**: `docker/build.sh --emit-github-matrix`, a
  non-building mode that validates all supplied CI inputs and appends one
  single-line `matrix=<json>` output to the file identified by `GITHUB_OUTPUT`.
- **Release matrix**: a JSON object with an `include` array containing one row
  per final image managed by `docker/build.sh`. Each row contains only the
  validated `image_name`, complete immutable `image`, repository-root `context`,
  repository-relative `dockerfile`, `platform`, `app_version`, and
  `cache_scope` needed by the publication action.
- **Release preparation job**: the unprivileged job that checks out the tag
  target, invokes release metadata mode, and exposes the resulting matrix. It
  has no Forgejo secrets and performs no Docker build, login, or push.
- **Release publication job**: the matrix job that depends on successful release
  preparation, receives the two Forgejo secrets, and performs the single real
  build and push for each matrix row.

## Inputs And Constraints

- The approved default-branch filter is `main`, based on the current local
  `origin/HEAD` evidence. The original request's `master` wording is superseded
  for this repository.
- CI uses the checked-in lockfile and a supported Node 24 runtime, aligned with
  the current Docker base-image major version.
- CI release input comes only from a Git tag push in this GitHub repository.
  Workflow-dispatch publication and pull-request publication are not allowed.
- The release source must be the commit resolved by the tag event. A mutable
  remote tag lookup or an independently downloaded archive must not select the
  CI release source.
- All final image layers must be compatible with `linux/arm64`; success on the
  runner's native architecture alone is insufficient.
- Base-image inputs must be immutable for the build, using manifest digests that
  include `linux/arm64`. Human-readable Node/Alpine versions remain visible in
  the build contract and image tag suffix.
- A release tag is valid only when appending `-node24-alpine` produces a valid
  Docker/OCI tag and the original release tag is lowercase. Invalid or
  case-colliding tag names fail before registry login or build and publish
  nothing.
- The release tag is passed unchanged as the application's `APP_VERSION`.
- CI registry configuration must explicitly override the local
  `DOCKER_REGISTRY_URI`; it must not change the checked-in local default in
  `docker/.env`.
- Release metadata mode requires `--release`, `--registry`, `--platform`,
  `--no-latest`, and `--emit-github-matrix`; it requires `GITHUB_OUTPUT` to name
  an existing writable workflow-output file and fails without invoking Docker
  when any required input or output destination is missing or invalid.
- In release metadata mode, the registry must be exactly
  `forgejo.alexlab.nl/alexlab`, the platform must be exactly `linux/arm64`, and
  moving tags are forbidden. The mode emits no credential, token, environment
  dump, shell command, or unvalidated user-controlled key.
- The release tag accepted by metadata mode matches
  `^[a-z0-9_][a-z0-9_.-]*$`, and the complete tag after appending
  `-node24-alpine` must not exceed the Docker tag limit of 128 characters.
  Local non-metadata builds retain their existing operator-controlled tag
  handling.

## Default-Branch And Event Behavior

### Pull Requests

- The validation workflow runs for pull requests whose base branch is `main`.
- It runs when such a pull request is opened, reopened, marked ready for review,
  or synchronized with new commits.
- It validates the GitHub-provided pull-request merge result so the proposed
  change is checked against the current target branch.
- It uses the `pull_request` event, not `pull_request_target`, and receives no
  Forgejo credentials.

### Default-Branch Pushes And Merges

- The validation workflow runs for every push to `main`.
- A pull-request merge is covered by the resulting push to `main`; no separate
  merge-only trigger is required.
- Direct pushes and merge commits follow the same lint and test behavior.

### Tag Pushes

- Every Git tag push starts a release workflow run, subject to the deterministic
  release-tag validation above.
- Tag creation without a push does not trigger GitHub Actions.
- Deleting a tag publishes nothing.
- A tag workflow does not run merely because a similarly named branch is pushed.
- Release runs for distinct tags must not overwrite or cancel one another.
- A successful tag event first completes the unprivileged release preparation
  job. Forgejo authentication and publication cannot begin when preparation or
  metadata validation fails.

## Validation Workflow Behavior

1. Check out the exact event source with no persisted write credential.
2. Install Node 24 and dependencies from `package-lock.json` using the clean,
   lockfile-enforcing install path.
3. Run the exact project lint entry point: `npm run lint`.
4. Because that command currently includes `--fix`, fail validation if linting
   changes any tracked file. CI must not treat an auto-corrected worktree as a
   passing clean result.
5. Run the exact project test entry point: `npm test`.
6. Report skipped database integration tests as skips, not as executed database
   coverage. No database credential is introduced by this scope.
7. Publish no package, image, build artifact, or mutable repository content.

Lint and tests may run as separate jobs or one job, but both are required status
outcomes for every in-scope event. Failure or cancellation of either means the
validation run is not successful.

## Release Image Behavior

1. In the unprivileged preparation job, check out the immutable tag target and
   invoke `docker/build.sh --emit-github-matrix` with the exact approved
   registry, platform, immutable-tag, and release inputs.
2. Validate the release tag and complete script-managed image matrix before any
   publication job can access a release secret.
3. In the dependent publication job, check out the same immutable tag target
   with no persisted write credential.
4. Authenticate only to `forgejo.alexlab.nl` using the approved GitHub Actions
   secrets.
5. For each emitted matrix row, execute one pinned
   `docker/build-push-action` build using only the emitted context, Dockerfile,
   platform, application version, immutable image, and cache scope. At present
   the matrix contains one final image from `docker/Dockerfile` for
   `linux/arm64`.
6. Set the current image reference to:

   `forgejo.alexlab.nl/alexlab/service-availability-scheduler:<release-tag>-node24-alpine`

7. Set application `APP_VERSION` to the exact release tag.
8. Push only that immutable version reference. CI must not push
   `latest-node24-alpine`; retaining that local moving tag is allowed only for
   the existing operator-controlled local build behavior.
9. Fail the workflow if preparation, build, registry authentication, or any
   push fails. A
   partially published multi-image release, should additional images be added
   later, is not reported as successful.
10. Record the action-produced pushed digest for each final image in the
    workflow result without
   exposing credentials.
11. Log out or remove the job-scoped registry credential when publication work
    completes.

The release workflow must use the release matrix emitted by the repository's
build contract rather than duplicating an independent image list. The workflow
must not run `docker/build.sh` in normal build mode and must not execute another
Docker build in addition to `docker/build-push-action`. If `docker/build.sh`
later manages more than one final image, the emitted matrix must include all of
them; the same tag event builds all rows for `linux/arm64`, gives each a distinct
cache scope, and constrains every image to the approved Forgejo owner prefix.

## Deterministic Docker Build Contract

- `docker/build.sh` remains the source of truth for the images it manages, their
  Dockerfile inputs, release suffix, and application version input.
- The documented local invocation
  `docker/build.sh --release <tag>` remains valid from the `docker` directory.
- Without a CI registry override, local builds continue to use the existing
  `docker/.env` registry and retain the existing two-tag behavior.
- CI has an explicit, fail-closed way to override the registry, select only
  `linux/arm64`, select the immutable checked-out source, disable the moving
  `latest` tag, and request a push.
- CI metadata mode shares the same internal image inventory, suffix, registry,
  context, Dockerfile, platform, and application-version assembly as normal
  build mode but exits successfully without invoking Docker after appending the
  validated release matrix to `GITHUB_OUTPUT`.
- Metadata mode writes exactly one `matrix=` output whose JSON parses as an
  object with an `include` array. It rejects newline-bearing values, unsupported
  registries or platforms, moving-tag requests, absent or unwritable
  `GITHUB_OUTPUT`, unknown options, and combinations with normal-build-only
  options that could make its non-building behavior ambiguous.
- Normal local mode remains the only script mode that directly invokes
  `docker buildx build`. The GitHub release workflow uses metadata mode only;
  `docker/build-push-action` is the only CI release build and push executor.
- Argument parsing rejects missing option values and unknown options instead of
  silently shifting past them.
- The CI build must not require `docker/secrets/.github_auth` or download the
  release source again. Local remote-source compatibility may continue to use
  that ignored file, but secret values must never appear in shell trace or
  image layers.
- Dependency installation used by the image build must honor
  `package-lock.json`; a nested unrestricted install must not replace the locked
  dependency graph during CI image creation.
- Build timestamps, mutable remote source resolution, host architecture, and
  cache hits must not change which source revision, dependencies, base-image
  manifests, platform, image name, or application version is produced.
- Cached and uncached builds of the same release inputs must resolve to the same
  functional image contents. Bit-for-bit image digest reproducibility is not
  claimed because upstream build tooling may emit metadata unless separately
  normalized.

## Registry Authentication, Privacy, And Permissions

- GitHub Actions uses these repository or organization secrets:
  - `FORGEJO_REGISTRY_USERNAME`: a dedicated Forgejo service-account username;
  - `FORGEJO_REGISTRY_TOKEN`: that account's Forgejo personal access token.
- The token has the minimum Forgejo package capability that permits a push
  (`write:package`) and the service account has only the organization access
  needed to write packages owned by `alexlab`.
- The token must be created with access to private resources; a `Public only`
  token cannot satisfy this contract. A dedicated service account limits the
  broader exposure implied by Forgejo package tokens that cannot be restricted
  to one specific repository.
- Workflows declare only `contents: read` for the GitHub-provided token; all
  unlisted GitHub token permissions are `none`. External Forgejo publication
  does not require GitHub `packages: write`.
- Forgejo credentials are referenced only by the tag release job. They are not
  available to pull-request or default-branch validation steps.
- The workflow must never echo credentials, persist them in the checked-out
  repository, pass them as ordinary Docker build arguments, include them in
  build cache, or upload them as artifacts.
- The registry host must provide a valid publicly trusted TLS chain and the
  Forgejo reverse proxy must expose the standard `/v2` container-registry path.
  TLS verification must not be disabled.
- Forgejo package visibility follows the package owner's visibility. The
  `alexlab` organization must therefore be confirmed private before secrets are
  configured or a tag is pushed. If it is public, unknown, or anonymous access
  succeeds, release enablement is blocked; the workflow must not compensate by
  weakening access controls or publishing elsewhere.

## Caching

- Node dependency caching is keyed from `package-lock.json` and cannot replace
  the lockfile-enforcing install.
- Docker layer caching uses the GitHub Actions cache backend, not a public cache
  image and not an additional tag in Forgejo.
- Docker cache scope includes at least the image identity and target platform so
  future multi-image or multi-platform work cannot overwrite an unrelated
  cache.
- The publication action derives `cache-from` and `cache-to` from each emitted
  `cache_scope`, using `type=gha` for restore and
  `type=gha,mode=max` for export. The workflow must not hard-code a second image
  inventory to construct cache scopes.
- Cache restore failure or a cache miss falls back to a clean build. Cache is a
  performance optimization, never a release prerequisite.
- Registry credentials, GitHub credentials, `.env` secrets, and secret mounts
  are excluded from cache exports and final layers.

## Assumptions Requiring Approval

Approval of this spec accepts the following explicit assumptions. If any is
false, implementation must stop for an amendment rather than silently choose a
different destination, credential, runner, or tag policy.

1. **Recommendation - default branch:** use `main`, because both the current
   checkout and local `origin/HEAD` identify it as the default. Do not use the
   original request's `master` wording.
2. **Recommendation - Forgejo owner and namespace:** accept `alexlab` as the
   exact private Forgejo organization and publish the single current image as
   `forgejo.alexlab.nl/alexlab/service-availability-scheduler`. This has not been
   verified against the live Forgejo instance.
3. **Recommendation - privacy prerequisite:** require the `alexlab`
   organization to be private and verify anonymous pull denial outside the
   workflow before considering release delivery final. Repository code cannot
   make a public Forgejo owner private.
4. **Recommendation - credentials:** use
   `FORGEJO_REGISTRY_USERNAME` and `FORGEJO_REGISTRY_TOKEN`, backed by a
   dedicated Forgejo service account and a private-resource-capable
   `write:package` token. No such account, secret, or permission has been
   confirmed from repository evidence.
5. **Recommendation - runner:** use a GitHub-hosted Linux runner with Docker
   Buildx and QEMU/binfmt support for `linux/arm64`. It is assumed to have
   outbound HTTPS access to `forgejo.alexlab.nl`, and the registry is assumed to
   use a publicly trusted TLS certificate. No native ARM64 or self-hosted runner
   is required under this assumption.
6. **Recommendation - tag mapping:** require lowercase Docker-safe Git tag names
   and map each exactly to `<git-tag>-node24-alpine`; fail rather than sanitize
   an unsafe tag because sanitization can create collisions.
7. **Recommendation - moving tag:** publish only the immutable version tag from
   CI. Preserve `latest-node24-alpine` for the existing local build default but
   suppress it in CI to avoid nondeterministic races when multiple Git tags are
   pushed close together.
8. **Recommendation - database tests:** run `npm test` without provisioning a
   destructive integration database. Existing database integration cases remain
   visible as skipped unless a separately approved change supplies isolated CI
   database infrastructure.
9. **Recommendation - single-build handoff:** use script-emitted matrix metadata
   plus one real `docker/build-push-action` execution per row. Do not run
   `docker/build.sh` in normal build mode from the release workflow, and do not
   retain a disabled or decorative action reference merely to satisfy static
   tests.

## Regression Impact

- The local build command and local registry default remain available.
- Local builds may continue to produce both version and moving tags; CI differs
  intentionally by publishing only the immutable tag.
- Tightened build-script validation can expose previously ignored mistyped or
  incomplete options as explicit failures.
- The new `--emit-github-matrix` option is additive and non-building. Its
  Forgejo-specific restrictions do not change the documented local build
  invocation or local moving-tag behavior.
- Separating dependency installation from compilation may require local users
  to follow the already documented `npm install` step before `npm run build`.
- Pull-request lint can now fail when ESLint would auto-fix tracked files, even
  if the existing lint command itself exits successfully.
- Default-branch checks run on `main`, so branch protection should refer to the
  new check names after the workflows are merged.
- No API, runtime database, frontend, or application-domain behavior changes.

## Validation Plan

- Validate workflow YAML structure and event filters with a GitHub Actions YAML
  linter when available.
- Verify action references are pinned to reviewed immutable commit SHAs and
  annotated with their upstream release versions.
- Run `npm ci`, `npm run lint`, a tracked-diff check, and `npm test` in a clean
  checkout using Node 24.
- Record how many tests pass and how many database integration tests skip when
  CI database variables are absent.
- Run shell syntax and focused argument/tag-mapping tests for
  `docker/build.sh`, including missing values, unknown options, invalid tags,
  registry override, platform selection, and moving-tag suppression.
- Run focused metadata-mode tests with a temporary `GITHUB_OUTPUT` file and a
  fake Docker executable. Confirm valid input emits exactly one parseable matrix
  with the complete current inventory and invokes Docker zero times; confirm
  invalid tag, length, registry, platform, output path, option, or mode
  combination fails before any Docker invocation or partial output.
- Parse the release workflow and prove that the preparation job has no secret
  reference, the publication job depends on preparation, the matrix comes only
  from the script output, and `docker/build-push-action` is the sole build/push
  executor with emitted inputs and `type=gha` cache settings.
- Inspect the resolved Docker build inputs to confirm immutable base-image
  digests support `linux/arm64`, the release source is the checked-out tag
  target, and no GitHub-auth file is required for CI mode.
- With the workspace-required Docker context explicitly confirmed as `local`,
  perform a non-publishing `linux/arm64` build when the local builder supports
  QEMU/binfmt. If unavailable, retain DRAFT status for ARM64 runtime build
  validation.
- Do not test a live registry push during implementation unless the user
  separately authorizes the external mutation and configured secrets are
  available.
- After operator-controlled enablement, validate one disposable conforming tag,
  record the pushed image digest and platform, confirm authenticated pull, and
  confirm anonymous pull is denied. Until that occurs, registry publication and
  privacy remain live-environment DRAFT gaps.
- Run repository-required validation appropriate to changed files, including
  `npm run build`, `npm run lint`, `npm test`, and `git diff --check`.

## Documentation Needs

- Update `README.md` with validation triggers, release triggers, required secret
  names, Forgejo image naming, release-tag restrictions, ARM64-only behavior,
  and the private-owner prerequisite.
- Document the CI registry override and moving-tag difference without changing
  the existing local registry default or local build command.
- Document that database integration tests skip unless their existing explicit
  test database variables are supplied.
- No `swagger.yml` or `http/*.http` change is required because no API contract,
  request example, response, authentication rule, or application event changes.

## Acceptance Criteria

- A pull request targeting `main` runs `npm run lint` and `npm test` without
  receiving Forgejo secrets.
- Every push to `main`, including a merge commit, runs the same two project
  commands.
- A pushed conforming Git tag builds the exact tag-target source for
  `linux/arm64` and attempts to push exactly one current image reference:
  `forgejo.alexlab.nl/alexlab/service-availability-scheduler:<git-tag>-node24-alpine`.
- Before that build begins, the unprivileged preparation job invokes
  `docker/build.sh --emit-github-matrix` and exposes one validated current-image
  row; it neither accesses Forgejo secrets nor invokes Docker.
- An invalid, uppercase, or image-tag-incompatible Git tag fails before registry
  login and publishes nothing.
- CI publishes no moving `latest` tag and no image to GitHub, Docker Hub, the
  local registry, or another Forgejo owner.
- The release job uses only the two named Forgejo secrets and least-privilege
  GitHub `contents: read` permission.
- The built image reports the exact Git release tag as `APP_VERSION` and its
  manifest contains `linux/arm64` only.
- The current single-image inventory cannot drift between the workflow and
  `docker/build.sh`; future script-managed images follow the same ARM64,
  namespace, cache-isolation, and all-or-fail rules.
- The release performs one actual build and push per emitted image row.
  `docker/build-push-action` consumes the script-emitted contract; the workflow
  does not also execute normal script build mode, duplicate image assembly, or a
  disabled/decorative build action.
- The documented local `docker/build.sh --release <tag>` path continues to use
  the local `.env` registry default and retains its existing local two-tag
  behavior.
- No build or cache layer contains Forgejo or GitHub credentials.
- Final live acceptance requires evidence that the Forgejo owner is private and
  anonymous pull of the published image is denied.

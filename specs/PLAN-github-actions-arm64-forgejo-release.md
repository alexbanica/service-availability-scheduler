# Native ARM64 GitHub Actions Forgejo Release Completed-Work Plan

Status: Approved

Spec reference:
`specs/SPEC-github-actions-arm64-forgejo-release.md`

## Objective

Record the direct `$super-agent` correction that moved Forgejo image publication
to a native GitHub-hosted ARM64 runner, removed the Buildx/QEMU release path,
and removed the Forgejo repository privacy acceptance check.

## Affected Files

- `AGENTS.md`
- `README.md`
- `.github/workflows/publish-docker-images.yml`
- `docker/build.sh`
- `src/tests/unit/docker-build-script-contract.test.ts`
- `src/tests/unit/github-actions-validation-workflow.test.ts` (removed)
- `src/tests/unit/github-actions-release-workflow.test.ts` (removed)
- `specs/SPEC-github-actions-arm64-forgejo-release.md`
- `specs/PLAN-github-actions-arm64-forgejo-release.md`

No application API behavior, Dockerfile, API contract, HTTP example, credential,
generated output, or dependency metadata was changed.

## Implementation Steps Performed

1. Confirmed the failure occurs while `docker/setup-buildx-action` creates a
   Docker-container builder and pulls `moby/buildkit:buildx-stable-1`.
2. Verified from current GitHub documentation that `ubuntu-24.04-arm` is a
   supported hosted-runner label and its runner image includes Docker Client and
   Docker Server.
3. Changed only the release publication job from `ubuntu-latest` to
   `ubuntu-24.04-arm`; the metadata-only preparation job remains on
   `ubuntu-latest`.
4. Removed the QEMU setup, Buildx setup, and `docker/build-push-action` steps.
5. Added a native publication step that validates `aarch64` and `linux/arm64`,
   performs one matrix-driven `docker build`, tags and pushes both the immutable
   release image and `latest-node24-alpine`, obtains its repository digest, and
   records both tags and the digest.
6. Extended the metadata handoff with the validated latest image reference and
   covered it in the Docker build-script contract test.
7. Updated README operator guidance and replaced stale Buildx-focused approved
   artifacts with the delivered native-ARM64 contract.
8. Reproduced the build-script contract failure with an ambient
   `GITHUB_OUTPUT`, then isolated child-process defaults from that runner-owned
   variable while retaining explicit test-case overrides.
9. Added repository guidance that GitHub Actions workflows do not require unit
   tests, then removed the existing release and validation workflow parser tests.
10. Removed the README requirement to validate private Forgejo ownership and
   anonymous-pull denial, and aligned the approved completed-work artifacts.

## Validation Run

- Direct `js-yaml` static inspection parsed `.github/workflows/ci.yml` and
  `.github/workflows/publish-docker-images.yml` successfully.
- Repository-path checks confirmed the two removed workflow-specific unit-test
  files are absent.
- The Docker build-script contract test passed when invoked with a valid ambient
  `GITHUB_OUTPUT`, confirming the GitHub Actions-only leak is isolated.
- `git diff --check` passed before artifact creation and is rerun during final
  reconciliation.

## Validation Skipped

- `npm run lint`, `npm test`, `npm run build`, and TypeScript project checks were
  skipped because the requested `$super-agent` workflow permits only validation
  expected to finish within ten seconds.
- Workflow-specific unit tests were deliberately not run because this change
  removes that test category from repository policy.
- A Docker build, live GitHub Actions tag run, Forgejo authentication/push, and
  digest verification against the registry were not run.

## QA And Code Review

- QA was skipped as required by `$super-agent`.
- Independent code review was skipped as required by `$super-agent`.
- No subagents were used.

## Documentation Updates

`README.md` now describes the native ARM64 runner, ordinary Docker build/push
path, architecture assertions, and absence of Buildx/QEMU setup and GitHub
Actions Docker layer caching. It no longer makes repository privacy or
anonymous-pull denial a release acceptance requirement.

## Staging, Commit, And Push Status

- All six accepted in-scope paths are staged for handoff.
- No unrelated path is staged.
- No commit was created.
- Nothing was pushed.

## Residual Risk

- The workflow has not run on GitHub, so runner availability and the actual
  native image build remain unverified for this repository.
- The native build still needs network access to pull the pinned base image and
  to push to Forgejo; removing the Buildx helper pull does not eliminate those
  network dependencies.
- Cross-run Docker layer caching was intentionally removed, so release duration
  may increase.
- Forgejo token scope, TLS, and successful push remain operator-owned live
  checks.
- The default Definition of Done is not fully satisfied because full validation,
  QA, review, commit, push, and live release validation were skipped.

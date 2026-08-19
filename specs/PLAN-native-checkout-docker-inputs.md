# Plan: Native Checkout Docker Inputs

Status: Approved

## Spec Reference

- `specs/SPEC-native-checkout-docker-inputs.md`

## Affected Files

- `docker/.env`, `docker/build.sh`, and this spec and plan

## Implementation Performed

1. Confirmed the Dockerfile and workflow already use checked-out root sources.
2. Pruned unused tracked environment values.
3. Removed unused substitutions and build arguments from the wrapper.
4. Kept the existing image metadata and root context contract.

## Validation

- Ran wrapper syntax, workflow-equivalent metadata emission, and
  `git diff --check`.
- Skipped full tests, live builds/publishing, QA, and independent review under
  `super-agent`.

## Documentation And Delivery

- Added retrospective approved artifacts; no operator documentation changed.
- The accepted paths are committed and pushed to
  `origin/chore/native-checkout-docker-builds` as explicitly requested.
- No linked worktree or invoking-checkout artifact cleanup applies.

## Residual Risk

Only a live ARM64 Docker build and hosted Forgejo publication can validate the
complete runner, registry, and manifest path.

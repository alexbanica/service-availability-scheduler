# PLAN: GitHub Actions Docker Publish Naming Alignment

Status: Approved
Date: 2026-08-17

## Spec Reference

`specs/SPEC-github-actions-docker-publish-naming-alignment.md`

## Affected Files

- `.github/workflows/publish-docker-images.yml`
- `README.md`
- `specs/PLAN-github-actions-arm64-forgejo-release.md`
- `src/tests/unit/github-actions-release-workflow.test.ts`
- `src/tests/unit/github-actions-validation-workflow.test.ts`
- `specs/SPEC-github-actions-docker-publish-naming-alignment.md`
- `specs/PLAN-github-actions-docker-publish-naming-alignment.md`

## Implementation Steps Performed

1. Inventoried tracked Docker build-and-publish workflows across the workspace.
2. Confirmed `main` matched a freshly fetched `origin/main`.
3. Renamed the publication workflow to `publish-docker-images.yml`.
4. Added the common workflow/run names and explicit job/step display names.
5. Updated every checked-in reference to the common workflow filename.
6. Removed the existing GitHub Actions parser tests as required by repository
   policy rather than retaining a test tied to the former filename.
7. Preserved triggers, runners, actions, secrets, matrix data, and commands.
8. Isolated the remaining pre-existing staged change set.
9. Performed short static validation and reconciled the accepted paths.

## Validation Run

- YAML parse and cross-workflow naming/contract checks.
- `git diff --check`.

## Validation Skipped

Hosted Actions, Docker builds, registry pushes, and live image checks were
skipped because they exceed the short `super-agent` validation boundary.

## Test, QA, And Review Status

Test-first work is not applicable to workflow naming configuration. Unit tests
were not added or run. Independent QA and code review were skipped as required
by the requested `super-agent` workflow.

## Documentation, Staging, Commit, And Push Status

The README, existing path references, and matching completed-work artifacts were
updated. Only the accepted naming/documentation paths were included in the
delivery commit; the prior staged change set remains staged. The delivery was
committed on `main` and pushed to `origin/main`; exact remote verification is
recorded in the completion report.

## Residual Risk

Hosted rendering and execution remain unverified. External automation keyed to
an earlier workflow path or display name may require reconfiguration.

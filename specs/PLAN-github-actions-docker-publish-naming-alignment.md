# PLAN: GitHub Actions Docker Publish Naming Alignment

Status: Approved
Date: 2026-08-17

## Spec Reference

`specs/SPEC-github-actions-docker-publish-naming-alignment.md`

## Affected Files

- `.github/workflows/release.yml`
- `specs/SPEC-github-actions-docker-publish-naming-alignment.md`
- `specs/PLAN-github-actions-docker-publish-naming-alignment.md`

## Implementation Steps Performed

1. Inventoried tracked Docker build-and-publish workflows across the workspace.
2. Confirmed `main` matched a freshly fetched `origin/main`.
3. Added the common workflow/run names and explicit job/step display names.
4. Preserved triggers, runners, actions, secrets, matrix data, and commands.
5. Isolated the alignment from the overlapping pre-existing staged change set.
6. Performed short static validation and reconciled the accepted paths.

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

The matching completed-work artifacts were added; README changes were not
needed. Only the accepted naming/artifact paths were included in the delivery
commit; the prior staged change set remains staged. The delivery was committed
on `main` and pushed to `origin/main`; exact remote verification is recorded in
the completion report.

## Residual Risk

Hosted rendering and execution remain unverified. Any external branch rule or
dashboard keyed to an old workflow/job display name may require re-selection.

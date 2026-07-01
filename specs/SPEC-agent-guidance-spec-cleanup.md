# Agent Guidance And Specs Cleanup

Status: Approved

## Purpose

Fold durable implementation knowledge from historical specs into `AGENTS.md`
and keep the specs directory focused on active or intentionally retained
artifacts.

## Requested Behavior

Future agentic agents should be able to learn the repository's current
authentication, activation, authorization, browser-route, API-documentation,
configuration, migration, and validation expectations from `AGENTS.md` without
reading obsolete completed specs. The specs folder should then be cleaned up
while preserving `SPEC-workspace-owner-environment-deletion.md`.

## Scope

- Review top-level files under `specs/`.
- Update `AGENTS.md` with durable agent guidance extracted from completed specs.
- Preserve `specs/SPEC-workspace-owner-environment-deletion.md`.
- Remove obsolete completed spec and plan artifacts from `specs/`.
- Add completed-work artifacts for this `$super-agent` maintenance pass.

## Out Of Scope

- Runtime TypeScript behavior changes.
- API contract file changes.
- HTTP example changes.
- README changes.
- Build, lint, full test, manual QA, code review, commit, or push.

## Inputs And Constraints

- The user explicitly invoked `$super-agent`, so this is a direct lower-assurance
  documentation and repository cleanup pass.
- `SPEC-workspace-owner-environment-deletion.md` must not be removed.
- Existing unrelated worktree changes must be preserved where possible.
- Validation is limited to commands expected to complete within 10 seconds.

## Deterministic Behavior Delivered

- `AGENTS.md` documents password/JWT authentication, registration, captcha,
  account activation, activation-gated authorization, workspace role
  authorization, browser routes, frontend behavior, API contract documentation,
  runtime configuration, migrations, validation, and specs-folder expectations.
- The specs cleanup rule explicitly preserves
  `specs/SPEC-workspace-owner-environment-deletion.md`.
- Historical completed specs and plans are removed from `specs/`.
- This completed-work spec and its matching plan document the maintenance pass.

## Assumptions

- Historical completed specs are not required as active approval artifacts once
  their durable guidance has been moved into `AGENTS.md`.
- The active proposed owner/environment deletion spec remains useful for future
  implementation work and should stay in `specs/`.

## Impact

- Future agents have less stale material to scan before work.
- `AGENTS.md` becomes the primary compact source for current repository
  behavior and workflow expectations.
- Detailed historical planning context is intentionally no longer retained in
  the specs directory after cleanup.

## Validation Performed

- `git diff --check`.

## Validation Skipped

- `npm run lint`, `npm run build`, and `npm test` were skipped because this
  `$super-agent` documentation and cleanup pass only runs validation expected to
  finish within 10 seconds.
- Manual QA was skipped by `$super-agent` workflow.
- Code review was skipped by `$super-agent` workflow.

## Documentation Changes

- Updated `AGENTS.md`.
- Added this completed-work spec.
- Added `specs/PLAN-agent-guidance-spec-cleanup.md`.

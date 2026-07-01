# Agent Guidance And Specs Cleanup Plan

Status: Approved

Spec: `specs/SPEC-agent-guidance-spec-cleanup.md`

## Affected Files

- `AGENTS.md`
- `specs/SPEC-agent-guidance-spec-cleanup.md`
- `specs/PLAN-agent-guidance-spec-cleanup.md`
- Historical completed `specs/SPEC-*.md` and `specs/PLAN-*.md` artifacts

## Implementation Steps Performed

- Loaded the `$super-agent` workflow instructions.
- Read workspace instructions and inspected branch/worktree state.
- Listed and sampled the existing specs folder contents.
- Extracted durable agent guidance from completed authentication, activation,
  route, captcha, API documentation, UI, and workspace-role specs.
- Updated `AGENTS.md` with the durable repository behavior and cleanup policy.
- Preserved `specs/SPEC-workspace-owner-environment-deletion.md`.
- Removed obsolete completed spec and plan artifacts from `specs/`.
- Added this completed-work plan and its matching completed-work spec.

## Validation Run

- `git diff --check`.

## Validation Skipped

- `npm run lint`: skipped because it is expected to exceed the `$super-agent`
  10-second validation budget for this documentation-only cleanup.
- `npm run build`: skipped because no runtime TypeScript behavior changed and it
  is expected to exceed the validation budget.
- `npm test`: skipped because the full suite is expected to exceed the
  validation budget.
- Manual QA: skipped by `$super-agent` workflow.

## QA Skipped

Manual QA was skipped by `$super-agent` design.

## Code Review Skipped

Code review was skipped by `$super-agent` design.

## Documentation Updates

- Updated `AGENTS.md`.
- Added `specs/SPEC-agent-guidance-spec-cleanup.md`.
- Added this plan.

## Commit Status

Not committed; the user did not request a commit.

## Push Status

Not pushed; the user did not request a push.

## Residual Risk

- The cleanup is based on the sampled completed specs and current
  documentation. Runtime behavior was not revalidated.
- Detailed historical implementation plans were intentionally removed from the
  specs folder after their durable guidance was consolidated.

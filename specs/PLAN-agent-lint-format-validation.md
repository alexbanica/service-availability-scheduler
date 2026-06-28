Status: Approved

# Agent Lint And Format Validation Plan

Approved spec reference: `specs/SPEC-agent-lint-format-validation.md`

## Affected Files

- `AGENTS.md`
- `specs/SPEC-agent-lint-format-validation.md`
- `specs/PLAN-agent-lint-format-validation.md`

## Implementation Steps Performed

1. Loaded the repository instructions and workspace instructions.
2. Inspected the current branch and worktree state.
3. Confirmed `package.json` defines `npm run lint` and `npm run format`.
4. Replaced the prior lint/format avoidance instruction in `AGENTS.md`.
5. Added explicit workflow guidance that developer agents must run `npm run lint` and fix all lint issues before handoff.
6. Added explicit workflow guidance that the main agent must run `npm run format` before committing accepted changes.
7. Added lint and format requirements to the repository validation section.
8. Added auto-approved completed-work spec and plan artifacts for the delivered instruction change.
9. Ran short validation.

## Validation Run

- Targeted search for `lint`, `format`, `Validation`, and `npm run` references.
- `git diff --check`

## Validation Skipped

- `npm run lint` was skipped because this was a documentation-only instruction update and the current worktree has unrelated source/test changes that lint may rewrite.
- `npm run format` was skipped because no commit was requested and formatting could touch unrelated dirty files.
- `npm run build` was skipped because it is not relevant to this documentation-only instruction change and may exceed the super-agent 10-second command limit.
- `npm test` was skipped because it is not relevant to this documentation-only instruction change and may exceed the super-agent 10-second command limit.

## QA Skipped

- QA phase skipped by design in the super-agent workflow.

## Code Review Skipped

- Code-review phase skipped by design in the super-agent workflow.

## Documentation Updates

- Updated `AGENTS.md`.
- Added completed spec and plan artifacts under `specs/`.

## Commit Status

- Not committed. The user did not request a commit.

## Push Status

- Not pushed. The user did not request a push.

## Residual Risk

- The instruction change was not exercised by running a full implementation flow.
- Current unrelated source/test changes were not linted or formatted in order to avoid modifying user work.

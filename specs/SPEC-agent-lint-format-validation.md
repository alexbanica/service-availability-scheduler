Status: Approved

# Agent Lint And Format Validation

## Purpose

Make lint and formatting validation mandatory in repository agent instructions.

## Problem Statement

The repository instructions previously discouraged running `npm run lint` and `npm run format` unless formatting changes were intended. The requested behavior is to require lint and format as part of agent delivery, with lint findings fixed and formatting applied before commits.

## Scope

- Update repository agent instructions in `AGENTS.md`.
- Require developer agents to run `npm run lint` during implementation validation.
- Require all lint findings reported by `npm run lint` to be fixed before developer-agent handoff.
- Require the main agent to run `npm run format` before committing accepted changes.
- Create completed-work spec and plan artifacts for this lower-assurance `$super-agent` change.

## Out Of Scope

- Changing `package.json` scripts.
- Running full lint or format over the current dirty worktree.
- Fixing pre-existing lint or format issues in unrelated modified files.
- Committing or pushing changes.
- Changing generated `public/js` bundles.

## Definitions

- Developer agent: an implementation-focused agent or subagent performing code changes.
- Main agent: the coordinating agent responsible for final validation, formatting before commit, and delivery reporting.

## Inputs And Constraints

- The user invoked `$super-agent`, so this change was implemented directly without approval gates.
- The worktree already contained unrelated modified source and test files, so edits were limited to `AGENTS.md` and new spec/plan artifacts.
- The super-agent workflow allows only short validation and skips QA and code review by design.

## Deterministic Behavior Delivered

- `AGENTS.md` no longer instructs agents to avoid `npm run lint` and `npm run format`.
- `AGENTS.md` requires developer agents to run `npm run lint` during implementation validation.
- `AGENTS.md` requires developer agents to fix every lint issue reported by `npm run lint` before handing work back.
- `AGENTS.md` requires the main agent to run `npm run format` before committing accepted changes.
- `AGENTS.md` lists lint and format in the repository validation guidance.

## Assumptions

- "Developer agent" refers to implementation-focused agents that perform code changes.
- "Main agent" refers to the coordinating agent that performs final delivery steps and commits when commits are requested or allowed.
- The requested instruction change applies to future work; it does not require formatting or lint-fixing unrelated current dirty files.

## Impact And Regression Considerations

- Future implementation flows will include lint and format even though those commands can rewrite files.
- Because `npm run lint` uses `eslint --fix`, developer agents must inspect resulting changes and fix any remaining issues before handoff.
- Running `npm run format` before commits can touch many files when unrelated formatting drift exists, so agents must preserve unrelated user work and include only accepted changes in commits.

## Validation Performed

- Ran targeted instruction search for `lint`, `format`, `Validation`, and `npm run`.
- Ran `git diff --check`.

## Validation Skipped

- `npm run lint` was skipped because the current request changes future agent instructions and the worktree already contains unrelated modified source and test files.
- `npm run format` was skipped because this invocation is not committing accepted changes and formatting the dirty worktree would risk touching unrelated user changes.
- `npm run build` and `npm test` were skipped because they are not needed for a documentation-only agent-instruction change and may exceed the `$super-agent` short-validation boundary.

## Documentation Changes

- Updated `AGENTS.md`.
- Added this completed behavior spec.

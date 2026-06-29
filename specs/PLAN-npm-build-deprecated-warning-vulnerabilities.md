# Npm Build Deprecated Warning And Vulnerability Cleanup Plan

Status: Approved

## Approved Spec Reference

- `specs/SPEC-npm-build-deprecated-warning-vulnerabilities.md`

## Affected Files

- `package.json`
- `package-lock.json`
- `eslint.config.js`
- `specs/SPEC-npm-build-deprecated-warning-vulnerabilities.md`
- `specs/PLAN-npm-build-deprecated-warning-vulnerabilities.md`

## Implementation Steps Performed

1. Inspected repository instructions, workspace instructions, branch state, and
   current worktree changes.
2. Ran npm audit against the current lockfile to identify vulnerable packages.
3. Updated `express` and `js-yaml` within their current major versions.
4. Updated ESLint from major version 8 to major version 9 to remove deprecated
   ESLint 8-era transitive packages.
5. Pinned `@typescript-eslint/eslint-plugin` and
   `@typescript-eslint/parser` to `8.46.4` after verifying newer releases pulled
   a Node 20-only transitive dependency.
6. Regenerated `package-lock.json`.
7. Added `eslint.config.js` so ESLint 9 preserves the repository's TypeScript
   parser, plugin, and simple style rules.
8. Ran short validation checks allowed by the `$super-agent` workflow.

## Validation Run

- `npm install`
- `npm audit --package-lock-only`
- `npx eslint 'src/**/*.{js,ts}'`
- `npx tsc -p tsconfig.json --noEmit`
- `npx tsc -p tsconfig.client.json --noEmit`
- `rg -n '"deprecated"' package-lock.json`
- `git diff --check`

## Validation Skipped

- Full unbounded `npm run build`; bounded execution hit the 10-second
  `$super-agent` limit during dependency reinstall.
- Full `npm test`; skipped under the short-validation rule.

## QA Skipped

- QA was skipped by design for `$super-agent`.

## Code Review Skipped

- Code review was skipped by design for `$super-agent`.

## Documentation Updates

- Added the completed-work spec and plan artifacts under `specs/`.

## Commit Status

- Not committed; the user did not request a commit.

## Push Status

- Not pushed; the user did not request a push.

## Residual Risk

- The full build command was not completed in this workflow, so the exact
  end-to-end `npm run build` timing and output remain unverified beyond the
  dependency install/audit/lint/TypeScript checks.
- Because QA and code review were skipped by design, the default repository
  Definition of Done is not fully satisfied.

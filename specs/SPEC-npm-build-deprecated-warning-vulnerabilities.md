# Npm Build Deprecated Warning And Vulnerability Cleanup

Status: Approved

## Purpose

Remove npm install/build dependency deprecation noise and npm audit
vulnerabilities without changing the Node.js runtime version.

## Problem Statement

`npm run build` runs `npm install` as part of the build path. The dependency
tree included deprecated ESLint 8-era packages and npm audit reported
vulnerabilities in runtime and development transitive dependencies.

## Scope

- Update dependency ranges and `package-lock.json` so npm audit reports zero
  known vulnerabilities for the current lockfile.
- Move from deprecated ESLint 8 packages to ESLint 9 while preserving the
  existing TypeScript lint behavior.
- Preserve the current Node.js line. Validation was performed on Node
  `v18.19.1`.
- Keep dependency changes limited to package metadata and lint configuration.

## Out Of Scope

- Upgrading Node.js.
- Changing application runtime behavior.
- Refactoring source code.
- Removing the build script's existing `npm install` step.

## Inputs And Constraints

- The requested change explicitly forbids a Node.js version upgrade.
- The repository uses CommonJS package semantics.
- The lower-assurance `$super-agent` workflow skips code review and QA by
  design and only allows short validation.

## Deterministic Behavior Delivered

- `npm audit --package-lock-only` reports zero vulnerabilities.
- `package-lock.json` no longer contains npm package `deprecated` metadata.
- Runtime dependencies were updated within the existing major lines:
  - `express` remains on major version 4.
  - `js-yaml` remains on major version 4.
- ESLint moved to major version 9 with a flat `eslint.config.js` equivalent to
  the existing TypeScript lint setup.
- `@typescript-eslint` packages are pinned to `8.46.4` to avoid pulling a newer
  transitive package that requires Node 20.

## Assumptions

- Node `v18.19.1` is the Node version that must remain supported for this
  repository.
- A direct `path-to-regexp` dependency is not required because the app does not
  import it directly; the safe version is retained through the lockfile as
  Express' transitive dependency.

## Impact And Regression Considerations

- Application behavior is not intended to change.
- Lint behavior now depends on `eslint.config.js`, because ESLint 9 uses flat
  config discovery by default.
- Future `@typescript-eslint` upgrades must preserve Node 18 compatibility
  unless the project intentionally changes its Node support.

## Validation Performed

- `npm install`
- `npm audit --package-lock-only`
- `npx eslint 'src/**/*.{js,ts}'`
- `npx tsc -p tsconfig.json --noEmit`
- `npx tsc -p tsconfig.client.json --noEmit`
- `rg -n '"deprecated"' package-lock.json`
- `git diff --check`

## Validation Skipped

- Full unbounded `npm run build`; a bounded `timeout 10s npm run build` attempt
  did not complete because the script runs `npm run clean`, removes
  `node_modules`, and then reinstalls dependencies.
- Full `npm test`; expected to exceed the short-validation limit for this
  lower-assurance command.

## Documentation Changes

- Created this completed-work spec artifact.

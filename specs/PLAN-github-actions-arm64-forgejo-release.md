# GitHub Actions CI And Private ARM64 Forgejo Release Implementation Plan

Status: Approved

Approved spec:
`specs/SPEC-github-actions-arm64-forgejo-release.md`

## Objective

Implement the approved repository-scoped GitHub Actions contract without
changing application behavior. Delivery adds default-branch validation, a
script-emitted release matrix, one immutable `linux/arm64` build and push per
script-managed image through `docker/build-push-action`, deterministic contract
tests, local Docker-build compatibility, documentation, independent review,
main-agent QA, commit, and push.

## Final Approved Decisions

- The default branch is `main`.
- The current image inventory contains exactly
  `service-availability-scheduler`.
- CI publishes only
  `forgejo.alexlab.nl/alexlab/service-availability-scheduler:<tag>-node24-alpine`.
- CI accepts only lowercase Docker-safe release tags and never publishes
  `latest-node24-alpine`.
- Local `docker/build.sh --release <tag>` retains the checked-in local registry
  default and version plus moving-tag behavior.
- `docker/build.sh --emit-github-matrix` validates CI inputs and emits the
  complete image matrix without invoking Docker.
- The release preparation job has no Forgejo secrets. The dependent publication
  job uses only `FORGEJO_REGISTRY_USERNAME` and `FORGEJO_REGISTRY_TOKEN`.
- `docker/build-push-action` is the only CI release build and push executor. The
  workflow does not also run normal script build mode.
- The Forgejo owner must be private, the token must be private-resource capable
  with `write:package`, and anonymous pulls must be denied.
- CI uses GitHub-hosted Linux, QEMU/binfmt, Buildx, and `type=gha` cache for
  `linux/arm64`.
- `npm test` runs without a destructive CI database; existing database
  integration tests remain skipped.

If any registry, privacy, credential, runner, tag, or database assumption is
false, implementation stops for an approved artifact amendment.

## Implementation Constraints And No-Research Boundary

- Implementation starts only in a fresh session, after context is cleared, or
  after explicit same-context confirmation.
- Implementation may ingest only applicable instructions, the approved
  artifacts, branch/worktree state, files listed here, pinned inputs below, and
  minimal local edit patterns.
- Workers perform no product, architecture, scope, planning, cross-project, or
  live Forgejo research.
- No worker may manage branches/worktrees, stage, commit, push, query live
  Forgejo state, create credentials, change repository settings, push a tag,
  publish an image, or deploy.
- The main agent performs only validation named in this plan. A live tag or
  Forgejo push requires separate user authorization.
- Preserve unrelated changes. Never commit `.env`, credentials, Docker auth,
  database dumps, `node_modules`, `dist`, generated `public/js`, caches, or OCI
  validation archives.
- Test-first applies to workflow triggers/security, image-matrix generation,
  tag mapping, build-script behavior, Dockerfile inputs, and secret exclusion.
  README prose is validated against approved behavior and final files.
- No architect agent is planned because boundaries are fixed and low-coupling;
  independent security and regression reviews remain mandatory.

## Pinned External Inputs

Use these exact immutable action references with human-readable version
comments:

- `actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1`
  (`v7.0.1`);
- `actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38`
  (`v6`);
- `docker/setup-qemu-action@96fe6ef7f33517b61c61be40b68a1882f3264fb8`
  (`v4`);
- `docker/setup-buildx-action@bb05f3f5519dd87d3ba754cc423b652a5edd6d2c`
  (`v4`);
- `docker/login-action@dbcb813823bdd20940b903addbd779551569679f`
  (`v4`); and
- `docker/build-push-action@53b7df96c91f9c12dcc8a07bcb9ccacbed38856a`
  (`v7`).

Builder and runtime use exactly:

`node:24-alpine@sha256:a0b9bf06e4e6193cf7a0f58816cc935ff8c2a908f81e6f1a95432d679c54fbfd`

Substituting an action commit, Node/Alpine version, or manifest digest requires
plan amendment or explicit user approval.

## Expected Files

### Approved Artifacts

- `specs/SPEC-github-actions-arm64-forgejo-release.md`
- `specs/PLAN-github-actions-arm64-forgejo-release.md`

### Production

- `.github/workflows/ci.yml` (new)
- `.github/workflows/release.yml` (new)
- `docker/build.sh`
- `docker/Dockerfile`
- `.dockerignore` (new)

`docker/.env`, `package.json`, and `package-lock.json` remain unchanged.
`docker/secrets/.github_auth` remains ignored and is never read by CI.

### Tests

- `src/tests/unit/github-actions-validation-workflow.test.ts` (new)
- `src/tests/unit/github-actions-release-workflow.test.ts` (new)
- `src/tests/unit/docker-build-script-contract.test.ts` (new)
- `src/tests/unit/dockerfile-arm64-contract.test.ts` (new)

### Documentation

- `README.md`

No `swagger.yml` or `http/*.http` edit is required because no API contract,
request example, response, authorization behavior, or application event changes.

## Intended Component Boundaries

- `.github/workflows/ci.yml` owns only pull-request and `main` push validation.
  It receives no Forgejo secret and performs no Docker publication.
- `.github/workflows/release.yml` owns tag-only preparation and publication.
  Preparation invokes script metadata mode without secrets; publication consumes
  the emitted matrix and performs the single cached build/push per row.
- `docker/build.sh` owns image inventory, image name/suffix assembly, Dockerfile,
  context, platform, application-version, and cache-scope metadata. Normal local
  mode builds; metadata mode emits one validated `matrix=<json>` output and never
  invokes Docker.
- `docker/Dockerfile` consumes checked-out root context, uses pinned Node
  manifests and locked dependency installation, directly compiles server and
  browser TypeScript, and copies only runtime inputs.
- `.dockerignore` excludes Git metadata, local/generated dependencies and
  outputs, Docker secrets, environment files, caches, and planning artifacts.
- Contract tests parse workflow YAML, execute the script with fake Docker and a
  temporary `GITHUB_OUTPUT`, and inspect Dockerfile/ignore inputs offline.
- `README.md` documents operator-visible automation and configuration without
  credential values.

## Dependency-Aware Work Graph

Maximum planned concurrency is three active test-writer agents, one active
developer agent, and two active code-review agents. The four test units run in
two waves when only three subagent slots are available. Developer units are
serialized because every developer must run repository-wide auto-fixing lint.
Every assignment is limited to five minutes of active subagent work.

### Test-First Units

#### T1 - Default-Branch Validation Workflow Contract

- Type: test-focused.
- Boundary: PR base/types, `main` push, read-only permission, pinned
  checkout/setup-node, Node 24 cache, `npm ci`, exact lint/test commands, and a
  baseline-aware check that fails only when lint changes tracked files.
- Owned file:
  `src/tests/unit/github-actions-validation-workflow.test.ts`.
- Dependencies: approved spec and plan.
- Acceptance: offline YAML tests reject secret/publish capability,
  `pull_request_target`, wrong triggers/actions, or a post-lint check that cannot
  distinguish pre-existing install diffs from lint mutations.
- Validation: run the file alone and record expected pre-production failures.
- Assignment: one clean-context `test-writer`, maximum five minutes.

#### T2 - Tag Release Matrix Workflow Contract

- Type: test-focused.
- Boundary: tag-only trigger; preparation/publication dependency; no preparation
  secrets or Docker execution; exact script metadata invocation; matrix solely
  from preparation output; exact Forgejo image constraints; pinned
  checkout/QEMU/Buildx/login/build-push actions; read-only permission; exact two
  secrets in publication; ARM64-only matrix; `type=gha` scoped cache; one real
  build-push action per row; digest summary; unconditional credential cleanup;
  no insecure TLS, normal script build, `latest`, branch, or dispatch publish.
- Owned file: `src/tests/unit/github-actions-release-workflow.test.ts`.
- Dependencies: approved spec and plan.
- Acceptance: deterministic YAML parsing checks job/step semantics and data
  flow, not raw source ordering or decorative action references.
- Validation: run the file alone and record expected pre-production failures.
- Assignment: one clean-context `test-writer`, maximum five minutes.

#### T3 - Local Build And GitHub Matrix Script Contract

- Type: test-focused.
- Boundary: strict option/value handling; local `.env` registry fallback; local
  two-tag/load behavior; explicit registry/platform/context/no-latest/push;
  exact APP_VERSION; root context; no GitHub auth; and metadata mode.
- Owned file: `src/tests/unit/docker-build-script-contract.test.ts`.
- Dependencies: approved spec and plan.
- Acceptance: a temporary fake Docker executable proves normal modes; a
  temporary existing writable `GITHUB_OUTPUT` proves valid metadata mode writes
  exactly one parseable `matrix=` object with the full current inventory and
  invokes Docker zero times. Invalid tag syntax/length, registry, platform,
  missing output, newline, unknown option, or incompatible mode combination
  fails without Docker or partial output.
- Validation: run the file alone and record expected pre-production failures.
- Assignment: one clean-context `test-writer`, maximum five minutes.

#### T4 - Dockerfile ARM64 And Secret-Safety Contract

- Type: test-focused.
- Boundary: exact pinned Node manifest, checked-out root context, full locked
  build dependencies, separate production dependencies, direct server/client
  compilation, builder-to-runtime copies, APP_VERSION, and ignore exclusions.
- Owned file: `src/tests/unit/dockerfile-arm64-contract.test.ts`.
- Dependencies: approved spec and plan.
- Acceptance: offline tests reject mutable bases, downloader/archive/network
  source retrieval, secret reads, unrestricted install, unsafe context, `ADD`
  workarounds, or missing runtime inputs.
- Validation: run the file alone and record expected pre-production failures.
- Assignment: one clean-context `test-writer`, maximum five minutes.

### Development Units

#### D1 - Default-Branch CI Workflow

- Type: implementation.
- Boundary: add only unprivileged validation workflow.
- Owned file: `.github/workflows/ci.yml`.
- Dependencies: T1.
- Acceptance: T1 passes; workflow handles approved PR/main events, uses exact
  commands, and compares tracked diff state immediately before and after lint so
  install-time changes cannot be misattributed to lint.
- Validation: T1, YAML parse, mandatory `npm run lint`.
- Assignment: one clean-context `developer`, maximum five minutes.

#### D2 - Strict Local Build And Metadata Matrix Script

- Type: implementation.
- Boundary: implement strict normal-build options and non-building
  `--emit-github-matrix` from one shared image inventory.
- Owned file: `docker/build.sh`.
- Dependencies: T3.
- Acceptance: T3 passes; local interface/default/tags remain; CI metadata mode
  validates exact Forgejo/ARM64/immutable-tag inputs, writes safe JSON to
  `GITHUB_OUTPUT`, and invokes Docker zero times; normal mode never requires the
  ignored GitHub auth file.
- Validation: T3, `bash -n docker/build.sh`, mandatory `npm run lint`.
- Assignment: one clean-context `developer`, maximum five minutes.

#### D3 - Deterministic Local-Source Dockerfile

- Type: implementation.
- Boundary: pinned root-context multi-stage build and root `.dockerignore`.
- Owned files: `docker/Dockerfile`, `.dockerignore`.
- Dependencies: T4.
- Acceptance: T4 passes; builder uses locked dev dependencies and local
  TypeScript compiler; runtime receives production dependencies and required
  outputs only; no downloader or secret remains.
- Validation: T4, static Dockerfile inspection, mandatory `npm run lint`.
- Assignment: one clean-context `developer`, maximum five minutes.

#### D4 - Private ARM64 Tag Release Workflow

- Type: implementation.
- Boundary: add tag preparation and matrix publication only.
- Owned file: `.github/workflows/release.yml`.
- Dependencies: T2, D2, D3.
- Acceptance: T2 passes; preparation checks out the tag target and invokes only
  metadata mode before secrets; publication depends on preparation, checks out
  the same target, authenticates with the exact secrets, consumes only emitted
  matrix fields, and uses one pinned `docker/build-push-action` per row with
  `push: true`, ARM64, immutable tag, APP_VERSION, scoped `type=gha` restore and
  `mode=max` export. Digest is reported and logout runs on completion/failure.
- Validation: T2, T3/T4 integration assertions, YAML parse, mandatory
  `npm run lint`.
- Assignment: one clean-context `developer`, maximum five minutes.

#### D5 - Operator Documentation

- Type: documentation implementation.
- Boundary: document validation/release triggers, test skips, secrets/least
  privilege, tag constraints, metadata-to-build handoff, private-owner
  prerequisite, ARM64 image path, cache behavior, digest, CI immutable tag, and
  local moving-tag compatibility.
- Owned file: `README.md`.
- Dependencies: D1-D4.
- Acceptance: prose matches approved behavior and final files, contains no
  secret value, and marks live Forgejo privacy/push validation as operator-owned.
- Validation: artifact-to-README comparison and mandatory `npm run lint`.
- Assignment: one clean-context `developer`, maximum five minutes.

### Main-Agent Integration

- Start D1 after T1, D2 after T3, D3 after T4, D4 after T2/D2/D3, and D5 after
  D1-D4.
- Serialize all developer units and repository-wide lint runs.
- Inspect each handoff immediately; classify every lint mutation and route any
  cross-owned correction to a clean bounded worker.
- Reconcile image name, suffix, APP_VERSION, context, Dockerfile, platform,
  cache scope, and moving-tag suppression across D2-D4.
- Ensure workflow tests parse YAML and validate job dependency/data flow.
- At five minutes, stop the agent, record completed/partial files, validation,
  blocker, and remainder; preserve usable edits and split the remainder before
  assigning a fresh agent.

### Independent Review Units

#### R1 - Workflow Security And Matrix Data-Flow Review

- Type: code review; no implementation.
- Boundary: workflows and T1/T2.
- Dependencies: D1-D4 and focused workflow tests passing.
- Review: event isolation, untrusted PRs, read-only permission, action pins,
  preparation-before-secret access, matrix provenance, tag injection, exact
  secret set, registry exclusivity, single build/push path, no decorative action,
  ARM64/cache scope, digest, logout, and failure behavior.
- Acceptance: report every mismatch/risk/missing test or explicitly none.
- Assignment: one clean-context `code-reviewer`, maximum five minutes.

#### R2 - Docker Determinism And Local Regression Review

- Type: code review; no implementation.
- Boundary: build script, Dockerfile, `.dockerignore`, README, T3/T4.
- Dependencies: D2-D5 and focused Docker tests passing.
- Review: shared inventory, safe JSON/output handling, no command/output
  injection, zero Docker calls in metadata mode, exact source/base/lockfile,
  production dependencies, local registry/tags, strict arguments, secret/cache
  exclusions, context, and documentation accuracy.
- Acceptance: report every mismatch/risk/missing test or explicitly none.
- Assignment: one clean-context `code-reviewer`, maximum five minutes.

Review findings are triaged by the main agent. Valid fixes go to new
clean-context `developer` agents with exact owned files and focused validation;
reviewers never implement. Developers remain serialized because lint is shared.

## Main-Agent QA And Validation

Use `npm_config_cache=/tmp/service-availability-scheduler-npm-cache` when npm
needs a writable cache.

1. Run each focused new test file directly with
   `node -r ts-node/register --test <file>`.
2. Run metadata-mode adversarial cases and parse its JSON matrix independently.
3. Run `npx tsc -p tsconfig.json --noEmit`.
4. Run `npx tsc -p tsconfig.client.json --noEmit`.
5. Run `npm run lint`; fix every issue and inspect all mutations.
6. Run `npm test`; record pass/fail/skip counts and database skips.
7. Run `npm run build`; verify `dist` and `public/js` remain untracked/unstaged.
8. Run `bash -n docker/build.sh` and fake-Docker normal/metadata tests.
9. Parse both workflows and verify all `uses:` references against the pinned
   SHA list.
10. Inspect the diff for forbidden registries/tags, `pull_request_target`, write
    GitHub permissions, insecure TLS, build-argument secrets, duplicate build
    execution, hard-coded release inventory, generated/auth files, or
    credentials.
11. If `npm ci` or an existing lifecycle script changes `package-lock.json`,
    compare the mutation, confirm it is validation-generated and out of scope,
    restore only that generated mutation, and ensure workflow lint-diff checks
    remain baseline-aware.
12. Before Docker commands, run `docker context show`; switch explicitly to
    `local` and reconfirm if needed.
13. If local Buildx/QEMU supports it, obtain inputs from script metadata mode and
    perform one non-publishing `linux/arm64` build with output only under `/tmp`.
    Inspect OCI platform and application version. Do not log in or push. If
    unavailable, record the blocker and keep delivery DRAFT.
14. Do not create/push a tag or perform live Forgejo publication without separate
    authorization. Missing live workflow, push, authenticated pull, and
    anonymous-denial evidence remains a DRAFT gap.
15. Run `npm run format` before staging; inspect and reject unrelated churn.
16. Re-run focused tests, lint, full tests, and build after formatting/fixes.
17. Run `git diff --check`.

Delivery is DRAFT if required review, tests, lint, build, local ARM64 validation,
or documentation is skipped/blocked/failing. Even with local checks passing, the
expected commit is DRAFT until a real tag workflow and anonymous pull denial are
validated with separate authorization.

## Implementation Branch And Worktrees

- Repository: `service-availability-scheduler`.
- Delivery branch: `feature/github-actions-arm64-forgejo-release`.
- Expected base: `origin/main` at
  `5c007415b37d70d71495ac7c61f81740dbdeed72`.
- Implementation uses an isolated clean worktree.
- New task slug: `github-actions-arm64-forgejo-release-resume`.
- Exact implementation path:
  `~/.herdr/worktrees/service-availability-scheduler/github-actions-arm64-forgejo-release-resume`.
- Existing halted path, preserved read-only:
  `~/.herdr/worktrees/service-availability-scheduler/github-actions-arm64-forgejo-release`.

At implementation start, the main agent must:

1. Inspect invoking checkout status, all registered worktrees, expected base,
   and local/remote delivery-branch availability.
2. Fetch `origin/main` and stop for plan amendment if it is not the exact
   expected commit.
3. Preserve the invoking checkout's approved artifact copies and every unrelated
   change.
4. Treat the existing halted worktree as read-only, dirty partial task state.
   Do not enter it for task edits, copy production files from it, clean it,
   remove it, or treat it as the implementation location. Report it at handoff.
5. Create the repository-specific parent when absent, verify repository/task
   names, and create or reuse the new exact resume path detached at the expected
   base. A reused resume worktree must be registered to this repository,
   detached at the exact base, and clean.
6. Materialize byte-identical approved SPEC/PLAN copies from the invoking
   checkout into the clean resume worktree.
7. Keep the resume worktree detached until development reaches DRAFT delivery
   or Definition of Done. Workers never manage branches/worktrees.

## Git, Commit, Push, And Reconciliation

- After development/review/QA reaches DRAFT or Definition of Done, re-check the
  exact delivery branch is absent locally/remotely and create it from the
  detached resume worktree.
- Reconcile every modified, added, deleted, renamed, and untracked path in the
  resume worktree. Include all accepted files, tests, docs, spec, and plan;
  preserve unrelated changes.
- Stage accepted paths explicitly. Inspect
  `git diff --cached --name-status` and the complete staged diff.
- Confirm no credential, `.env`, auth file, dump, dependency directory,
  generated output, cache, OCI archive, old-worktree file, or unrelated hunk is
  staged.
- Use subject `feature: add GitHub Actions ARM64 Forgejo release` only if every
  required validation and live acceptance passes. Otherwise use
  `feature: DRAFT add GitHub Actions ARM64 Forgejo release`.
- Push the exact branch to `origin`, set upstream, and verify it is not ahead.
- Inspect resume-worktree status after commit and push. No accepted in-scope
  change may remain outside the commit.
- Reinspect the invoking checkout and compare its approved artifacts byte for
  byte with the pushed branch. Preserve its untracked copies and identify them.
- Reinspect and report the existing halted dirty worktree without modifying or
  deleting it.
- Do not commit to `main`, merge, create a pull request, create/push a tag,
  publish an image, deploy, or delete the halted worktree.

## Completion Report Requirements

Report delivered validation/release behavior; review and QA findings/resolutions;
exact validation run/not run; pass/fail/skip and database skips; Docker context
and ARM64 evidence/blocker; live Forgejo evidence/DRAFT gaps; documentation and
why API artifacts are unaffected; every remaining path in the resume worktree,
invoking checkout, and halted worktree; commit hash/subject/branch/upstream/push;
final or draft; skipped/blocked work; Definition of Done; and final main-agent
acceptance.

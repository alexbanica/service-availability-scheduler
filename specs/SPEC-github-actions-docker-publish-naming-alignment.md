# SPEC: GitHub Actions Docker Publish Naming Alignment

Status: Approved
Date: 2026-08-17

## Purpose

Make Docker image publication runs use the same clear names as the other
Docker-publishing repositories in the workspace and GitHub's documented Docker
workflow terminology.

## Requested Behavior

- Display the workflow as `Publish Docker images`.
- Display tag-triggered runs as `Publish Docker images for <tag>`.
- Give preparation, publishing, and action steps explicit, sentence-case
  display names.
- Use `Checkout repository`, `Log in to Forgejo container registry`, and
  `Build and push Docker image` for shared operations.
- Retain a matrix image qualifier in the publishing job name.

## Scope

- `.github/workflows/release.yml`
- The matching completed-work spec and plan.

## Out Of Scope

- Workflow filenames, triggers, permissions, runners, action versions, secrets,
  registry coordinates, image tags, build commands, and push behavior.
- CI-only and non-Docker package workflows.

## Definitions

- **Workflow name**: the label shown in the repository Actions navigation.
- **Run name**: the label shown for one workflow execution.
- **Job and step names**: labels used to group and identify workflow logs.

## Inputs And Constraints

- The invoking checkout is `main`, synchronized with `origin/main` after a
  current fetch.
- Preserve the complete pre-existing staged change set, including its overlapping
  release-workflow edits, without including it in this delivery commit.
- The user explicitly authorized committing and pushing this change to `main`.

## Deterministic Behavior Delivered

The workflow, run, jobs, and steps use the common labels while the current
native ARM64 matrix publication content and all executable YAML values remain
unchanged by this alignment.

## Assumptions And Impact

The affected-project inventory is the set of tracked GitHub workflows that both
build and publish Docker images. The visible workflow and check labels change;
operators and branch rules that match old display names may need to select the
new names. Image publication behavior is unchanged.

## Validation Performed

- Parsed the workflow as YAML.
- Checked the shared names and preserved workflow contract structurally.
- Ran `git diff --check`.

## Validation Skipped

Hosted GitHub Actions execution and live image builds/pushes were not run.
Independent QA and code review were skipped by the requested `super-agent`
workflow.

## Documentation Changes

This completed-work spec and its plan were added. README changes were not needed
because operational behavior and workflow filenames did not change.

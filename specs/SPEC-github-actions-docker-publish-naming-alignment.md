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
- Store the workflow as `.github/workflows/publish-docker-images.yml`.
- Give preparation, publishing, and action steps explicit, sentence-case
  display names.
- Use `Checkout repository`, `Log in to Forgejo container registry`, and
  `Build and push Docker image` for shared operations.
- Retain a matrix image qualifier in the publishing job name.

## Scope

- `.github/workflows/publish-docker-images.yml`
- Checked-in references to the workflow path.
- Existing unit tests whose sole purpose was parsing GitHub Actions workflows.
- The matching completed-work spec and plan.

## Out Of Scope

- Triggers, permissions, runners, action versions, secrets,
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
unchanged by this alignment. The workflow file and every checked-in reference
use the common filename. Existing workflow-parser tests are removed in
accordance with repository policy instead of being updated for the renamed path.

## Assumptions And Impact

The affected-project inventory is the set of tracked GitHub workflows that both
build and publish Docker images. The visible workflow, check labels, and file
path change; external automation or branch rules that match earlier names or
paths may need to select the new values. Image publication behavior is unchanged.

## Validation Performed

- Parsed the workflow as YAML.
- Checked the shared names and preserved workflow contract structurally.
- Ran `git diff --check`.

## Validation Skipped

Hosted GitHub Actions execution and live image builds/pushes were not run.
Independent QA and code review were skipped by the requested `super-agent`
workflow.

## Documentation Changes

The README, existing workflow-path references, and matching completed-work
artifacts were updated to the common filename.

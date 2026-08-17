# Linked Worktree Cleanup Specification

Status: Approved

## Purpose

Remove every linked Git worktree registered for this repository without losing
unique uncommitted work or disturbing the primary invoking checkout.

## Requested Behavior

- Remove all linked worktrees registered by this repository.
- Keep the primary checkout at
  `/home/alexbanica/workspace/service-availability-scheduler` registered and
  unchanged.
- Preserve unique dirty linked-worktree content in a recoverable Git stash
  before removal.
- Preserve all local and remote branches.

## Scope

- Remove the linked worktree at
  `/home/alexbanica/.herdr/worktrees/service-availability-scheduler/github-actions-arm64-forgejo-release`.
- Remove the linked worktree at
  `/home/alexbanica/.herdr/worktrees/service-availability-scheduler/github-actions-arm64-forgejo-release-resume`.
- Prune stale worktree registration metadata.
- Verify the final registered-worktree and stash state.

## Out Of Scope

- Removing the primary checkout.
- Removing local or remote branches.
- Dropping the cleanup recovery stash.
- Changing or delivering the existing ARM64 Forgejo release work.
- Cleaning linked worktrees belonging to other repositories.

## Definitions

- **Primary checkout:** The invoking checkout that Git reports first and that is
  not removable with `git worktree remove`.
- **Linked worktree:** Any additional checkout registered by `git worktree` for
  this repository.

## Inputs And Constraints

- The invoking checkout contained pre-existing staged changes that had to remain
  untouched.
- A linked worktree could be removed only after its tracked and untracked unique
  content was preserved.
- Ignored build outputs and dependency directories were disposable and were not
  included in the recovery stash.

## Deterministic Behavior Delivered

The dirty detached worktree was saved with `--include-untracked` as stash commit
`624b53ca3c1350bbc03800a0fb207dccff2a29a6`. Both linked worktrees were then
removed normally, without force, and worktree metadata was pruned. The final
worktree list contains only the primary checkout. The feature branch and its
remote-tracking branch remain unchanged.

## Assumptions

"All worktrees" means all linked worktrees registered for this repository. It
does not mean deleting the primary checkout or worktrees owned by other
repositories.

## Impact

The two linked checkout directories and their ignored generated content are no
longer present. Unique source changes from the dirty worktree remain recoverable
from the named stash. Existing staged changes in the primary checkout remain in
place.

## Validation Performed

- Inspected the primary and linked worktree status before cleanup.
- Checked branch containment for both linked worktree commits.
- Compared the dirty linked-worktree files with the current feature and main
  branch versions and confirmed that its content was unique.
- Verified the recovery stash commit after creation.
- Verified that `git worktree list --porcelain` reports only the primary
  checkout after removal and pruning.
- Verified that the repository-specific linked-worktree directory is empty.

## Validation Skipped

Application build, lint, tests, and runtime validation were not run because the
change only removes Git checkout directories and records the operation. The
`super-agent` command also limits validation to checks expected to finish within
10 seconds.

## Documentation Changes

This completed-work specification and its matching plan are the only project
documentation changes created by the cleanup.

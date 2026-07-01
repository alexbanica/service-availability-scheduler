# Workspace Pending Invitation Removal Plan

Status: Approved

Spec: `specs/SPEC-workspace-pending-invitation-removal.md`

## Affected Files

- `src/repositories/WorkspaceInvitationRepository.ts`
- `src/services/WorkspaceService.ts`
- `src/controllers/WorkspaceController.ts`
- `public/ts/services/WorkspaceService.ts`
- `public/ts/controllers/AppController.ts`
- `public/index.html`
- `src/tests/unit/workspace-service.test.ts`
- `swagger.yml`
- `http/api.http`
- `specs/SPEC-workspace-pending-invitation-removal.md`
- `specs/PLAN-workspace-pending-invitation-removal.md`

## Implementation Steps Performed

1. Loaded the `$super-agent` workflow, workspace instructions, branch state, and
   relevant invitation/user-management code.
2. Confirmed pending invitations were already listed in workspace users and that
   repository-level revocation existed only by invitation id.
3. Added a workspace-scoped invitation revocation repository method.
4. Added `WorkspaceService.removePendingInvitation` with admin-or-manager
   authorization.
5. Added a DELETE workspace invitation endpoint.
6. Added a browser API client method for pending invitation removal.
7. Extended the existing destructive confirmation flow to support pending
   invitation removal.
8. Exposed user management to resource administrators while keeping accepted
   user role/removal controls admin-only.
9. Added pending invitation remove controls for authorized rows.
10. Added focused unit tests for admin, manager, member, and wrong-workspace
    behavior.
11. Updated API documentation and HTTP examples.
12. Created completed-work spec and plan artifacts.

## Validation Run

- Focused workspace service unit tests for pending invitation removal.
- `git diff --check`

## Validation Skipped

- Full build, lint, and full test validation were skipped under `$super-agent`
  constraints because they are not expected to complete within 10 seconds.

## QA Skipped

- Manual browser QA was skipped by design for `$super-agent`.

## Code Review Skipped

- Code review was skipped by design for `$super-agent`.

## Documentation Updates

- Updated `swagger.yml`.
- Updated `http/api.http`.
- Added completed-work artifacts under `specs/`.

## Commit Status

- Not committed.

## Push Status

- Not pushed.

## Residual Risk

- Generated browser JavaScript bundles were not updated in this run.
- Full TypeScript/build/lint/test validation remains unrun.
- The user-management browser flow was not manually verified.

# Workspace Roles And User Administration Implementation Plan

Status: Approved

Approved spec: `specs/SPEC-workspace-roles-and-user-administration.md`

## Target Branch

Use branch `feature/workspace-roles-user-administration`.

If implementation starts from a non-`main` branch, stop and ask before creating
the feature branch from the current branch.

## Source Of Truth

Implementation must use only:

- `specs/SPEC-workspace-roles-and-user-administration.md`
- this implementation plan
- `AGENTS.md`
- `/home/alexbanica/workspace.md`
- the files named or directly implied below
- minimal local edit patterns needed to apply the approved plan

Do not perform product, architecture, scope, or planning research during
implementation.

## Architecture And Ownership

- Keep workspace role and capability behavior in services and repositories.
- Keep Express request parsing and HTTP status mapping in controllers.
- Keep browser role-aware rendering in `public/ts` controllers, services, and
  entities.
- Keep schema bootstrap files and post-release migrations deterministic and
  table-scoped.
- Do not reintroduce YAML-backed service catalogs.
- Do not commit generated `public/js` output or `node_modules`.

## Affected Files

Expected production files:

- `AGENTS.md`
- `config/schema/workspace_users.sql`
- `config/migrations/0005_workspace-users-add-manager-role_workspace_users.sql`
- `src/entities/Workspace.ts`
- `src/repositories/WorkspaceRepository.ts`
- `src/repositories/WorkspaceUserRepository.ts`
- `src/services/WorkspaceService.ts`
- `src/controllers/WorkspaceController.ts`
- `public/ts/entities/Workspace.ts`
- `public/ts/services/WorkspaceService.ts`
- `public/ts/controllers/AppController.ts`
- `swagger.yml`
- `http/api.http`

Expected test files:

- `src/tests/unit/workspace-service.test.ts`
- `src/tests/unit/workspace-controller-missing-auth-user.test.ts`
- `src/tests/integration/workspace-service-db.test.ts`
- `src/tests/unit/migration-files.test.ts`

If implementation discovers a listed file is unnecessary, it may omit it only
when the approved spec behavior remains fully covered by other listed files.

## Test-First Subagent Assignment

Spawn exactly one clean-context test-focused subagent before production
implementation. Use model `gpt-5.3-codex-spark`.

Assignment:

- Read only the approved spec, this plan, `AGENTS.md`,
  `/home/alexbanica/workspace.md`, and the minimal test/helper files needed to
  edit tests named in this plan.
- Add failing deterministic tests for:
  - workspace role helper behavior for `admin`, `manager`, `member`, missing
    workspace, and missing membership;
  - admin can invite users while manager and member cannot;
  - admin can remove manager/member memberships while manager and member cannot;
  - removing the only admin is rejected;
  - admin can update a target membership between `manager` and `member`;
  - assigning a second admin is rejected;
  - demoting the only admin is rejected;
  - invalid role update input is rejected;
  - role updates affect only the target workspace;
  - admins and managers can create/update/delete services;
  - admins and managers can create owners and environments;
  - members cannot perform resource administration;
  - workspace listing exposes the current user's per-workspace role;
  - browser role gating exposes manager resource controls and keeps user
    administration controls admin-only;
  - schema/migration support for the `manager` role in `workspace_users`.
- Do not implement production behavior.
- Run `npm run lint` after test edits and fix lint issues in changed test files.
- Report test files changed and any blockers.

## Implementation Subagent Assignment

After test-first work completes, spawn no more than one clean-context
implementation subagent for production implementation. Use model
`gpt-5.3-codex-spark`.

Assignment:

- Read only the approved spec, this plan, instructions, failing tests, and
  production files named in this plan.
- Implement the approved behavior without broadening scope.
- Keep role behavior workspace-scoped and avoid platform-role changes except
  preserving existing `platform_admin` workspace-creation behavior.
- Run `npm run lint` and fix every lint issue before handoff.
- Do not commit or push.

## Implementation Steps

1. Branch and state
   - Verify `git status --short --branch`.
   - Create/switch to `feature/workspace-roles-user-administration` from `main`
     only when branch state matches the plan.
   - Preserve unrelated worktree changes if present.

2. Schema and migrations
   - Update `config/schema/workspace_users.sql` so `role` accepts exactly
     `admin`, `manager`, and `member`.
   - Add deterministic migration
     `config/migrations/0005_workspace-users-add-manager-role_workspace_users.sql`
     that changes the existing enum to include `manager` without changing
     existing `admin` or `member` rows.
   - Update migration tests so the new migration filename follows the
     repository naming convention.

3. Role model and repository layer
   - Introduce a shared TypeScript workspace-role type or constant set in the
     smallest suitable local boundary.
   - Extend `WorkspaceUserRepository` to:
     - insert `admin`, `manager`, or `member`;
     - fetch a user's role for a workspace;
     - check admin capability;
     - check resource-administration capability for admin or manager;
     - update a membership role;
     - delete a membership;
     - count admins in a workspace or otherwise enforce the single-admin
       invariant.
   - Keep membership checks scoped by `(workspace_id, user_id)`.

4. Workspace listing and detail data
   - Extend server `Workspace` and browser `Workspace` entities with
     current-user workspace role.
   - Update `WorkspaceRepository.listByUser` to include the current user's role
     from their membership row.
   - Update `WorkspaceController` `GET /api/workspaces` and
     `POST /api/workspaces` responses to include the current user's role.
   - Update `public/ts/services/WorkspaceService.ts` parsing for the new role
     field.
   - Add or update a user-detail API shape that exposes user id, email, and
     role for user administration while preserving existing popup detail rows.

5. WorkspaceService authorization behavior
   - Replace admin-only checks on resource administration with an
     admin-or-manager capability check for:
     - create service;
     - update service;
     - delete service;
     - create owner;
     - create environment;
     - owner/environment listing when used by management workflows.
   - Keep member read/list behavior available to all workspace members.
   - Preserve membership-filtered service availability and reservation behavior
     for `GET /api/services`, `POST /api/claim`, `POST /api/release`,
     `POST /api/extend`, `GET /events`, and `GET /api/events`.
   - Keep invitation creation admin-only.
   - Add `updateWorkspaceUserRole(workspaceId, actorUserId, targetUserId, role)`
     with approved single-admin behavior:
     - target membership missing returns `Workspace user not found`;
     - invalid role returns `Invalid workspace role`;
     - second-admin assignment returns `Workspace already has an admin`;
     - demoting the only admin returns `Workspace must have one admin`;
     - idempotent update of existing admin to `admin` succeeds.
   - Add `removeWorkspaceUser(workspaceId, actorUserId, targetUserId)` with
     approved behavior:
     - target membership missing returns `Workspace user not found`;
     - removing the only admin returns `Workspace must have one admin`;
     - removing manager/member membership succeeds.
   - Ensure role changes and removals affect only the target workspace.

6. WorkspaceController endpoints
   - Update all existing workspace endpoints to match the approved endpoint
     authorization matrix:
     - `GET /api/workspaces`: all memberships, with current-user role returned;
     - `POST /api/workspaces`: existing `platform_admin` behavior, creator
       becomes workspace `admin`;
     - `GET /api/workspaces/:workspaceId/services`: admin, manager, and member;
     - `POST /api/workspaces/:workspaceId/services`: admin and manager;
     - `PATCH /api/workspaces/:workspaceId/services/:serviceId`: admin and
       manager;
     - `DELETE /api/workspaces/:workspaceId/services/:serviceId`: admin and
       manager;
     - `GET /api/workspaces/:workspaceId/owners`: admin and manager;
     - `POST /api/workspaces/:workspaceId/owners`: admin and manager;
     - `GET /api/workspaces/:workspaceId/environments`: admin and manager;
     - `POST /api/workspaces/:workspaceId/environments`: admin and manager;
     - `GET /api/workspaces/:workspaceId/detail/users`: admin, manager, and
       member;
     - `GET /api/workspaces/:workspaceId/detail/services`: admin, manager, and
       member;
     - `GET /api/workspaces/:workspaceId/detail/owners`: admin, manager, and
       member;
     - `GET /api/workspaces/:workspaceId/detail/environments`: admin, manager,
       and member;
     - `POST /api/workspaces/:workspaceId/invitations`: admin only.
   - Add an admin-only user-administration list endpoint if needed by the UI:
     - `GET /api/workspaces/:workspaceId/users`
     - success response includes user id, email, and workspace role.
   - Add an admin-only role update endpoint:
     - `PATCH /api/workspaces/:workspaceId/users/:userId/role`
     - request body `{ "role": "admin" | "manager" | "member" }`
     - success response includes target user id and role.
   - Add an admin-only remove-user endpoint:
     - `DELETE /api/workspaces/:workspaceId/users/:userId`
     - success returns `204`.
   - Map errors deterministically:
     - unauthenticated remains `401`;
     - non-activated remains `403`;
     - unauthorized workspace role returns `403`;
     - missing workspace or target membership returns `404`;
     - invalid role returns `400`;
     - second-admin assignment, only-admin demotion, and only-admin removal
       return `409`.

7. Browser role-aware administration
   - Replace browser admin gating that uses `adminUserId === user.id` with
     workspace role checks.
   - Update frontend route/view guards so `/administration` is valid only when
     the current activated user has at least one `admin` or `manager`
     workspace.
   - Render a deterministic "Not authorized" state when a user navigates to a
     route, section, selected workspace, or action that is not valid for the
     user's current workspace role.
   - Show resource management controls for `admin` and `manager`.
   - Show invite, remove-user, and role-update controls only for `admin`.
   - Keep `member` unable to access administration controls.
   - Keep Workspace Management user-administration views admin-only.
   - Keep Service Management resource-administration views available to admins
     and managers.
   - Keep service availability, claim, release, extend, and event subscriptions
     available for all workspace roles through existing membership-filtered API
     calls.
   - Add browser service calls for role update, user removal, and any detailed
     user list endpoint needed by the UI.
   - Keep existing modal/reset patterns for workspace administration flows.

8. Documentation and API contracts
   - Update `swagger.yml` with:
     - workspace role enum values;
     - `GET /api/workspaces` role field;
     - endpoint-by-endpoint role authorization for workspace, service
       availability, reservation, and event APIs;
     - workspace user detail data used for user administration;
     - role-update endpoint;
     - remove-user endpoint;
     - authorization and conflict responses.
   - Update `http/api.http` with role update and workspace user removal
     examples.
   - Update `AGENTS.md` with the workspace role model and authorization
     guidance.

## Review Subagent Assignment

After production implementation, spawn exactly one clean-context code-review
subagent. Use only the approved spec, this plan, instructions, and final diff.

The review subagent must:

- check implementation against every approved behavior;
- identify spec mismatches, missing tests, role-scope regressions,
  single-admin invariant gaps, authorization leaks, frontend/backend permission
  mismatches, schema migration regressions, and documentation drift;
- not implement fixes.

Main agent routes in-scope review findings requiring code changes to one
clean-context implementation subagent with only the finding, approved artifacts,
relevant diff/file context, and the allowed ownership boundary.

## Main-Agent QA

After review findings are resolved, the main agent must:

- run the validation commands below;
- inspect the final diff for generated files, unrelated edits, and credential
  leakage;
- verify the docs mention the same endpoint paths and role values implemented
  by the code;
- if practical, start the app with local configuration and manually verify:
  - admin sees user administration controls;
  - manager sees resource management controls but not user administration
    controls;
  - member does not see administration controls;
  - direct navigation to an unauthorized frontend route or section shows "Not
    authorized".

If manual browser QA cannot be performed because local database credentials or
seed data are unavailable, report the blocker and mark that QA area unverified.

## Validation Commands

Run these commands in order:

1. `npm run lint`
2. `npm run build`
3. `npm test`
4. `git diff --check`

The main agent must run `npm run format` before committing accepted changes.

## Documentation Requirements

- `AGENTS.md` must describe the workspace roles and capability split.
- `swagger.yml` must document the new role-aware workspace API contract.
- `http/api.http` must provide usable examples for role update and user
  removal.

## Commit And Push

- Commit accepted changes after review, QA, validation, documentation, and final
  main-agent acceptance.
- Use commit message:
  `feature: Add workspace manager role and user administration`
- If required validation, review, QA, or documentation is skipped, blocked,
  incomplete, or failing, use:
  `feature: DRAFT add workspace manager role and user administration`
- Push the implementation branch after the commit when repository access is
  available.

## Completion Report Requirements

The implementation completion report must include:

- summary of implemented workspace role behavior;
- issues found during code review and which were resolved;
- issues found during QA and which were resolved;
- validation commands run and results;
- validation or QA not performed;
- documentation updates performed;
- commit and push status;
- whether delivery is final or draft;
- remaining risks or limitations;
- confirmation that final main-agent acceptance completed.

# PLAN: Workspace Environments And UUID Service Contracts

Status: Approved

Approved spec: `specs/SPEC-workspace-environments-service-uuid-contract.md`

## Objective

Implement the approved UUID schema and workspace-scoped reference-data behavior: remove numeric application ids, rewrite schema files for an empty database, make workspace/service/environment/owner/user identity UUID-based, generate `service_key` deterministically in backend code, move owner and environment creation into Workspace Management popups, and restrict Service Management to selecting existing workspace-scoped owners and environments.

## Branch

- Target branch: current branch `workingspaces`.
- Do not create a new branch unless the user requests one before implementation.
- Preserve unrelated dirty worktree changes.
- Keep commits out of scope unless the user explicitly requests a commit later.

## Context Boundary

- Implementation must start from the approved spec and this approved plan only.
- Before implementation starts, satisfy the required clean-context boundary with a fresh session, an explicitly cleared context, or explicit user confirmation that continuing in this context is intentional.
- The implementation command must not perform new product or architecture research beyond files named or directly implied here.

## Architecture Approach

- Preserve DDD/onion dependency direction:
  - controllers translate HTTP request/response shapes
  - services enforce authorization and use-case behavior
  - repositories own MySQL persistence details
  - entities/DTOs remain independent of Express, MySQL, browser DOM, and runtime filesystem details
- Use UUID string identifiers as the schema primary identifiers and application identifiers.
- Treat numeric ids as removed, not hidden.
- Rewrite schema files for the user-provided empty database instead of building old-schema compatibility migrations.
- Keep `service_key` as the reservation key for service-environment associations.
- Generate UUIDs and service keys in backend service logic before repository inserts.
- Model owners as workspace-scoped records, referenced by services through `owner_id` or nullable equivalent.
- Keep service-environment associations as relationship rows keyed by UUID references and carrying a unique `service_key`.

## Affected Files

- `config/schema/users.sql`
- `config/schema/user_roles.sql`
- `config/schema/workspaces.sql`
- `config/schema/workspace_users.sql`
- `config/schema/workspace_invitations.sql`
- `config/schema/services.sql`
- `config/schema/environments.sql`
- `config/schema/service_environments.sql`
- `config/schema/reservations.sql`
- new `config/schema/owners.sql`
- `src/db.ts`
- `src/entities/User.ts`
- `src/entities/Workspace.ts`
- `src/entities/WorkspaceInvitation.ts`
- `src/entities/ServiceDefinition.ts`
- `src/entities/Reservation.ts`
- new owner entity or DTO if needed
- `src/dtos/*` where ids are represented
- `src/types/express-session.d.ts`
- `src/controllers/AuthController.ts`
- `src/controllers/AuthMiddleware.ts`
- `src/controllers/WorkspaceController.ts`
- `src/controllers/ReservationController.ts`
- `src/repositories/UserRepository.ts`
- `src/repositories/UserRoleRepository.ts`
- `src/repositories/WorkspaceRepository.ts`
- `src/repositories/WorkspaceUserRepository.ts`
- `src/repositories/WorkspaceInvitationRepository.ts`
- `src/repositories/ServiceRepository.ts`
- `src/repositories/ReservationRepository.ts`
- `src/services/UserService.ts`
- `src/services/WorkspaceService.ts`
- `src/services/ReservationService.ts`
- `src/services/ServiceCatalogService.ts`
- `public/ts/entities/User.ts`
- `public/ts/entities/Workspace.ts`
- `public/ts/entities/Service.ts`
- `public/ts/services/AuthService.ts`
- `public/ts/services/WorkspaceService.ts`
- `public/ts/services/ReservationService.ts`
- `public/ts/services/EventsService.ts`
- `public/ts/controllers/AppController.ts`
- `public/index.html`
- `public/styles.css`
- `src/tests/unit/*.test.ts`
- `src/tests/integration/*.test.ts`
- `README.md` only if it documents affected API/schema/admin workflows.

## Schema Implementation Steps

1. Rewrite schema files for an empty database:
   - replace integer `id INT AUTO_INCREMENT` primary keys with UUID string primary identifiers
   - use `VARCHAR(36)` UUID columns consistently, or the repository's chosen UUID string type if already standardized
   - remove numeric foreign-key columns
   - update all foreign keys to reference UUID identifiers
   - add `owners` schema with workspace-scoped `owner_id`, `workspace_id`, `name`, and timestamps
   - make services reference nullable `owner_id` instead of free-text owner
   - keep `service_environments.service_key VARCHAR(255) NOT NULL UNIQUE`
   - preserve useful uniqueness constraints:
     - user email globally unique
     - environment name unique per workspace, case policy handled by code/tests
     - owner name unique per workspace, case policy handled by code/tests
     - service-environment pair unique

2. Update `src/db.ts`:
   - include the new `owners` schema in creation order before `services`
   - remove old compatibility code that alters numeric-id tables or backfills old `service_key` values
   - keep startup initialization focused on empty-database table creation and optional seed loading
   - ensure schema order satisfies UUID foreign keys

3. Update integration-test schema setup to match the rewritten UUID schema.

## Backend Implementation Steps

1. Update entity and DTO constructors/types to use string UUID identifiers:
   - users: `userId`
   - workspaces: `workspaceId`, `adminUserId`
   - services: `serviceId`
   - environments: `environmentId`
   - owners: `ownerId`
   - reservations and claimed-by references use UUID identifiers where user identity is exposed

2. Update session typing and authentication:
   - store authenticated user UUID in session
   - update auth middleware and controllers to treat session user identity as UUID
   - update login/user lookup paths to return UUID-backed users

3. Update repositories:
   - remove numeric id assumptions from method signatures and query parameters
   - use UUID primary keys and UUID foreign keys in all SQL
   - add owner repository methods or owner-related methods in the workspace/service repository consistent with local style
   - add workspace overview queries returning user, service, owner, and environment counts
   - add detail-list queries for clicked stat popups:
     - users by workspace UUID
     - services by workspace UUID
     - owners by workspace UUID
     - environments by workspace UUID
   - ensure service queries return owner UUID/name rather than free-text owner
   - ensure service creation/edit validates submitted owner/environment UUIDs belong to the selected workspace
   - ensure service-environment association insert receives an explicit generated `service_key`

4. Update `WorkspaceService` use cases:
   - generate UUIDs with `randomUUID()` for users, workspaces, services, environments, and owners as needed
   - create environments only through workspace environment use cases
   - create owners only through workspace owner use cases
   - reject duplicate owner/environment names case-insensitively inside a workspace
   - create services from a label, default minutes, optional owner UUID, and selected environment UUIDs
   - reject service create/edit with no selected environments using `Select at least one environment.`
   - reject unknown or cross-workspace owner/environment UUIDs
   - preserve service UUID on edit
   - block owner deletion while assigned to services unless the implementation has a deterministic clear behavior approved by the spec assumptions
   - block environment deletion while associated with services unless the implementation has a deterministic cascade behavior approved by the spec assumptions

5. Update controllers:
   - expose workspace UUID routes instead of numeric workspace ids
   - expose owner/environment creation/list/delete endpoints under workspace UUID routes
   - expose overview stat popup detail endpoints or one typed endpoint that returns only the requested resource type
   - keep status mapping consistent with existing patterns:
     - 400 for validation errors
     - 403 for authorization failures
     - 404 for not found
     - 409 for duplicate owner/environment or active-reference deletion conflicts when appropriate
   - update service create/edit payloads to use `environment_ids` and optional `owner_id`, not free-text owner/environment creation input

6. Update reservation services/controllers/repositories:
   - keep reservation operations keyed by `service_key`
   - update user identity fields to UUID
   - preserve claim/release/extend behavior while compiling against UUID types

## Frontend Implementation Steps

1. Update browser entities and services:
   - use UUID strings for all workspace, user, service, environment, and owner identities
   - parse `workspace_id`, `user_id`, `service_id`, `environment_id`, and `owner_id`
   - remove numeric `id`, `workspaceId: number`, `adminUserId: number`, and `claimedById: number` assumptions

2. Update Workspace Management UI:
   - show each administered workspace with count tags for users, services, owners, and environments
   - show `Invite user`, `Create owner`, and `Create environment` actions alongside each workspace
   - implement create-owner and create-environment popups with isolated state
   - keep the existing invite-user popup behavior, updated for UUID workspace identity
   - refresh counts and relevant lists after successful owner/environment creation
   - make count tags clickable and keyboard reachable
   - implement a read-only popup that loads and displays only the clicked resource type for the clicked workspace
   - reset popup state on close/cancel

3. Update Service Management UI:
   - use workspace UUID for selected workspace state and cache keys
   - list only selected-workspace services
   - load selected-workspace environments and owners from backend endpoints
   - disable service creation when no environments exist for the selected workspace
   - render environment selection from existing environment options only
   - render owner selection from existing owner options only, allowing no owner
   - remove free-text environment creation from create/edit forms
   - remove free-text owner creation from create/edit forms
   - submit service create/edit with selected environment UUIDs and optional owner UUID

4. Update styling:
   - keep admin dashboard layout compact and responsive
   - ensure count tags look interactive and have visible hover/focus states
   - ensure popups do not overflow mobile widths
   - ensure long names wrap without overlap

## Test-First Subagent Assignment

Use exactly one clean-context test-focused subagent before production implementation.

Model requirement from workspace instructions: `gpt-5.3-codex-spark`.

Input context:

- approved spec
- this plan
- listed schema files
- listed backend service/repository/controller test files
- minimal relevant source signatures needed to write tests

Assignment:

- Write deterministic tests before production implementation.
- Cover UUID schema initialization on an empty database.
- Cover absence of numeric auto-increment application ids where practical.
- Cover workspace overview counts for users, services, owners, and environments.
- Cover stat-popup detail query scoping by workspace UUID and resource type.
- Cover owner/environment creation authorization, validation, and duplicate-name behavior.
- Cover service create/edit using existing owner/environment UUIDs only.
- Cover rejection of cross-workspace owner/environment UUIDs.
- Cover explicit `service_key` persistence on service-environment associations.
- Do not implement production behavior.
- Report any spec/plan conflict instead of resolving it independently.

## Implementation Subagent Assignment

Use exactly one clean-context implementation subagent after test-first work.

Model requirement from workspace instructions: `gpt-5.3-codex-spark`.

Input context:

- approved spec
- approved plan
- tests produced by the test-focused subagent
- exact affected files from this plan
- failing test output

Assignment:

- Implement only the schema, backend, frontend, styling, and tests described in this plan.
- Preserve unrelated dirty worktree changes.
- Do not perform product research, architecture research, scope discovery, or plan discovery.
- Stop and escalate if implementation requires changing approved behavior.

## Code-Review Subagent Assignment

Use exactly one clean-context code-review subagent after implementation.

Model requirement from workspace instructions: `gpt-5.3-codex-spark`.

Input context:

- approved spec
- approved plan
- final diff
- relevant test results

Assignment:

- Review implementation against approved spec and plan.
- Focus on:
  - remaining numeric id usage in schema/API/frontend
  - accidental old-schema compatibility code
  - cross-workspace owner/environment leaks
  - service creation creating owners or environments
  - missing explicit `service_key` generation
  - broken reservation behavior
  - popup data mixing resource types or workspaces
  - missing authorization on workspace owner/environment endpoints
  - missing tests for UUID identity and workspace-scoped reference data
  - responsive/accessibility issues in popups and count tags
- Do not implement fixes.

## Main-Agent QA Requirements

After implementation and review findings are resolved, the main agent must run:

- `npm run build`
- `npm test`
- `git diff --check`

Manual QA when a dev server/browser and empty database are available:

- Start with an empty application database.
- Start the app with `npm run dev`.
- Create or seed a platform/admin user through the supported local workflow.
- Open Workspace Management.
- Verify workspace cards show user, service, owner, and environment count tags.
- Verify `Invite user`, `Create owner`, and `Create environment` appear alongside each administered workspace.
- Verify `Create owner` opens an owner popup and creates an owner for only that workspace.
- Verify `Create environment` opens an environment popup and creates an environment for only that workspace.
- Verify duplicate owner and environment names are rejected within one workspace.
- Verify clicking each count tag opens a popup with only the matching resource type for that workspace.
- Open Service Management.
- Verify service creation is disabled when the selected workspace has no environments.
- Verify service creation can select only existing environments and existing owners from the selected workspace.
- Verify service creation succeeds without missing `service_key` errors.
- Verify cross-workspace owner/environment options are not visible and cannot be submitted successfully.
- Verify reservation claim/release/extend behavior still works for created services.
- Check desktop and mobile widths for no horizontal overflow or overlapping text.

If browser/manual QA is blocked by local environment setup, report the unvalidated areas and mark delivery draft unless the user explicitly accepts build/test-only validation.

## Documentation

- Update README only if it documents schema setup, API contracts, or admin management workflows affected by UUIDs, owners, environments, or empty-database initialization.
- Do not add unrelated documentation churn.

## Validation Pass Criteria

- `npm run build` passes.
- `npm test` passes.
- `git diff --check` passes.
- Tests cover UUID schema, workspace-scoped owners/environments, stat popup scoping, and service key generation.
- Manual QA is completed or explicitly reported as unvalidated draft risk.

## Commit And Push

- Do not commit or push unless the user explicitly requests it after implementation.

## No-Research Implementation Constraint

Implementation must not reinterpret requirements. Use only the approved spec, this approved plan, applicable instructions, and minimal local file context needed to edit the listed files.

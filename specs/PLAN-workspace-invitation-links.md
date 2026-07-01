# Workspace Invitation Links Implementation Plan

Status: Approved

## Approved Spec

- `specs/SPEC-workspace-invitation-links.md`

## Branch Policy

- Stay on the current branch unless the user explicitly requests a new branch.
- Inspect `git status --short --branch` before implementation edits.
- Preserve unrelated dirty worktree changes.
- Do not commit or push unless the user explicitly requests it.

## Ownership Boundaries

- In scope:
  - workspace invitation persistence, expiry, hashing, validation, acceptance,
    and reinvitation behavior;
  - invitation expiry configuration through `config/app.yml` and
    `WORKSPACE_INVITATION_EXPIRES_IN_SECONDS`;
  - registration invite context and automatic `member` membership creation;
  - workspace user-management response rows for users and invitation statuses;
  - browser invitation link page/route, registration invite handling,
    post-login invitation handoff, administration visibility, invitation status
    rows, and reinvite controls;
  - read-only workspace and service availability access for non-activated users
    whose invitation was accepted during registration;
  - removal of the `admin` promotion option from browser workspace user
    administration while preserving backend conflict behavior;
  - API contracts and HTTP examples for changed invitation and user-management
    behavior;
  - focused tests for the approved behavior.
- Out of scope:
  - real email delivery;
  - bulk invitation management;
  - invitation revocation UI;
  - inviting directly as `admin` or `manager`;
  - changing workspace role/removal rules beyond approved invitation visibility
    and reinvitation;
  - allowing non-activated users to perform protected mutations;
  - unrelated UI redesign, commits, pushes, or branch changes.

## Affected Files

- `config/app.yml`
- `config/schema/workspace_invitations.sql`
- `config/migrations/*`
- `src/services/ConfigLoaderService.ts`
- `src/service-availability-scheduler.ts`
- `src/entities/WorkspaceInvitation.ts`
- `src/repositories/WorkspaceInvitationRepository.ts`
- `src/repositories/WorkspaceUserRepository.ts`
- `src/repositories/UserRepository.ts`
- `src/services/WorkspaceService.ts`
- `src/services/UserService.ts`
- New invitation-code service if needed, following the token service patterns.
- `src/controllers/WorkspaceController.ts`
- `src/controllers/AuthController.ts`
- `src/controllers/PageController.ts`
- `public/ts/services/ApiService.ts`
- `public/ts/services/RegistrationService.ts`
- `public/ts/services/WorkspaceService.ts`
- New browser invitation service/controller files if needed.
- `public/ts/controllers/LoginController.ts`
- `public/ts/controllers/AppController.ts`
- `public/index.html`
- `public/login.html`
- New invitation page HTML if needed.
- `public/styles.css`
- `swagger.yml`
- `http/api.http`
- `AGENTS.md`
- `src/tests/unit/config-loader-service.test.ts`
- `src/tests/unit/workspace-service.test.ts`
- `src/tests/integration/workspace-service-db.test.ts`
- `src/tests/unit/auth-controller-password-login.test.ts`
- `src/tests/unit/browser-auth-services.test.ts`
- `src/tests/unit/page-controller-cache.test.ts`
- `src/tests/unit/workspace-controller-missing-auth-user.test.ts`
- `src/tests/unit/migration-files.test.ts`
- Integration migration tests if schema migration coverage requires updates.

## Implementation Steps

1. Add test-first backend and config coverage.
   - Add config-loader tests for default `86400`, app YAML value,
     `WORKSPACE_INVITATION_EXPIRES_IN_SECONDS` override, and invalid
     zero/negative/non-numeric values.
   - Add workspace-service tests for admin and manager invitation creation,
     member denial, already-member conflict, duplicate unexpired pending invite
     conflict, expired reinvitation, existing-user pending rows,
     unregistered-email pending rows, and expired status rows.
   - Add invitation-code tests for invalid, expired, used, accepted, existing
     user, unregistered user, and wrong-authenticated-user cases.
   - Add registration controller tests for valid invite context, email mismatch,
     invalid or expired invite code, transaction rollback, membership creation,
     accepted invitation status, activation-link logging, and normal
     no-invite registration regression.
   - Add focused tests for post-login invitation return, non-activated
     invited-user read-only access, per-workspace administration visibility,
     and absence of the browser `admin` promotion option.

2. Implement configuration plumbing.
   - Add `workspace_invitation_expires_in_seconds` to `config/app.yml`.
   - Add `workspaceInvitationExpiresInSeconds` to `ConfigLoaderService` with
     env override `WORKSPACE_INVITATION_EXPIRES_IN_SECONDS`.
   - Validate the value as a positive finite number.
   - Pass the value from `service-availability-scheduler.ts` into the
     invitation service path.

3. Update invitation persistence.
   - Add or migrate columns required by the approved spec: normalized invited
     email, optional invited user ID, inviter user ID, hashed code, expiry
     timestamp, accepted/used timestamp, invalidation or revoked state if kept,
     and timestamps needed for status display.
   - Preserve existing fresh schema and migration conventions.
   - Keep old accepted rows and existing-user invitation data migratable where
     practical.
   - Enforce one unexpired pending invitation per workspace and normalized
     email in service logic, not through a constraint that blocks reinvitation
     after expiry.
   - Store only code hashes, never raw codes.

4. Implement invitation domain/service behavior.
   - Generate high-entropy opaque invitation codes and hash them consistently
     with reset/activation token patterns.
   - Create invitations for existing users and unregistered emails.
   - Log invitation links with a clear TODO replacing logging with email
     delivery later.
   - Validate invitation codes without authentication for the link flow.
   - Accept existing-user invitations only for the matching authenticated user;
     reject anonymous acceptance and wrong authenticated users.
   - Grant `member` membership and mark invitation accepted atomically.
   - Treat expired, used, accepted, revoked, and invalid codes as not reusable.
   - Implement reinvitation from the same creation endpoint when the latest
     invitation for the workspace/email is expired.

5. Integrate invitation context with registration.
   - Accept an invitation code in registration payload only when present.
   - Require the registration email to match the invitation email after
     normalization.
   - In the successful registration transaction, create the user, create the
     activation token, create `member` membership, and mark the invitation
     accepted.
   - Preserve current registration response shape and no-link-in-response
     behavior.
   - Keep activation gating unchanged after registration.

6. Expand workspace user-management backend contract.
   - Return accepted user rows with user ID, email, role, and activation warning
     metadata when applicable.
   - Return invitation rows for pending and expired invitations with invited
     email, invitation status, expiry status, and a stable row/action
     identifier.
   - Allow admins and managers to read invitation-status rows and reinvite
     expired invitations.
   - Keep role mutation and membership removal endpoints admin-only and limited
     to accepted users.

7. Add controller routes and page serving.
   - Update `POST /api/workspaces/:workspaceId/invitations` for admin/manager
     authorization, unregistered emails, expiry, and reinvitation.
   - Add unauthenticated invitation validation endpoints as needed for the
     browser invitation page.
   - Keep existing-user invitation acceptance authenticated and require the
     authenticated user's email to match the invitation email.
   - Serve `/workspace-invitations/:code` with no-cache headers.
   - Preserve activation middleware for mutation endpoints.
   - Split or adjust read-only workspace and service availability routes so
     non-activated invited users can read their member workspace data while
     mutation endpoints remain activation-gated.
   - Extend missing-auth-user route tests for any new protected routes.

8. Update browser invitation, login, and registration flows.
   - Add browser service methods for invitation validation, acceptance, and
     reinvitation.
   - Add an invitation link page/controller or route that shows valid, invalid,
     expired, existing-user, and unregistered-invite states.
   - For existing-user invitations, require sign-in before acceptance when no
     valid matching session is active.
   - When the user chooses sign-in from the invitation page, preserve the
     invitation code in the login URL or scoped browser state that is created
     only by that click.
   - After a successful login started from the invitation page, return to
     `/workspace-invitations/:code` and reopen the invitation prompt.
   - Ensure normal login without an invitation-link handoff always goes to
     `/overview` and does not reopen stale invitation prompts.
   - Redirect unregistered invitees to registration with invitation context.
   - Pre-fill or lock the invited email during registration.
   - Include the invitation code in registration requests when present.
   - Ensure unauthenticated invitation validation does not send Authorization.

9. Update non-activated invited-user read-only app behavior.
   - Load workspace list and service availability data for authenticated
     non-activated users when they have accepted invitation memberships.
   - Keep activation banner visible.
   - Hide or disable claim, extend, release, workspace creation, invitation,
     role mutation, removal, and resource administration controls while the
     account is not activated.
   - Prevent auto-refresh, event subscriptions, and mutation retries that would
     require activated-account permissions unless the implementation safely
     proves read-only refresh is allowed.
   - Preserve full member-allowed actions after activation.

10. Update authenticated app user-management UI.
   - Parse mixed user and invitation rows from the workspace user-management
     API.
   - Show pending invitation rows with email-only identity and pending status.
   - Show expired invitation rows with email-only identity, expired status, and
     reinvite action for admins/managers.
   - Show accepted user rows with user details, role, and admin-only role/remove
     controls.
   - Remove `admin` from role-editing options for non-admin target users while
     keeping existing admin users displayed as `admin`.
   - Preserve backend conflict handling for any attempted `admin` promotion.
   - Show an `Account not activated` warning flag for accepted users whose
     account is not activated.
   - Remove the warning when backend data reports activation.
   - Refresh user-management rows after invite and reinvite actions.

11. Update administration visibility.
    - Hide the administration button/page entry point only when the current user
      has no `admin` or `manager` workspace.
    - Preserve the administration button/page for users who administer at least
      one workspace, even when they are only `member` in other invited
      workspaces.
    - Prevent direct `/administration` navigation from revealing controls to
      users with only member workspaces.
    - Ensure workspace/resource/user administration selectors include only
      workspaces where the current user has the required role for that section.
    - Keep server authorization as the source of truth.

12. Update API documentation, examples, and repo guidance.
    - Update `swagger.yml` for invitation creation, validation, acceptance,
      reinvitation, registration invite context, expanded user-management rows,
      and changed authorization.
    - Document non-activated invited-user read-only access and continued `403`
      behavior for protected mutations.
    - Document deterministic conflict behavior for attempted `admin` promotion
      if the role update contract is touched.
    - Update `http/api.http` or split domain examples if useful for invitation
      creation, validation, login handoff expectations, acceptance, expired
      reinvitation, read-only non-activated invited access, and registration
      with invite context.
    - Update `AGENTS.md` only for durable config guidance if the implemented
      configuration key is added.
    - Update `AGENTS.md` authorization guidance to describe the narrow
      non-activated invited-user read-only exception.

13. Final review and QA.
    - Review the diff for spec match, role leakage, token/code leakage,
      cross-workspace isolation, transaction safety, expired/used-code reuse,
      browser state refresh, stale invitation handoff state, activation read vs
      mutation gating, and per-workspace administration visibility.
    - Run required validation commands.
    - Fix in-scope review or validation findings before completion.

## Test-First And Subagent Requirements

- Test-first is applicable because this changes invitation, registration,
  authorization, and workspace membership business behavior.
- Use exactly one clean-context test-focused subagent before production
  implementation.
- Use no more than one active implementation worker for production changes.
- This is a big spec; split implementation work into serial low-coupling
  subtasks no longer than about five minutes of active worker time each.
- Use no more than one active clean-context code-review subagent after
  implementation.
- The test-first subagent must cover the new 2026-07-01 iteration behavior:
  post-login invitation handoff, non-activated invited-user read-only access,
  per-workspace administration visibility, and removal of the browser `admin`
  promotion option.
- Subagents must use `gpt-5.3-codex-spark` per workspace instructions.
- The main agent owns final QA and validation.

## Validation Commands

- `npm run lint`
- `npm run build`
- `npm test`
- `git diff --check`

Run `npm run build` and `npm test` sequentially because this repository's build
process can remove/reinstall `node_modules`.

## Documentation

- Required: `swagger.yml` and `http/api.http`.
- Required: `AGENTS.md` authorization guidance for the non-activated invited
  read-only exception.
- Required if implemented config changes are durable: `AGENTS.md` configuration
  guidance.
- Not required unless implementation changes local startup or operational
  behavior beyond the approved configuration key: README.

## Commit And Push

- Do not commit or push by default.
- If the user later requests a commit, run `npm run format` first and commit
  only accepted in-scope changes.

## No-Research Constraint For Implementation

Implementation must use this approved plan, the approved spec, repository
instructions, current branch/worktree state, and directly affected local files.
Do not reopen product discovery or change approved behavior during
implementation. If implementation reveals a spec or plan conflict, stop and ask
for an amendment.

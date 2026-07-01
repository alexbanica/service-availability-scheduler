# Workspace Invitation Links

Status: Approved

## Purpose

Allow workspace admins and managers to invite existing and unregistered people
to their workspaces through temporary server-logged invitation links until email
delivery exists.

## Problem

The current workspace invitation endpoint can invite only existing users and the
database schema requires `invited_user_id`. The app has no email delivery yet,
so invitation links must follow the same temporary pattern as password reset and
account activation: generate the link, log it server-side with a clear TODO,
and do not expose the raw link in API responses.

## Scope

- Let workspace admins and managers create workspace invitations by email.
- Support invitations for existing users and for email addresses that are not
  registered yet.
- Generate a one-time invitation link containing an opaque code.
- Expire invitation links after a configurable duration that defaults to 24
  hours.
- Log the invitation link server-side with a TODO stating that email delivery
  must replace logging later.
- Let existing invited users accept the link and receive `member` access to the
  invited workspace.
- Let unregistered invited people open the link, register an account for the
  invited email address, and receive `member` access automatically.
- Preserve activation gating: newly registered invitees can see their member
  workspace and workspace service data after registration, but protected
  actions remain blocked until account activation.
- Show invited emails and invitation status in the workspace user-management
  page.
- Let authorized inviters send a new invitation when a previous invitation has
  expired from both workspace management and user management.
- Keep administration available for users who administer at least one
  workspace, even when those users are only members of other invited
  workspaces.
- Hide administration controls for workspace members on the invited workspaces
  where they have only `member` access.
- Remove the `admin` role promotion option from workspace user administration.
- Update API contract documentation and HTTP examples for invitation creation,
  validation, acceptance, and registration invite context.

## Out Of Scope

- Real email delivery.
- Invitation management screens beyond the existing invite modal.
- Listing, revoking, resending, or expiring invitations through the UI.
- Dedicated bulk invitation administration.
- Changing workspace membership removal or the single-admin invariant.
- Letting managers remove users or change user roles.
- Inviting a user directly as `admin` or `manager`; accepted invitations always
  create `member` access.
- Changing account activation token behavior except where registration must
  consume a matching pending workspace invitation.
- Returning raw invitation links or raw invitation codes in API responses.

## Definitions

- Invitation code: An opaque, high-entropy one-time secret included in the
  logged invitation URL and stored only as a hash.
- Invitation email: The normalized email address entered by the inviter, trimmed
  and lowercased.
- Invitation expiry: The timestamp after which a pending invitation code can no
  longer be used.
- Existing invitee: A user account with an email address matching the invitation
  email when the invitation is created or accepted.
- Unregistered invitee: An invitation email that does not yet match a user
  account.
- Resource administrator: A user whose role in the target workspace is `admin`
  or `manager`.
- Accepted invitation: A pending invitation whose code has been consumed and
  whose invited email has been granted `member` membership in the workspace.
- Expired invitation: A pending invitation whose expiry timestamp is in the past
  and whose code can no longer be accepted.
- Reinvitation: Creating a new pending invitation and link for the same
  workspace and email after the prior invitation expired. Reinvitation may be
  triggered from the user-management expired invitation row or by submitting the
  same email again from the workspace-management invite flow.
- Invitation-auth handoff: The browser state created only after the invited
  person opens an invitation link and chooses to sign in. It preserves the
  invitation code through login so the invitation prompt can reappear after
  successful authentication.

## Inputs And Constraints

- Invitation creation input is `workspaceId` and `email`.
- The inviter must be authenticated, activated, and a resource administrator for
  the target workspace.
- The invitation email is normalized by trimming and lowercasing.
- Empty or invalid invitation emails are rejected deterministically.
- Invitation expiry is controlled by `workspace_invitation_expires_in_seconds`
  in `config/app.yml` or the `WORKSPACE_INVITATION_EXPIRES_IN_SECONDS`
  environment variable.
- The default invitation expiry is `86400` seconds, i.e. 24 hours.
- Invalid, zero, or negative configured invitation expiry values fail
  configuration loading.
- Invitation codes are single-use and stored hashed.
- Only the server log contains the raw link while email delivery is absent.
- The logged invitation URL uses a route such as
  `/workspace-invitations/<code>` and includes a clear TODO to replace logging
  with email delivery.
- Accepted invitations grant exactly `member` role.
- Existing workspace members cannot receive another pending invitation for the
  same workspace.
- A workspace cannot have more than one pending invitation for the same
  invitation email while that invitation is unexpired.
- A used, expired, revoked, invalid, or already consumed code is rejected as
  invalid and cannot be reused.
- After an invitation expires or is used, inviting the same email requires a new
  invitation with a new code.
- Activation gating remains server-enforced through existing protected endpoint
  middleware.
- A non-activated invited user may read the workspace list and service
  availability data for workspaces where registration accepted the invitation.
  Mutations and resource/user administration remain activation-gated.
- A user can hold different roles in different workspaces. A `member` role on
  an invited workspace must not reduce administration access for another
  workspace where the same user is `admin` or `manager`.

## Deterministic Behavior

### Creating Invitations

- `POST /api/workspaces/:workspaceId/invitations` remains authenticated and
  activation-gated.
- Workspace admins and managers can create invitations for their workspaces.
- Workspace members and non-members cannot create invitations.
- The request accepts an email address and normalizes it.
- If the normalized email belongs to an existing user who is already a member of
  the workspace, the request returns a conflict.
- If a pending invitation already exists for the normalized email in the target
  workspace and is not expired, the request returns a conflict.
- If the latest pending invitation for the normalized email in the target
  workspace is expired, the request creates a new pending invitation and leaves
  the user-management row in pending invitation status.
- Submitting the same email from the workspace-management invite modal after a
  previous invitation expired is treated as reinvitation, not as a duplicate
  conflict.
- Otherwise the system creates a pending invitation for the workspace,
  normalized email, inviter user, optional existing invited user, and hashed
  invitation code with an expiry timestamp.
- The server logs a message equivalent to:
  `Workspace invitation requested for <email>, use this TODO link:
  /workspace-invitations/<code> - TODO replace with email delivery`.
- The API response confirms creation but does not include the raw code or raw
  invitation URL.

### Opening An Invitation Link

- `GET /workspace-invitations/:code` serves a browser page or route that can
  validate the code without requiring authentication.
- Invalid, revoked, accepted, or already consumed codes show an invalid
  invitation state and do not create membership.
- Expired codes show an expired invitation state and do not create membership.
- A valid pending invitation for an existing user shows an invitation prompt
  only after the invited user has opened the invitation link.
- Existing-user invitation acceptance requires a valid authenticated session for
  the invited email address.
- If the browser has no valid session, the invitation page requires sign-in
  before acceptance. It must not accept the invitation anonymously.
- When the user chooses sign-in from the invitation page, the browser preserves
  the invitation code for the login flow.
- After successful login from that invitation-link handoff, the browser returns
  to `/workspace-invitations/<code>` and reopens the invitation prompt.
- A normal login that was not started from an invitation link must not reopen an
  invitation prompt from stale browser state.
- A valid pending invitation for an unregistered email sends the browser to the
  registration flow with invitation context preserved.
- The registration page pre-fills or locks the invited email so the invitation
  cannot be claimed by registering a different email.

### Accepting Existing-User Invitations

- Accepting a valid pending invitation for an existing user creates a
  `workspace_users` row with role `member` for the invited workspace and user.
- The invitation status changes to `accepted` and the code can no longer be
  used.
- If the invited user is already a workspace member by the time the code is
  accepted, the invitation is marked accepted without creating a duplicate
  membership.
- Accepting an invitation does not grant an auth session by itself.
- If the browser already has a valid session for the invited user, the
  invitation can be accepted from the prompt and the workspace list reflects the
  new membership on reload.
- If the browser has no valid session, the user is sent to login before the
  invitation can be accepted.
- If the browser is authenticated as a different user than the invitation email,
  the acceptance is rejected and no membership changes are made.
- If the invitation expires before acceptance, the existing user remains outside
  the workspace until an authorized inviter sends a new invitation and the new
  code is accepted.

### Accepting Unregistered Invitations During Registration

- Registration accepts an invitation code context when the user arrives from a
  valid unregistered invitation link.
- The registration email must match the invitation email after normalization.
- Registration still requires nickname, password, confirmation password, and a
  valid registration CAPTCHA.
- Registration still creates a non-activated user, logs an activation link, and
  returns the normal authenticated non-activated session payload.
- In the same successful registration transaction, the app creates a
  `workspace_users` row with role `member` for each valid pending invitation
  claimed by that invitation code and marks the invitation accepted.
- After registration, `/overview` may show the invited workspace in the
  workspace list even though the user is non-activated.
- Read-only workspace and service availability data for the invited membership
  are visible immediately after registration even though the user is
  non-activated.
- Protected mutations remain blocked until the user activates the account,
  including claiming, extending, releasing, creating workspaces, inviting users,
  changing workspace users, and resource administration.
- Browser controls for non-activated invited users are read-only: action
  buttons and forms that would mutate workspace state are hidden or disabled
  while the activation banner remains visible.
- After account activation, the same user can perform member-allowed actions in
  the invited workspace.

### User-Management Invitation Status

- The workspace user-management page shows both accepted workspace users and
  invitation rows for the selected workspace.
- Because managers can create invitations, managers can view invitation rows and
  reinvite expired invitations for their workspaces.
- Role changes and membership removal remain admin-only and apply only to
  accepted workspace users.
- Pending invitation rows always show the invited email address and invitation
  status.
- For an invited email that already belongs to a user account, a pending
  invitation row shows only the email and a status equivalent to
  `Invitation pending acceptance`.
- Once that existing user accepts the invitation, the row becomes a normal
  workspace user row and shows the rest of the user data and role controls
  available under the actor's authorization.
- For an invited email that does not yet belong to a user account, a pending
  invitation row shows only the email and a status equivalent to
  `Invitation pending acceptance`.
- Once the invited person creates an account through the invitation link, the row
  becomes a workspace user row showing the user data and role `member`, with a
  warning flag equivalent to `Account not activated`.
- Once that account is activated, the warning flag is removed.
- Expired invitation rows show the invited email and a status equivalent to
  `Invitation expired`.
- Expired invitation rows offer a reinvite action to workspace admins and
  managers.
- Reinviting an expired invitation creates a new pending invitation for the same
  workspace and normalized email, logs a new link, and changes the row status
  back to pending invitation.
- Reinviting the same expired email from the workspace-management invite modal
  has the same backend behavior and user-management status transition as the
  expired-row reinvite action.
- Used or accepted invitation codes remain unusable even when the user row is
  later removed from the workspace.

### Administration Visibility And Role Editing

- Workspace members must not see administration controls for workspaces where
  their role is only `member`.
- A user's `member` role on an invited workspace must not hide the
  administration page or administration button when the same user is `admin` or
  `manager` in at least one other workspace.
- Direct browser navigation to `/administration` by a user with no admin or
  manager workspace must not reveal administration controls.
- Members still keep access to member-allowed overview and service availability
  workflows for workspaces where they have membership.
- Administration workspace selectors may include only workspaces where the
  current user has the role required for the selected administration section.
- Workspace user role editing remains admin-only for accepted workspace users.
- The browser role selector must not offer `admin` as a target role because the
  backend rejects adding a second workspace admin. Existing admins remain
  visible as `admin`, but other users can be changed only to `manager` or
  `member`.
- Server-side authorization remains authoritative; hiding the administration
  entry point is advisory browser UX only.

### Authorization And Errors

- Invitation creation uses resource-administration authorization:
  `admin` and `manager` are allowed, `member` is denied.
- Workspace user administration endpoints for listing users, changing roles,
  and removing memberships remain admin-only.
- Invitation-status reads and expired-invitation reinvites are allowed for
  workspace admins and managers.
- Workspace user role update requests that attempt to promote a non-admin user
  to `admin` continue to return a deterministic conflict.
- Non-activated invited users can read workspace list and service availability
  data for their member workspaces, but mutation endpoints continue to return
  deterministic `403` responses after authentication succeeds.
- Invalid invitation codes return deterministic invalid-invitation errors.
- Expired invitation codes return deterministic expired-invitation errors.
- Missing workspaces return `404`.
- Unauthorized invitation creation returns `403`.
- Duplicate pending invitations and already-member invitees return `409`.
- Malformed or missing invitation emails return `400`.

## Assumptions

- The existing invite modal remains the source for creating invitations; it may
  update success copy to say that the invitation link was logged server-side.
- The existing registration and activation flow stays intact except for carrying
  and consuming invitation context.
- Read-only workspace and service availability endpoints can be separated from
  mutation endpoints cleanly enough to allow non-activated invited users to see
  data without enabling actions.
- Invitation expiry is evaluated at read/acceptance time; a separate cleanup job
  is not required for the browser to show expired status.

## 2026-07-01 Iteration: Invitation Handoff And Member Access Fixes

### Requested Delta

- Existing-user invitation links must require the invited user to log in before
  acceptance when no matching session is active.
- After login started from an invitation link, the invitation prompt must
  reappear so the invited user can accept the invitation.
- Invitation prompts must appear only after the invitation link has been
  opened; normal login must not open stale invitation prompts.
- Newly registered invitees whose accounts are not activated must still see
  their invited workspace data, while all actions stay blocked until
  activation.
- Administration must remain available for workspaces where the current user is
  `admin` or `manager`, even if that user is only `member` in an invited
  workspace.
- User administration must remove the `admin` promotion option because admins
  cannot make another admin under the single-admin invariant.

### Preserved Behavior

- Accepted invitations still grant exactly `member` access.
- Real email delivery remains out of scope.
- Raw invitation codes and links remain out of API responses.
- Managers can invite and reinvite but cannot remove users or change roles.
- Server-side authorization remains authoritative for all reads and mutations.
- Existing admin users remain visible as `admin`; the change removes only the
  promotion option from the role-editing control.

## Regression Impact

- Workspace role semantics change narrowly: managers gain invitation creation
  and invitation-status/reinvite access, while role and membership user
  administration remains admin-only.
- Browser administration navigation must be role-aware per workspace: member
  access on one workspace cannot suppress admin/manager administration for
  another workspace.
- Browser login and invitation pages must preserve invitation context only for
  a login that was explicitly started from an invitation link.
- Non-activated invited users gain read-only visibility into workspace and
  service availability data; mutation and administration endpoints remain
  activation-gated.
- The `workspace_invitations` persistence model must support email-address
  invitations without an existing user ID, hashed codes, expiry timestamps, and
  accepted/used timestamps.
- Registration becomes responsible for atomically creating the user,
  activation token, and claimed workspace membership when an invite code is
  present.
- The workspace user-management API response must include invitation rows and
  account activation warning metadata in addition to accepted workspace users.
- API documentation and HTTP examples must stop describing invitations as
  existing-user-only.
- Existing activation, password reset, and registration behavior must keep their
  current response shapes and no-link-in-response contract.

## Validation Plan

- Unit tests for invitation creation by admin, manager, member, duplicate
  pending email, existing workspace member, existing user, and unregistered
  email.
- Unit tests for validating and accepting invitation codes, including invalid,
  used, expired, existing-user, already-member, and
  wrong-authenticated-user cases.
- Unit tests for invitation expiry configuration from `config/app.yml`, env var
  override, default `86400`, and invalid values.
- Unit tests for workspace user-management rows covering accepted users, pending
  existing-user invites, pending unregistered invites, expired invites,
  reinvite transitions, and non-activated warning flags.
- Browser controller tests for hiding the administration entry point from
  users with only member workspaces, preserving the administration entry point
  for users who are admin/manager in another workspace, and preventing member
  workspaces from appearing in resource/user administration controls.
- Registration controller tests for valid invite context, email mismatch,
  invalid invite code, transaction rollback, membership creation, and activation
  link logging.
- Browser service/controller tests for invitation link handling, registration
  email locking or preservation, post-login invitation return, invitation status
  rows, reinvite action, removal of the `admin` role option, and no
  Authorization header on unauthenticated invitation validation where
  applicable.
- Authorization/controller tests for non-activated invited users reading
  workspace and service availability data while receiving `403` from mutation
  endpoints.
- API documentation validation for `swagger.yml` and updated `http/*.http`
  examples.
- Project validation: `npm run lint`, `npm run build`, `npm test`, and
  `git diff --check`.

## Documentation Needs

- Update `swagger.yml` for changed invitation creation authorization and
  response shape, invitation validation/acceptance endpoints, and registration
  invite context.
- Update `swagger.yml` for non-activated invited-user read-only access and for
  the continued conflict on attempted `admin` promotion.
- Update `swagger.yml` for the expanded workspace user-management response that
  includes invitation status rows and activation warning metadata.
- Update HTTP examples for inviting existing and unregistered users and
  accepting/claiming invitation links, login handoff expectations, read-only
  non-activated invited access, plus reinviting expired invitations.
- Update `AGENTS.md` configuration guidance if implementation adds
  `workspace_invitation_expires_in_seconds` and
  `WORKSPACE_INVITATION_EXPIRES_IN_SECONDS`.
- Update `AGENTS.md` authorization guidance because this iteration intentionally
  changes the prior rule that non-activated users cannot access protected app
  data.
- No README update is required unless implementation changes local startup or
  operational configuration.

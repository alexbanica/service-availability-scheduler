# Self-Service Account Deletion

Status: Approved

## Purpose

Allow an authenticated user to permanently delete their own account and the
application data attributable to that account, subject to an explicit typed
confirmation and safeguards for workspaces shared with other users.

## Problem

The application has no self-service account-deletion workflow. A signed-in user
cannot remove their identity, authentication data, memberships, reservations,
or other personal records. Directly deleting a user row is also unsafe because
multiple tables reference users and a workspace creator is stored as the
workspace's owner through `admin_user_id`.

Account deletion must therefore be explicit, transactional, privacy-oriented,
and prevented from deleting workspace data that is still shared with other
members.

## Scope

- Add a self-service account-deletion action for the currently authenticated
  user.
- Make the action available to authenticated users regardless of activation
  state.
- Require the user to confirm deletion by entering the email address of the
  signed-in account.
- Add an authenticated API contract for deleting the current account.
- Permanently delete the user's account and attributable application data.
- Delete workspaces owned by the user only when no other workspace members
  remain.
- Reject deletion when any workspace owned by the user still has another
  member, and display a specific explanation to the user.
- Invalidate all bearer-token access for the deleted account immediately after
  deletion.
- Update API documentation, request examples, user documentation, and durable
  repository guidance affected by the behavior.

## Out Of Scope

- Transferring workspace ownership to another user.
- Automatically promoting another workspace member or choosing a successor.
- Allowing an administrator to delete another user's account.
- Recovering a deleted account or retaining a soft-deleted account record.
- Deleting or modifying the user's Google account.
- Recalling email that has already been delivered or deleting data retained by
  Google, OneSignal, mail providers, browser history, backups, or infrastructure
  logs outside the application's database.
- Changing the existing workspace-member removal, role-change, or resource
  deletion contracts.

## Definitions

- **Current user**: the user identified by a valid application bearer token and
  confirmed to still exist in the application database.
- **Owned workspace**: a workspace whose `admin_user_id` equals the current
  user's ID.
- **Other member**: a `workspace_users` row for an owned workspace whose user ID
  differs from the current user's ID.
- **Shared workspace**: a workspace not owned by the current user where the
  current user has a membership, or an owned workspace that still has another
  member.
- **Attributable application data**: local database rows that identify the user
  by user ID or normalized email, plus data belonging to a deletable owned
  workspace.
- **Normalized email**: an email value after trimming surrounding whitespace and
  converting it to lowercase.

## User Experience

### Entry Point

- The authenticated application header exposes a `Delete account` action near
  the existing signed-in identity and logout controls.
- The action remains available to authenticated users whose accounts are not
  activated.
- The action uses destructive styling but performs no mutation when first
  selected.

### Confirmation Dialog

- Selecting `Delete account` opens a modal dialog.
- The dialog states that deletion is permanent and describes the categories of
  account data that will be removed.
- The dialog warns that an owned workspace can be deleted only when the user is
  its only remaining member.
- The dialog displays the current account email and requires the user to enter
  that email in a confirmation field.
- Confirmation comparison uses normalized email values.
- The destructive submit action is disabled until the normalized confirmation
  value matches the normalized current account email.
- Canceling or closing the dialog performs no mutation and clears any entered
  confirmation value and prior error.
- While a request is pending, duplicate submission and dialog dismissal are
  disabled and the submit label communicates progress.

### Failed Deletion

- A failed request keeps the confirmation dialog open and preserves the signed-in
  session.
- When the API returns the owned-workspace conflict, the dialog displays this
  exact message:

  `Account cannot be deleted because one or more workspaces you own still have other members. Remove those members before deleting your account.`

- The same error may also be shown through the application's existing transient
  error notification, but the persistent dialog message is required.
- Validation and unexpected API errors are displayed in the dialog and do not
  clear authentication or user-scoped browser state.

### Successful Deletion

- A successful response clears the application bearer token and its expiry.
- User-scoped workspace selections and service filters stored by the browser are
  cleared. The theme preference may remain because it does not identify an
  account.
- The browser redirects to `/login` and must not continue protected fetching,
  token renewal, event subscription, or auto-refresh work.

## API Contract

### Request

- Method and path: `DELETE /api/users/me`
- Authentication: valid application bearer token is required.
- Activation: account activation is not required.
- Content type: `application/json`.
- Required request body:

  ```json
  {
    "confirmation_email": "current-user@example.com"
  }
  ```

- The request body must be a JSON object containing exactly the
  `confirmation_email` field.
- `confirmation_email` must be a string whose normalized value exactly matches
  the current database user's normalized email.

### Responses

- `204 No Content`: the account and all in-scope data were deleted. The response
  has no body.
- `400 Bad Request`: the body is absent, malformed, contains missing or unknown
  fields, has a non-string confirmation value, or the normalized confirmation
  email does not match the current account.
- `401 Unauthorized`: the bearer token is absent or invalid, or the token refers
  to a user that no longer exists.
- `409 Conflict`: at least one owned workspace has another member. The response
  is:

  ```json
  {
    "error": "Account cannot be deleted because one or more workspaces you own still have other members. Remove those members before deleting your account."
  }
  ```

- `500 Internal Server Error`: deletion could not be completed atomically. No
  partial deletion is treated as success.

## Deterministic Deletion Behavior

1. Authentication resolves the current database user. A signed token whose user
   no longer exists is rejected with `401` before controller behavior runs.
2. The confirmation request is validated against the current database email,
   not only the email claim contained in the JWT.
3. The application checks every workspace whose `admin_user_id` is the current
   user. If any such workspace has another member, deletion stops with the
   specified `409` response and no row is deleted or modified.
4. The conflict check and all deletion mutations behave as one atomic operation.
   A concurrent membership change cannot produce a successful partial deletion
   or permit deletion of a workspace that has another member at the decisive
   point of the operation.
5. For each owned workspace where the current user is the only remaining member,
   delete the workspace and its complete local data, including:
   - reservations tied to the workspace's service-environment keys;
   - service-environment associations;
   - services;
   - owners;
   - environments;
   - workspace invitations;
   - workspace memberships; and
   - the workspace row.
6. Preserve workspace definitions and resources for workspaces not owned by the
   current user. Remove only the deleting user's membership and other
   attributable records from those workspaces.
7. Delete all reservations whose `user_id` is the current user, including active,
   released, and expired reservation history. An active reservation deleted by
   this operation no longer keeps its service claimed.
8. Delete all workspace invitations where the current user is the inviter, the
   linked invitee, or the normalized invited email matches the current user's
   normalized email. This includes pending, accepted, expired, and revoked
   invitation rows.
9. Delete all local email jobs where `user_id` is the current user or the
   normalized recipient email matches the current user's normalized email,
   regardless of job status. A provider request already in flight or a message
   already delivered cannot be recalled by this operation.
10. Delete all password-reset tokens, account-activation tokens, platform roles,
    and workspace memberships belonging to the current user.
11. Delete the user row last, after all dependent local records and deletable
    owned workspaces have been removed.
12. Any failure rolls back the entire deletion. The account remains usable and
    the API returns an error.
13. After commit, the same user ID no longer authenticates on any protected API,
    including `/api/me` and `/api/renew`, even when a previously issued JWT has
    not reached its expiry.
14. Re-registering the same email later creates a distinct account identity and
    does not restore deleted memberships, roles, reservations, invitations,
    workspaces, or other deleted data.

## Security And Privacy Constraints

- The target user ID always comes from authenticated server-side identity; the
  client cannot submit a target user ID.
- Confirmation is enforced by the server as well as by the browser.
- Confirmation by email is an explicit destructive-action safeguard, not a
  substitute for bearer authentication.
- Password re-entry is not required, so password and Google-authenticated users
  use the same deletion contract.
- Error responses must not expose records belonging to other users or enumerate
  workspace member identities.
- Logs must not contain password hashes, token hashes, bearer tokens, or the
  confirmation request body.
- Existing authentication must require both a valid JWT and an existing user so
  deletion cannot leave renewable stateless sessions behind.

## Assumptions

- The current unique-email constraint allows normalized email matching to
  identify local invitation and email-job records attributable to the current
  account at deletion time.
- A workspace with no member other than its owner is treated as owned solely by
  that user and can be deleted with the account.
- Users who own shared workspaces can satisfy the prerequisite using existing
  workspace-user removal controls; ownership transfer is not introduced here.
- Application database backups and infrastructure retention are governed by
  operational policy outside this feature.

## Regression Impact

- Password login, Google login, registration, activation, reset, logout, and
  normal token renewal retain their existing successful contracts.
- Existing valid users remain authenticated as before; only tokens referencing a
  missing user gain deterministic `401` behavior.
- Non-activated users remain blocked from protected application data and
  mutations, with self-account deletion added as an explicit allowed account
  action.
- Workspace role, membership, and single-admin rules remain unchanged outside
  the account-deletion transaction.
- Existing resource delete and member remove confirmations remain unchanged.
- Shared workspace services, owners, environments, and memberships belonging to
  other users remain intact.
- Deleted active reservations disappear from service availability, and normal
  refresh or event behavior must not continue under the deleted session.

## Validation Plan

- Verify API authentication, request-body validation, confirmation matching, and
  exact response status/error contracts.
- Verify activated and non-activated authenticated users can request deletion.
- Verify a missing user referenced by an otherwise valid JWT receives `401` and
  cannot call `/api/me`, renew a token, or use another protected endpoint.
- Verify owned workspaces with other members return the exact `409` response and
  leave every related row unchanged.
- Verify owned workspaces with only the current user are deleted with their
  services, associations, owners, environments, invitations, memberships, and
  related reservation rows.
- Verify shared workspace resources remain while the current user's membership,
  reservations, and attributable invitations are removed.
- Verify all user roles, reset tokens, activation tokens, and matching local
  email jobs are deleted.
- Verify a forced mid-operation database failure rolls back all mutations.
- Verify the browser requires typed email confirmation, prevents duplicate
  submission, persists the `409` explanation in the dialog, preserves the
  session on failure, and clears user-scoped state and redirects on success.
- Run focused server and browser TypeScript tests, lint, formatting checks, both
  TypeScript builds, the full automated test suite, and `git diff --check` during
  implementation validation.

## Documentation Needs

- Document `DELETE /api/users/me`, its request schema, authentication behavior,
  `204`, `400`, `401`, `409`, and `500` responses in `swagger.yml`.
- Add an authenticated account-deletion example under the repository's HTTP
  examples.
- Update user-facing documentation to describe typed confirmation, the shared
  owned-workspace blocker, deleted data categories, immediate logout, and the
  external-data limitations.
- Update durable repository guidance so self-account deletion is listed among
  the authenticated actions available before activation and its shared-workspace
  invariant remains explicit.

## Acceptance Criteria

- A signed-in user can discover and open the account-deletion confirmation from
  the authenticated header.
- No delete request is sent before the user enters their matching account email
  and explicitly submits the destructive action.
- Server validation independently rejects missing, malformed, unknown, or
  mismatched confirmation input.
- An account owning a workspace with another member receives `409`, sees the
  required explanatory message in the dialog, remains signed in, and loses no
  data.
- A deletable account is removed atomically with all data defined as in scope.
- A solely owned workspace is fully removed; shared workspace resources are
  preserved.
- Successful deletion returns `204`, clears local account state, and redirects
  to `/login`.
- Every previously issued JWT for the deleted user is rejected immediately and
  cannot be renewed.
- API contracts, examples, documentation, deterministic automated tests, and
  required repository validation are aligned with the delivered behavior.

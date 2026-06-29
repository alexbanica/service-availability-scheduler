# Website Registration And Account Activation

Status: Approved

## Purpose

Allow new users to register from the website, verify the registration with the
existing captcha challenge, and activate their account through a temporary
server-logged activation link until email delivery is implemented.

## Problem Statement

The application currently supports password login and password reset for users
that already exist in the database. A new user cannot self-register, and there
is no account activation gate before giving a self-registered user the
`platform_admin` role needed to create workspaces and manage services.

## Scope

- Add website registration for unauthenticated users.
- Reuse the existing captcha challenge mechanism for registration.
- Record the minimum account information needed for login and later activation.
- Create a one-time activation link after successful registration.
- Log the activation link server-side using the same temporary approach as
  password reset links, including a TODO to replace logging with email delivery.
- Let registered users log in before activation.
- Restrict non-activated users from protected app actions that require account
  activation.
- Show a banner in the authenticated app informing non-activated users that
  their account must be activated before they can use the app.
- Grant `platform_admin` automatically when the activation link is consumed.

## Out Of Scope

- Sending real activation emails.
- Email verification beyond consuming the activation link.
- Changing password reset behavior except where shared captcha/token patterns
  are reused.
- Third-party captcha integration.
- Multi-role administration beyond the existing `platform_admin` role.
- Manual admin approval for registrations.
- Public workspace browsing for non-activated users.

## Definitions

- Website registration: an unauthenticated browser flow where a visitor submits
  account details and a captcha answer to create a user record.
- Minimum account information: email, nickname, password, and password
  confirmation.
- Activated account: a user whose activation link has been successfully
  consumed.
- Activation link: a single-use URL containing an opaque token. The URL is
  temporarily written to server logs and is not returned in API responses.
- Admin role: the existing `platform_admin` role in `user_roles`, which is
  required to create workspaces.
- Non-activated user: a registered user without completed account activation.

## Inputs And Constraints

- Registration must accept:
  - `email`
  - `nickname`
  - `password`
  - `confirm_password`
  - captcha challenge id
  - captcha answer
- Email must be trimmed, lowercased, required, and unique.
- Nickname must be trimmed and required.
- Password must use the existing password policy: minimum 8 characters, with no
  additional complexity requirement.
- Password confirmation must be required and must match the password.
- Captcha challenge creation must reuse the existing captcha service behavior:
  generated challenge id, generated prompt, 5 minute expiry, one successful use.
- Registration must not create `platform_admin`.
- Activation token lifetime must use the existing password reset token lifetime
  configuration unless a future spec introduces a separate activation-token
  lifetime.
- Activation links must not be returned from registration API responses.
- Token values must be stored hashed, not in plaintext.
- A user may have only one active activation token; issuing a new activation
  token for the same user invalidates prior active activation tokens.

## Deterministic Behavior

### Registration Captcha

- An unauthenticated endpoint returns a captcha challenge for registration.
- The response includes only the challenge id and prompt.
- The response never includes the captcha answer.

### Registration Submission

- Registration validates required email, nickname, password, password
  confirmation, captcha challenge id, and captcha answer.
- Missing required fields return `400` with a deterministic error message.
- Invalid captcha returns `400`.
- Short passwords return `400`.
- Mismatched password confirmation returns `400`.
- Duplicate email returns `409`.
- Successful registration:
  - creates a user with normalized email, trimmed nickname, and hashed password;
  - leaves the account non-activated;
  - creates an activation token;
  - logs the activation URL server-side with a TODO to replace logging with email
    delivery;
  - returns generic success without returning the activation URL or token.

### Login And Identity

- Registered users with a valid password can log in before activation.
- Login response and `/api/me` must expose whether the account is activated.
- Authenticated browser state must retain enough user identity to render the
  activation banner deterministically after page load or token renewal.

### Non-Activated Restrictions

- Non-activated users remain authenticated but cannot perform app actions.
- Non-activated users may call only:
  - auth/session endpoints needed to remain logged in or log out;
  - `/api/me`;
  - activation-token validation or activation endpoints;
  - app-info endpoint;
  - static assets and page routes needed to display the authenticated app.
- Protected data and mutation endpoints for services, reservations, workspaces,
  owners, environments, invitations, and workspace users return `403` for
  non-activated users.
- The app must not rely only on hidden frontend controls for enforcement; the
  server must enforce activation restrictions.

### Activation

- The activation URL loads a browser page or route where the token can be
  consumed.
- Invalid, expired, used, or invalidated activation tokens produce a
  deterministic failure state and do not grant roles.
- Successful activation:
  - marks the user as activated;
  - consumes the activation token;
  - grants the user the existing `platform_admin` role;
  - is idempotent for an already activated user only when the token is still
    valid and belongs to that user; otherwise invalid token behavior applies.
- After activation, the user can access normal authenticated app behavior and
  create workspaces subject to existing workspace limits.

### Activation Banner

- A logged-in non-activated user sees a prominent banner in the authenticated
  app stating that the account must be activated first.
- The banner must be visible on the main app shell before the user attempts an
  admin or service action.
- Activated users do not see the banner.
- The banner copy must not claim that an email was sent while email delivery is
  not implemented.

## Assumptions

- The existing `platform_admin` role is the role meant by "admin role".
- Registration is added to the existing login page rather than a separate public
  landing page unless implementation discovers that a dedicated registration
  page is simpler while preserving the same behavior.
- "Every action will be restricted" means protected app data and mutation
  endpoints are blocked for non-activated users, while endpoints needed to log
  in, stay logged in, log out, display the app, and activate the account remain
  available.
- The activation link format follows the existing reset-password URL style, for
  example `/activate-account/<token>`.

## Impact And Regression Considerations

- User schema must represent activation state for existing and new users.
- Existing seeded or previously created users must remain usable after the
  migration path. Existing users should be treated as activated unless a future
  migration spec explicitly requires reactivation.
- Role assignment must remain transactionally consistent with activation.
- Registration token storage should follow the password reset token lifecycle
  pattern without weakening reset-token behavior.
- Auth middleware and API client unauthenticated-route allowlists must be kept in
  sync with the new registration and activation endpoints.
- Existing password login, password reset, JWT renewal, service availability,
  workspace administration, and reservation flows must continue to pass their
  current tests.

## Validation Plan

- Unit-test registration captcha response does not expose the answer.
- Unit-test registration validation failures for missing fields, invalid captcha,
  duplicate email, short password, and mismatched confirmation.
- Unit-test successful registration stores a hashed password, creates an
  activation token, logs the activation URL, and omits the URL/token from the
  response.
- Unit-test login and `/api/me` expose activation state.
- Unit-test non-activated users receive `403` from protected app data and
  mutation endpoints while allowed auth/app/activation endpoints remain usable.
- Unit-test activation token validation outcomes for valid, invalid, expired,
  used, and invalidated tokens.
- Unit-test successful activation marks the account activated and grants
  `platform_admin`.
- Unit-test browser services treat registration and activation endpoints as
  unauthenticated where required.
- Unit-test the app controller/banner state for non-activated versus activated
  users.
- Integration-test schema and migration behavior for activation fields and token
  storage.
- Run repository validation: `npm run lint`, `npm run build`, `npm test`, and
  `git diff --check`.

## Documentation Requirements

- Update the README authentication API contract with registration, activation,
  activation logging, and activation-gated authorization behavior.
- Document any new config key only if implementation introduces one. Under this
  spec, activation token expiry reuses the existing password reset token expiry
  configuration and needs no new config documentation.

# Workspace Invitation Direct Handoff

Status: Approved

## Purpose

Make existing-user workspace invitation links complete without showing the
intermediate invitation page or a manual "Log in first" button when the browser
can continue deterministically.

## Requested Behavior

- When an invited existing user opens a valid invitation link while already
  authenticated as that user, the browser accepts the invitation and redirects
  directly to `/overview`.
- When the browser is already authenticated as a different user than the
  invitation email, the invitation is not accepted and the browser shows a
  deterministic account-mismatch message.
- When the browser is already authenticated and opens an invitation for an email
  that has no platform account yet, the invitation is not accepted and the
  create-account path is hidden with the same deterministic account-mismatch
  message.
- The dashboard reloads workspace and service data after acceptance.
- The dashboard shows a confirmation toast that the user joined the invited
  workspace.
- When an invited existing user opens a valid invitation link without an active
  session, the browser sends them directly to `/login`.
- After successful login from that invitation handoff, the browser accepts the
  invitation, redirects to `/overview`, reloads dashboard data, and shows the
  joined-workspace toast.

## Scope

- Browser invitation-link routing.
- Browser login invitation handoff.
- Authenticated app-shell pending invitation consumption and dashboard refresh.

## Out Of Scope

- API endpoint changes.
- Invitation persistence changes.
- Invitation email delivery.
- Registration behavior for unregistered invitees.
- Backend authorization changes.

## Deterministic Behavior Delivered

- The invitation page validates the code as before.
- For valid existing-user invitations:
  - authenticated browsers call the authenticated acceptance endpoint, store
    the joined workspace id, and redirect to `/overview`;
  - unauthenticated browsers store the invitation code for login handoff and
    redirect to `/login?invitation_handoff=1`.
- Login started by invitation handoff stores the code as a pending dashboard
  acceptance and redirects to `/overview` after token storage succeeds.
- The app shell consumes the pending code once, validates it to learn the
  workspace id, accepts it with the authenticated session, reloads workspace
  and service data, and shows `You've joined <workspace>.`
- Before browser-side acceptance from the invitation page or pending dashboard
  handoff, the current authenticated email is normalized and compared with the
  invitation email; mismatches show `This invitation belongs to another
  account.` and do not call the accept endpoint.
- Authenticated browsers viewing an unregistered invitation also show `This
  invitation belongs to another account.` and do not show the invited account
  registration action.
- If the browser has stale or unusable token state but `/api/me` does not load a
  current user, the invitation page treats the browser as unauthenticated and
  keeps the normal invitation action available for the invitation status.
- Pending handoff state is cleared after consumption so stale codes do not
  retry on later dashboard loads.
- Acceptance failures are shown as dashboard or invitation-page toasts/errors
  and do not silently mutate unrelated state.

## Assumptions

- A valid existing-user invitation belongs to the currently authenticated user
  when the authenticated acceptance endpoint succeeds.
- The current workspace list after acceptance is the source for the display
  name in the joined-workspace toast.

## Impact

- Existing invitation pages become transitional for existing-user invitees.
- Unregistered invitation behavior remains unchanged.
- API contracts and HTTP examples are unaffected because no endpoint, request,
  response, status code, or auth rule changed.

## Validation Performed

- `npx tsc -p tsconfig.client.json --noEmit`
- `node -r ts-node/register --test --test-name-pattern "invitation handoff" src/tests/unit/browser-auth-services.test.ts`
- `node -r ts-node/register --test --test-name-pattern "unregistered invitation" src/tests/unit/browser-auth-services.test.ts`
- `git diff --check`

## Validation Skipped

- Full `npm run build`, `npm run lint`, and `npm test` were skipped because
  `$super-agent` limits validation to short commands.
- Direct `node --test src/tests/unit/browser-auth-services.test.ts` was not a
  valid validation path because repo TypeScript tests require
  `-r ts-node/register`.
- The full browser auth unit file was not used as final validation because an
  unrelated existing workspace role-editor assertion still fails in the dirty
  worktree.
- Browser manual QA was skipped by `$super-agent` workflow.

## Documentation Changes

- Added this completed-work spec and matching plan.

# Workspace User Compact Cards

Status: Approved

## Purpose

Make workspace user-management rows smaller so user cards and actions fit better
inside the administration environment.

## Requested Behavior

Workspace user cards should be more compact and their action buttons should be
smaller. User-management cards should show the email plus an account status tag
when applicable and should not expose accepted users' member IDs.

## Scope

- Compact user rows in the User management administration view.
- Normalize standard website button sizing and alignment with shared CSS
  variables while keeping user row actions compact.
- Remove the user/member ID line from the card identity area.
- Replace the activation warning icon and invitation status text with compact
  status tags for not activated, pending invite, and invite expired.
- Preserve existing role change, reinvite, remove, pending, expired, and
  account-status behavior.

## Out Of Scope

- Workspace overview cards.
- Workspace detail popup behavior.
- Backend workspace user APIs.
- Workspace membership authorization.
- API contract documentation, because no API behavior changed.

## Deterministic Behavior Delivered

- User-management rows use a user-specific compact card class.
- User cards display the user's email in the identity area, with a compact
  status tag when the account is not activated, the invite is pending, or the
  invite is expired.
- User cards do not print the user/member ID.
- Role selector, Reinvite, and Remove buttons inside user cards use smaller
  shared sizing, padding, text sizing, and tighter spacing.
- On narrow screens, compact user action controls wrap naturally without being
  forced into oversized full-width buttons.
- Workspace overview cards continue to display workspace IDs and retain their
  existing card sizing.

## Assumptions

- "Users cards" refers to the User management workspace-user rows, not the
  workspace overview cards.
- "Member ID" refers to the accepted user's `userId` displayed in user cards.
- Invitation and membership API payloads are unchanged; this is presentation
  only.

## Impact

- UI-only change.
- No backend behavior changes.
- No API contract changes.
- No database changes.
- Standard text buttons now share common size tokens across the website.

## Validation Performed

- `git diff --check`

## Validation Skipped

- `npm run lint`
- `npm run build`
- `npm test`
- Browser/manual QA

These were skipped because `$super-agent` limits validation to short checks.

## Documentation Changes

- Added this completed-work spec.

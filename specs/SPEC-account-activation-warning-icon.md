# Account Activation Warning Icon

Status: Approved

## Purpose

Workspace user-management rows showed the text `Account not activated` as a
separate muted line. The delivered change replaces that text with a compact
yellow warning symbol placed directly after the user's email.

## Requested Behavior

- Accepted workspace users whose account is not activated show a yellow warning
  symbol after their email address.
- The visible text `Account not activated` is no longer shown in the row.
- Hovering the warning symbol exposes a tooltip saying the account is not yet
  activated.
- Invitation rows and activated user rows do not show the warning symbol.

## Scope

- Updated the workspace user-management row markup in `public/index.html`.
- Added warning-symbol styling in `public/styles.css`.
- Added completed-work artifacts under `specs/`.

## Out Of Scope

- Backend activation semantics.
- Workspace invitation behavior.
- API contracts, Swagger, and HTTP examples.
- Generated browser JavaScript bundles.

## Assumptions

- The existing condition `workspaceUser.activated === false &&
  !workspaceUser.invitationId` remains the correct frontend signal for accepted
  non-activated workspace users.
- A native `title` tooltip is sufficient for the requested hover behavior.

## Deterministic Behavior Delivered

- The warning symbol is rendered inline inside the email identity line.
- The symbol uses `title` and `aria-label` text:
  `Account is not yet activated`.
- The symbol is keyboard-focusable so the same accessible label is available
  without relying only on pointer hover.
- The previous separate `Account not activated` text node was removed.

## Impact

- UI-only behavior change.
- No API, persistence, schema, authorization, or activation flow behavior was
  changed.

## Validation Performed

- `git diff --check`

## Validation Skipped

- `npm run build`, `npm run lint`, and `npm test` were skipped because
  `$super-agent` limits validation to commands expected to complete within
  about 10 seconds.
- Manual browser QA was skipped by `$super-agent` workflow.
- Code review was skipped by `$super-agent` workflow.

## Documentation Changes

- Added this completed-work spec.

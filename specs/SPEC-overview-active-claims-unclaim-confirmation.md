# SPEC: Overview Active Claims Unclaim Confirmation

Status: Approved

## Purpose

Make the Overview `Your active claims` card show each active claim's workspace and require explicit confirmation before a user unclaims a claim from that card.

## Problem Statement

The Overview `Your active claims` card currently lists claimed service and environment names without workspace context. It also does not provide a direct, confirmation-protected unclaim flow from the Overview card, so users must navigate elsewhere to release a claim and can lack enough context when services or environments have similar names across workspaces.

## Scope

- Update the Overview `Your active claims` list so every listed claim displays the workspace name.
- Make each active-claim row in the Overview card clickable or otherwise directly activatable.
- When a user activates an Overview active claim, open an in-page confirmation popup asking whether the user wants to unclaim that claim.
- If the user confirms, unclaim the claim by using the existing release behavior for that claim's `serviceKey`.
- If the user cancels or closes the popup, do not unclaim the claim and do not call the release API.
- Preserve existing Overview counts, active-claim selection, claim ownership filtering, service availability behavior, release behavior outside Overview, backend APIs, and reservation persistence semantics.

## Out Of Scope

- Changing backend reservation, release, claim, extend, workspace, or service APIs.
- Changing who may release claims.
- Adding unclaim confirmation to Service Availability release buttons.
- Changing the existing Service Availability `Release` button behavior.
- Changing claim expiration, extension, or team-claim semantics.
- Changing which claims appear in `Your active claims`.
- Replacing or redesigning unrelated modals.

## Definitions

- `Overview active claim`: An item in the Overview `Your active claims` card derived from `claimedByUser`.
- `Workspace name`: The existing `service.workspaceName` value associated with the claimed service.
- `Unclaim`: The user-facing label for releasing an Overview active claim through the existing reservation release flow.
- `Unclaim confirmation popup`: A blocking in-page confirmation dialog shown after activating an Overview active claim and before calling the release API.

## Inputs And Constraints

- The browser UI is implemented with Vue markup in `public/index.html` and state/handlers in `public/ts/controllers/AppController.ts`.
- The active-claim data already contains `{ service, environment }`; `service.workspaceName` is available without a backend contract change.
- The existing release API is exposed to the browser through `ReservationService.release(serviceKey)`.
- Generated `public/js` bundles must not be edited directly.
- The UI must remain keyboard reachable and must not introduce mobile horizontal overflow or overlapping text.

## Deterministic Behavior

### Active Claim Display

- When `claimedByUser.length > 0`, every Overview active-claim row displays:
  - service label
  - environment name
  - workspace name
- The workspace name is shown with an explicit `Workspace:` label.
- The existing `claimedByUser.length` count remains based on the number of environments claimed by the current user.
- The existing empty state `No active claims right now.` remains unchanged when there are no active claims.

### Overview Unclaim Confirmation

- Activating an Overview active-claim row opens an unclaim confirmation popup.
- Opening the popup does not call `ReservationService.release`.
- The popup identifies the target claim using the service label, environment name, and workspace name available in the row state.
- The popup asks the user whether they want to unclaim the selected claim.
- The popup provides explicit cancel/no and confirm/yes choices.
- Canceling or closing the popup:
  - closes the popup
  - clears pending unclaim state
  - does not call `ReservationService.release`
  - does not show the release-success toast
- Confirming the popup:
  - calls `ReservationService.release` with the selected claim's `environment.serviceKey`
  - prevents duplicate confirm submissions while the release request is in flight
  - refreshes services through the existing successful-release flow
  - closes the popup after a successful release
  - shows the existing release-success toast text `Service released.`
- If the confirmed release fails:
  - the popup does not silently report success
  - the user sees the existing backend or frontend error message through the current toast behavior or an equivalent visible modal error
  - duplicate submission protection is cleared after the failed request completes

### Existing Release Flows

- Service Availability release buttons continue to call the existing release behavior without this new Overview popup.
- Existing extend, claim, and team-claim flows are unchanged.
- Existing authorization and backend rejection behavior for release requests is unchanged.

## Assumptions

- The user's phrase `Your active claims Overview` refers to the Overview card headed `Your active claims`.
- The requested `Workspace need to be mentioned` means each active-claim row must display the workspace name associated with the claimed service.
- The requested `unclaim it` means release the reservation using the existing `ReservationService.release(serviceKey)` path.
- A custom in-page modal consistent with existing modal markup is preferred over a browser-native `confirm(...)` dialog.

## Impact And Regression Considerations

- The change is frontend-only and should not affect backend reservation contracts.
- Active-claim row markup changes must preserve readable layout for service, environment, and workspace names of varying lengths.
- New unclaim modal state must not conflict with existing claim, invite, create workspace, create service, owner, environment, workspace rows, or delete confirmation modal state.
- Refreshing services after successful unclaim may remove the row from the Overview list; pending modal state must be cleared before or during that refresh.
- Service Availability release behavior remains intentionally unchanged to avoid expanding the requested behavior.

## Validation Plan

- Add deterministic automated coverage only if implementation can reuse an existing practical frontend/controller test pattern without introducing broad new test infrastructure.
- If no practical frontend test pattern exists, document that limitation and rely on TypeScript validation plus manual QA for the browser-only interaction.
- Run `npx tsc -p tsconfig.client.json --noEmit` for focused browser TypeScript validation.
- Run `npm run build`.
- Run `npm test`.
- Run `git diff --check`.
- Manual QA must verify:
  - Overview active-claim rows show service, environment, and `Workspace: <name>`
  - activating an Overview active claim opens the unclaim confirmation popup before any release request is sent
  - canceling or closing the popup does not unclaim the claim and does not show `Service released.`
  - confirming the popup unclaims the selected claim, refreshes the Overview count/list, and shows `Service released.`
  - duplicate confirm clicks while submitting do not send duplicate release requests
  - failed confirmed release shows a visible error and does not report success
  - Service Availability release buttons still behave as they did before this spec
  - the Overview active-claim rows and popup are keyboard reachable and usable at common mobile and desktop widths without text overlap or horizontal overflow

## Documentation Requirements

- Update `README.md` only if it already documents Overview active-claim behavior or unclaim/release workflow in a way that would become stale.
- Do not add unrelated documentation churn.

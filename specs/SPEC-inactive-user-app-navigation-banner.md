# Inactive User App Navigation And Activation Banner

Status: Approved

## Purpose

Let a logged-in, non-activated user navigate the authenticated app shell without
triggering protected API error toasts, while keeping all protected app actions
unavailable until activation.

## Problem Statement

After registration or login with a non-activated account, the authenticated app
showed the activation banner near the top of the page and still attempted
activation-gated data fetches. Those fetches produced visible errors even though
the user should be able to inspect the app navigation while waiting for
activation.

## Scope

- Reposition the activation banner to the bottom banner area above the fixed
  footer in the authenticated app shell.
- Restyle the activation banner as a softer, more rounded floating notice that
  uses the existing app color tokens.
- Provide a shared bottom banner slot so future authenticated app banners can
  use the same footer-aware placement.
- Prevent non-activated users from triggering protected app data fetches,
  auto-refresh, event subscription, and protected mutations from the browser
  controller.
- Keep top-level app navigation available for non-activated authenticated users.

## Out Of Scope

- Changing server-side activation enforcement.
- Changing registration, login, token renewal, or activation token behavior.
- Adding public data browsing for non-activated users.
- Sending activation emails.

## Definitions

- Non-activated user: an authenticated user whose identity has
  `activated === false`.
- Protected app action: a service, reservation, workspace, owner, environment,
  invitation, or workspace-user operation that requires account activation.
- Navigation: switching between the existing Overview, Service Availability,
  and Administration views in the app shell.

## Inputs And Constraints

- The app must derive activation state from the existing loaded user identity.
- Non-activated users must not see protected fetch errors caused by initial app
  loading, view changes, workspace selection watchers, auto-refresh, or direct
  controller action calls.
- Browser-side controls are a usability layer only; server-side authorization
  remains the source of enforcement.
- Styling must stay within the existing CSS design tokens and page structure.

## Deterministic Behavior Delivered

- When a non-activated user loads the app:
  - the app loads identity and app-info;
  - workspaces, services, service catalogs, owners, and environments are not
    fetched;
  - auto-refresh is not scheduled;
  - expiry event subscription is not started;
  - the loading screen clears and the user can switch top-level views.
- When a non-activated user invokes protected controller methods directly, the
  method returns without calling the corresponding protected API.
- Protected action buttons remain disabled through the existing
  `canUseProtectedActions` state.
- The app shell renders a shared fixed bottom banner stack placed above the
  fixed footer.
- The activation banner appears inside that stack only when
  `showActivationBanner` is true.
- The bottom banner stack supports additional future banners through the shared
  `.app-bottom-banner` styling and spacing.
- The activation banner keeps rounded corners, accent-tinted surface, and a
  shadow.
- The toast position is raised above the footer-aware bottom banner area so it
  does not occupy the same viewport edge as persistent banners.

## Assumptions

- "Decentralised banner" refers to the current top-of-shell placement being
  visually disconnected from the desired bottom notification treatment.
- "Fetch errors are popping up" refers to browser toasts from activation-gated
  service/workspace API calls returning non-OK responses for non-activated
  users.
- Silent no-op behavior is preferable for non-activated protected actions
  because the persistent activation banner already explains the restriction.

## Impact And Regression Considerations

- Activated users continue to load workspaces, services, auto-refresh, and event
  subscriptions as before.
- Non-activated users see empty app sections until activation because protected
  data remains unavailable.
- If activation happens in another tab, the current app state still depends on a
  reload or renewed identity state to observe activation.
- The floating bottom banner stack can share the viewport with the toast; the
  toast is offset upward to reduce overlap.

## Validation Performed

- Ran `git diff --check`.

## Validation Skipped

- `npm run lint` skipped because the super-agent workflow allows only short
  validation and this command is expected to exceed 10 seconds.
- `npm run build` skipped because it is expected to exceed 10 seconds.
- `npm test` skipped because the full suite is expected to exceed 10 seconds.
- Browser visual QA skipped by design for this lower-assurance workflow.

## Documentation Changes

- Updated this completed-behavior spec artifact.

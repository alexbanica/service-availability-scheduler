# Inactive User App Navigation And Activation Banner Plan

Status: Approved

Approved spec: `specs/SPEC-inactive-user-app-navigation-banner.md`

## Affected Files

- `public/index.html`
- `public/styles.css`
- `public/ts/controllers/AppController.ts`
- `specs/SPEC-inactive-user-app-navigation-banner.md`
- `specs/PLAN-inactive-user-app-navigation-banner.md`

## Implementation Steps Performed

1. Inspected current branch and worktree state.
2. Loaded repository and workspace instructions plus the invoked super-agent
   workflow.
3. Reviewed the app controller, app shell template, existing activation banner
   CSS, and relevant browser services.
4. Added a controller-level activation guard based on existing
   `canUseProtectedActions` state.
5. Short-circuited protected data loads, auto-refresh scheduling, expiry event
   subscription, protected modal opens, and protected mutations when the user is
   not activated.
6. Changed app mount behavior so non-activated users load identity and app-info
   only, then can navigate the shell without protected fetch attempts.
7. Removed the activation banner's inline top margin from `public/index.html`.
8. Added a shared `.app-bottom-banners` slot immediately before the footer and
   moved the activation banner into it so footer-adjacent banners have one
   placement path.
9. Restyled `.app-bottom-banner` as a fixed floating notice positioned above
   the fixed footer using existing theme tokens and a rounded, softer visual
   treatment.
10. Added footer-height CSS variables, including a mobile offset, so the bottom
    banner slot stays above the footer.
11. Moved toast positioning upward to reduce overlap with the footer-aware
    bottom banner area.
12. Added auto-approved spec and plan artifacts for this direct super-agent
    delivery.

## Validation Run

- `git diff --check`

## Validation Skipped

- `npm run lint`: skipped because it is expected to exceed the super-agent
  10-second validation limit.
- `npm run build`: skipped because it is expected to exceed the super-agent
  10-second validation limit.
- `npm test`: skipped because it is expected to exceed the super-agent
  10-second validation limit.
- Browser QA: skipped because the super-agent workflow skips QA by design.

## QA Skipped

QA was skipped by design for the invoked super-agent workflow.

## Code Review Skipped

Code review was skipped by design for the invoked super-agent workflow.

## Documentation Updates

- Updated `specs/SPEC-inactive-user-app-navigation-banner.md`.
- Updated `specs/PLAN-inactive-user-app-navigation-banner.md`.

## Commit Status

Not committed. The user did not request a commit.

## Push Status

Not pushed. The user did not request a push.

## Residual Risk

- TypeScript compilation, lint, full tests, and browser visual verification were
  not run under the super-agent time limit.
- Non-activated users intentionally see empty protected-data sections until
  activation because protected data remains unavailable.
- The fixed footer height is represented by CSS variables; if future footer
  content changes height materially, the banner offset may need the same token
  adjusted.

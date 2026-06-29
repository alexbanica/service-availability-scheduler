# Register Page Route

Status: Approved

## Purpose

Expose the browser registration page under the dedicated `/register` path.

## Problem Statement

The registration form was reachable as a mode inside `/login`. The requested
behavior is for the registration page to reside under `/register` instead of
being addressed as `/login`.

## Scope

- Add a browser page route for `GET /register`.
- Serve the existing registration-capable unauthenticated page shell at
  `/register`.
- Initialize the browser login controller in registration mode when the current
  path is `/register`.
- Keep `/login` as the login page.
- Update focused unit coverage for the route and initial browser mode.

## Out Of Scope

- Registration API behavior.
- Captcha, activation, password, token, and database behavior.
- Visual redesign beyond route-driven mode selection.
- Removing `/login`.

## Inputs And Constraints

- The existing registration form lives in `public/login.html` and is controlled
  by `LoginController`.
- The generated browser bundle path remains `/public/js/login.js`.
- Page routes must disable browser caching consistently with `/login`.
- The change must preserve unrelated worktree changes.

## Deterministic Behavior Delivered

- `GET /register` returns `public/login.html` with the same no-cache headers as
  `GET /login`.
- When the shared page shell loads at `/register`, the registration form is shown
  immediately.
- Switching from login mode to registration mode updates the browser path to
  `/register` without a full reload.
- Switching from registration mode to login or reset-password mode updates the
  browser path back to `/login`.

## Assumptions

- Reusing the existing `login.html` page shell is acceptable because it already
  contains the registration form and bundle.
- The user requirement is about the browser route and initial form state, not a
  separate physical `register.html` file.

## Impact And Regression Considerations

- `/login` remains available and starts in login mode.
- `/register` shares the existing unauthenticated page bundle, so generated
  asset paths and styling are unchanged.
- Browser history state is updated when switching modes so the visible path
  matches the selected page mode.

## Validation Performed

- Focused page controller test for `GET /register`.
- Focused browser controller tests for `/register` initial mode and mode path
  transitions.
- `git diff --check`.

## Validation Skipped

- Full `npm run build`, `npm run lint`, and `npm test` were skipped because the
  `$super-agent` workflow allows only checks expected to complete within 10
  seconds.
- Browser/manual QA was skipped by design for `$super-agent`.

## Documentation Changes

- Added this completed-work spec artifact.

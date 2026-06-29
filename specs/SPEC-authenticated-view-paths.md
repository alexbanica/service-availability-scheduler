# Authenticated View Paths

Status: Approved

## Purpose

Give each authenticated top-level app view a stable browser path after login.

## Requested Behavior

After authentication, Overview, Service Availability, and Administration must
each have their own path instead of all being addressed only through `/`.

## Scope

- Add authenticated app page routes for `/overview`, `/services`, and
  `/administration`.
- Keep `/` serving the authenticated app for backward compatibility.
- Initialize the browser app view from the current path.
- Update the browser path when users switch top-level views in the authenticated
  app.
- Redirect successful login, successful registration, and activated dashboard
  navigation to `/overview`.

## Out Of Scope

- Changing API routes.
- Splitting the single-page app into separate HTML pages or bundles.
- Changing administration subsections into separate paths.
- Changing auth token semantics, activation gating, reservations, workspace
  management, or service-management behavior.

## Definitions

- Overview path: `/overview`.
- Service Availability path: `/services`.
- Administration path: `/administration`.
- Authenticated app shell: the existing `public/index.html` Vue app.

## Inputs And Constraints

- Existing authenticated app content remains in `public/index.html`.
- Existing Vue `currentView` values remain `overview`, `availability`, and
  `admin`.
- Page routes must keep the same no-cache behavior as the existing authenticated
  app page.
- Generated `public/js` bundles are not committed.

## Deterministic Behavior Delivered

- `GET /`, `GET /overview`, `GET /services`, and
  `GET /administration` serve `public/index.html` with no-cache headers.
- Loading `/overview` opens the Overview view.
- Loading `/services` opens the Service Availability view.
- Loading `/administration` opens the Administration view.
- Unknown authenticated app paths handled by the Vue controller default to
  Overview when the shell is already loaded.
- Clicking the Overview tab pushes `/overview`.
- Clicking the Service Availability tab pushes `/services`.
- Clicking the Administration tab pushes `/administration`.
- Browser back/forward `popstate` changes the visible top-level view to match the
  current path.
- Successful login and registration redirect to `/overview`.
- Account activation dashboard countdown and manual dashboard button navigate to
  `/overview`.

## Assumptions

- The Service Availability view uses the shorter `/services` path.
- `/` should remain available to avoid breaking existing bookmarks and fallback
  links.

## Impact And Regression Considerations

- Existing authenticated app links to `/` continue to load the app.
- Browser history now records top-level view navigation.
- The app remains a single-page app, so API contracts and database behavior are
  unchanged.
- Generated browser bundles must be rebuilt by the existing build/dev workflow
  before deployment.

## Validation Performed

- Ran focused TypeScript unit tests:
  `node -r ts-node/register --test src/tests/unit/page-controller-cache.test.ts src/tests/unit/browser-auth-services.test.ts`.
- Ran targeted Prettier on changed TypeScript files.

## Validation Skipped

- `npm run build` was skipped because `super-agent` avoids commands expected to
  exceed 10 seconds.
- `npm test` was skipped because the full suite is expected to exceed 10
  seconds.
- `npm run lint` was skipped because the configured command fixes the full
  source tree and may exceed 10 seconds.
- Manual browser QA was skipped by the `super-agent` workflow.

## Documentation Changes

- Added this completed-work spec.

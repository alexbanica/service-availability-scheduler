# Authenticated View Paths Plan

Status: Approved

Approved spec: `specs/SPEC-authenticated-view-paths.md`

## Affected Files

- `src/controllers/PageController.ts`
- `public/ts/controllers/AppController.ts`
- `public/ts/controllers/LoginController.ts`
- `public/ts/controllers/ActivateAccountController.ts`
- `src/tests/unit/page-controller-cache.test.ts`
- `src/tests/unit/browser-auth-services.test.ts`
- `specs/SPEC-authenticated-view-paths.md`
- `specs/PLAN-authenticated-view-paths.md`

## Implementation Steps Performed

1. Added authenticated app page routes for `/overview`,
   `/services`, and `/administration`, reusing the same
   `public/index.html` response and no-cache headers as `/`.
2. Added a path-to-view mapping in the browser app controller so direct loads of
   the new paths open the matching top-level view.
3. Updated top-level view switching to push the matching browser path.
4. Updated workspace overview navigation to use the same view-switching path
   behavior.
5. Added a `popstate` listener so browser back/forward navigation restores the
   matching visible view.
6. Updated successful login, registration, and account-activation dashboard
   navigation to land on `/overview`.
7. Added focused unit coverage for the server page routes and browser
   path/view synchronization.
8. Added auto-approved completed-work artifacts for the direct `super-agent`
   delivery.

## Validation Run

- `node -r ts-node/register --test src/tests/unit/page-controller-cache.test.ts src/tests/unit/browser-auth-services.test.ts`
- `npx prettier --write src/controllers/PageController.ts public/ts/controllers/LoginController.ts public/ts/controllers/ActivateAccountController.ts public/ts/controllers/AppController.ts src/tests/unit/page-controller-cache.test.ts src/tests/unit/browser-auth-services.test.ts`

## Validation Skipped

- `npm run build`, because it is expected to exceed the `super-agent`
  10-second command budget.
- `npm test`, because the full suite is expected to exceed the `super-agent`
  10-second command budget.
- `npm run lint`, because it runs over the full source tree with fixes and may
  exceed the `super-agent` 10-second command budget.
- Manual browser QA, because the `super-agent` workflow skips QA by design.

## QA Skipped

QA was skipped by the `super-agent` workflow.

## Code Review Skipped

Code review was skipped by the `super-agent` workflow.

## Documentation Updates

- Added `specs/SPEC-authenticated-view-paths.md`.
- Added `specs/PLAN-authenticated-view-paths.md`.

## Commit Status

Not committed. The user did not request a commit.

## Push Status

Not pushed. The user did not request a push.

## Residual Risk

- Full build, full lint, full test suite, generated browser bundle refresh, and
  manual browser verification remain unvalidated in this direct workflow.
- Deployed environments must run the existing build/dev workflow so
  `public/js` bundles reflect the changed browser TypeScript.

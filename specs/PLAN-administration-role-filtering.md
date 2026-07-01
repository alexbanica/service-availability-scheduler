# Administration Role Filtering Plan

Status: Approved

Spec: `specs/SPEC-administration-role-filtering.md`

## Affected Files

- `public/index.html`
- `public/ts/controllers/AppController.ts`
- `src/tests/unit/app-controller-renewal-scheduling.test.ts`
- `src/tests/unit/browser-auth-services.test.ts`
- `specs/SPEC-administration-role-filtering.md`
- `specs/PLAN-administration-role-filtering.md`

## Implementation Steps Performed

1. Loaded `$super-agent` instructions, workspace guidance, branch state, and
   relevant administration role-gating code.
2. Verified `GET /api/workspaces` already returns membership-scoped
   `current_user_role`, so no backend API change was needed.
3. Kept Administration entry visibility tied to `resourceAdminWorkspaces`.
4. Changed User management state to use `adminWorkspaces` instead of
   `resourceAdminWorkspaces`.
5. Changed `loadWorkspaceUsers` to require `admin` role for the selected
   workspace.
6. Changed User management tab and selector markup to use `adminWorkspaces`.
7. Added stale-selection handling so a member-only selected workspace is
   replaced with the first admin workspace before user rows load.
8. Updated focused tests for manager-only and mixed-role users.
9. Created completed-work spec and plan artifacts.

## Validation Run

- `node -r ts-node/register --test src/tests/unit/browser-auth-services.test.ts`
- `node -r ts-node/register --test src/tests/unit/app-controller-renewal-scheduling.test.ts`
- `npx tsc -p tsconfig.client.json --outDir /tmp/sas-app-controller-renewal-tests --module commonjs`
- `git diff --check`

## Validation Skipped

- `npm run lint`
- `npm run build`
- Full `npm test`

These were skipped under `$super-agent` constraints because they are not
expected to complete within about 10 seconds.

## QA Skipped

- Manual browser QA was skipped by design for `$super-agent`.

## Code Review Skipped

- Code review was skipped by design for `$super-agent`.

## Documentation Updates

- Added completed-work artifacts under `specs/`.

## Commit Status

- Not committed.

## Push Status

- Not pushed.

## Residual Risk

- Existing unrelated dirty changes remain in the same worktree and were
  preserved.
- Full project validation was not run.
- The administration UI was not manually verified in a browser.

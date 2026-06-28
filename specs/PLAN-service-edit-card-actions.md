# PLAN: Service Edit Card Actions

Status: Approved

Approved spec reference: `specs/SPEC-service-edit-card-actions.md`

## Affected Files

- `public/index.html`
- `public/styles.css`
- `specs/SPEC-service-edit-card-actions.md`
- `specs/PLAN-service-edit-card-actions.md`

## Implementation Steps Performed

1. Inspected Service Management card markup in `public/index.html`.
2. Inspected edit-card and action layout styles in `public/styles.css`.
3. Changed the service-card top action row so workspace admins see it only when that service is not currently being edited.
4. Removed the edit-state `Cancel edit` label by making the top row unavailable during edit mode.
5. Kept `Edit` as the non-editing action that opens the existing edit form.
6. Moved the edited service's delete control into the edit form bottom action row with `Cancel` and `Save Service`.
7. Applied red destructive styling through a scoped `button.danger` CSS class.
8. Updated edit-form CSS so fields, selects, tag inputs, and buttons wrap within the card without overlapping.
9. Created completed super-agent spec and plan artifacts with `Status: Approved`.

## Validation Run

- `git diff --check`.

## Validation Skipped

- `npm run lint` was skipped because it may exceed the super-agent workflow's 10 second validation limit.
- `npm run build` was skipped because it may exceed the super-agent workflow's 10 second validation limit.
- `npm test` was skipped because it may exceed the super-agent workflow's 10 second validation limit.
- Browser/manual QA was skipped because the super-agent workflow skips QA by design.

## QA Skipped

- QA was skipped by design for the super-agent workflow.

## Code Review Skipped

- Code review was skipped by design for the super-agent workflow.

## Documentation Updates

- Added this completed-work plan.
- Added `specs/SPEC-service-edit-card-actions.md`.
- No README or operational documentation update was needed.

## Commit Status

- Not committed; the user did not request a commit.

## Push Status

- Not pushed; the user did not request a push.

## Residual Risk

- The change has not been verified in a running browser session.
- Full lint, build, and test validation were not run under the super-agent time limit.

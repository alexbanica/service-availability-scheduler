# SPEC: Service Create Field Placeholder Clearing

Status: Approved

## Purpose

Ensure the Service Management create/edit tag-style fields do not keep guidance text visible after the field already has committed values.

## Problem Statement

When creating a service, the owner and environments controls can display committed values as tags while the empty inner text input still shows placeholder guidance. This makes it look like the field still contains text after the user has selected or entered a value.

## Scope

- Service Management create-service modal owner field.
- Service Management create-service modal environments field.
- Service Management edit-service environments field.

## Out Of Scope

- Backend service creation or update behavior.
- Owner persistence, environment persistence, validation, and authorization semantics.
- The edit-service owner select control.
- New frontend dependencies or broad layout redesign.

## Inputs And Constraints

- The frontend is rendered by Vue bindings in `public/index.html`.
- Committed owner and environment values must remain visible as existing chips/tags.
- The text input must remain available for adding another owner or environment value where the current UI supports it.
- Guidance text should remain visible when a field has no committed values.

## Deterministic Behavior Delivered

- The create-service owner input shows `Type or choose owner` only while no owner is committed.
- After a create-service owner is selected or typed and committed, the owner tag remains visible and the owner input placeholder becomes empty.
- The create-service environments input shows its environment-entry guidance only while no environment tags are committed.
- After one or more create-service environments are committed, the environment tags remain visible and the environment input placeholder becomes empty.
- The edit-service environments input follows the same placeholder behavior as create-service environments.
- Removing the committed owner or all environment tags restores the relevant guidance text.

## Assumptions

- The reported remaining text is the placeholder guidance inside the tag-style input after a committed value is present.
- The expected behavior is to hide placeholder text, not to remove the input itself.

## Impact And Regression Considerations

- The change is template-only and does not alter form state, submission payloads, validation, or API contracts.
- Users can still add more environments after one is selected because the input remains present.
- Placeholder guidance remains available for empty fields, preserving discoverability.

## Validation Performed

- Targeted source search verified the affected placeholder bindings exist in `public/index.html`.
- `git diff --check` was planned as short validation after the edit.

## Validation Skipped

- `npm run build` was skipped because the super-agent workflow allows only short validation and the project build may exceed 10 seconds.
- Browser/manual QA was skipped by design in the super-agent workflow.

## Documentation Changes

- No user-facing documentation changes were required for this UI text visibility fix.

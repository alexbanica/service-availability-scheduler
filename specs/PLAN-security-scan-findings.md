# Security Scan Findings Fixes Plan

Status: Approved

Spec: `specs/SPEC-security-scan-findings.md`

## Affected Files

- `src/service-availability-scheduler.ts`
- `src/controllers/AuthController.ts`
- `src/controllers/ServiceController.ts`
- `src/tests/unit/activation-gated-endpoints.test.ts`
- `public/index.html`
- `public/login.html`
- `public/reset-password.html`
- `public/activate-account.html`
- `public/workspace-invitation.html`
- `package.json`
- `package-lock.json`
- `README.md`
- `swagger.yml`

## Implementation Steps Performed

1. Added startup secret resolution that fails outside local development/test
   when `SESSION_SECRET` is unset.
2. Added browser hardening headers and disabled `X-Powered-By`.
3. Served Vue from the installed pinned dependency at `/vendor/vue`.
4. Replaced floating external Vue CDN script tags with the local vendor route.
5. Wired the existing `RateLimiter` into sensitive auth/account endpoints with
   `429` responses.
6. Added activation gating to `GET /api/services`.
7. Updated the focused activation-gating unit test.
8. Updated README and Swagger contract documentation.

## Validation Run

- `npm install vue@3.5.39 --package-lock-only --ignore-scripts`
- `npm install --package-lock-only --ignore-scripts`
- `npx prettier --write src/controllers/AuthController.ts src/controllers/ServiceController.ts src/service-availability-scheduler.ts src/tests/unit/activation-gated-endpoints.test.ts`
- `npx tsc -p tsconfig.json --noEmit`
- `node -r ts-node/register --test src/tests/unit/activation-gated-endpoints.test.ts`

## Validation Skipped

- Full build and full automated test suite, because the `super-agent` workflow
  limits validation to commands expected to complete within about 10 seconds.
- Browser QA, live server scan, SAST, and container image scan.

## QA Skipped

Manual QA was skipped by design for `super-agent`.

## Code Review Skipped

Code-review subagent review was skipped by design for `super-agent`.

## Documentation Updates

- `README.md` documents `SESSION_SECRET`, rate limiting, and local pinned Vue.
- `swagger.yml` documents throttling responses and `/api/services` activation.

## Commit Status

Not committed.

## Push Status

Not pushed.

## Residual Risk

- Rate limiting is process-local and resets on restart.
- CSP remains compatible with the current inline scripts/styles and Vue compiler,
  so it is not a strict no-inline/no-eval policy.
- `localStorage` bearer-token storage and reset/activation link logging remain
  documented risks outside this direct fix.

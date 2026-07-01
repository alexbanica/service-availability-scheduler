# Security Scan Findings Fixes

Status: Approved

## Purpose

Address the concrete security findings from the local security scan dated
2026-07-01 without changing the broader authentication/session architecture.

## Requested Behavior

- Normal startup must not use a public fallback JWT signing secret.
- Non-activated authenticated users must not read service availability data from
  `/api/services`.
- Sensitive authentication, registration, CAPTCHA, password reset, and account
  activation endpoints must be rate limited.
- HTTP responses must include basic browser security hardening headers.
- Browser pages must not load the Vue runtime through a floating external CDN
  URL.

## Scope

- Server startup secret handling.
- Auth and account endpoint throttling.
- Service availability activation gating.
- Security headers and local Vue runtime serving.
- API contract and README updates for changed behavior.

## Out Of Scope

- Moving bearer tokens from `localStorage` to cookies.
- Replacing logged reset and activation links with email delivery.
- Removing all inline script/style and Vue compiler CSP allowances.
- Live penetration testing, SAST, container image scanning, and browser QA.

## Deterministic Behavior Delivered

- `SESSION_SECRET` is required before database initialization unless the runtime
  is local development (`npm run dev`) or test (`NODE_ENV=test`).
- `GET /api/services` now runs `requireAuth` followed by `requireActivated` and
  returns the existing `403 { "error": "Account not activated" }` response for
  non-activated users.
- Sensitive auth/account routes return `429 { "error": "Too many requests" }`
  when their in-memory rate-limit windows are exceeded.
- Express disables `X-Powered-By` and sets CSP, frame, content-type, referrer,
  and permissions-policy headers.
- HTML shells load Vue from `/vendor/vue/vue.global.prod.js`, served from the
  pinned `vue` package dependency.

## Assumptions

- In-memory rate limiting is acceptable for this direct fix and can be replaced
  later if multi-process or distributed limits are required.
- The current Vue in-DOM template approach still requires CSP allowances for
  inline script/style and runtime template compilation.

## Impact

- Deployments that previously relied on the default `SESSION_SECRET` must set a
  real secret before startup.
- Non-activated users can keep using allowed activation/session endpoints but
  cannot read service availability data.
- Repeated sensitive auth/account requests may receive `429`.

## Validation Performed

- `npm install vue@3.5.39 --package-lock-only --ignore-scripts`
- `npm install --package-lock-only --ignore-scripts`
- `npx prettier --write` on touched TypeScript files
- `npx tsc -p tsconfig.json --noEmit`
- `node -r ts-node/register --test src/tests/unit/activation-gated-endpoints.test.ts`

## Validation Skipped

- Full `npm run build`
- Full `npm test`
- Browser QA
- Live security scan
- SAST
- Container image scan

## Documentation Changes

- Updated `README.md` runtime configuration and security behavior notes.
- Updated `swagger.yml` for `429` responses and `/api/services` activation
  requirement.

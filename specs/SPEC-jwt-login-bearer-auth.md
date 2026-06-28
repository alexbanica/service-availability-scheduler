Status: Approved

# JWT Login And Bearer Authentication

## Purpose

Replace session-cookie API authentication with a JWT login contract so API clients can authenticate by sending a bearer token in request headers.

## Problem Statement

The application currently creates an Express session during email-only login and protected controllers read the signed-in user from `req.session`. That makes API authentication depend on browser cookies. API clients need a deterministic token-based contract where login issues a JWT and every protected API call except the login endpoint accepts the token through the `Authorization: Bearer <token>` header.

## Scope

- Change `POST /api/login` to issue a signed JWT for the authenticated user.
- Add a token renewal API so browser sessions can continue after the 1-hour login token expires.
- Allow protected API requests to authenticate with `Authorization: Bearer <token>`.
- Require bearer authentication for protected `/api/*` endpoints other than `POST /api/login`.
- Keep `POST /api/login` unauthenticated and email-only.
- Keep the existing authenticated user identity fields available to controllers after authentication:
  - user id
  - email
  - nickname
- Update browser API calls after login to send the bearer token in request headers.
- Store the browser token in `localStorage`.
- Renew the browser token through the renewal API when required.
- Update logout behavior so the browser clears its stored bearer token and returns to `/login`.
- Update authenticated page access so the browser app remains usable after session cookies are removed.
- Update API documentation and runtime configuration wording from session-cookie auth to JWT bearer auth.
- Allow the JWT token lifetime to be configured through environment or application file config.

## Out Of Scope

- Adding password authentication.
- Adding OAuth, OIDC, SSO, API keys, or refresh tokens.
- Adding server-side token persistence, revocation lists, or per-token logout invalidation.
- Adding refresh-token rotation or a separate refresh-token storage contract.
- Changing user lookup, workspace authorization, reservation authorization, or role semantics.
- Changing email-only login eligibility.
- Changing database schema.
- Changing service, workspace, reservation, owner, or environment API response bodies except where authentication failure handling is affected.
- Adding token transport through query parameters.

## Definitions

- `JWT`: A signed JSON Web Token issued by the application after successful email-only login.
- `Bearer token`: A JWT sent in the HTTP `Authorization` header using the exact scheme `Bearer`.
- `Login endpoint`: `POST /api/login`.
- `Renew endpoint`: A protected API endpoint that accepts a still-valid bearer token and returns a replacement JWT.
- `Protected API endpoint`: Any existing authenticated route under `/api/*` except `POST /api/login`.
- `Authenticated request context`: The request-local user identity made available to controllers after a JWT is accepted.

## Inputs And Constraints

- `POST /api/login` accepts the current request body shape: `{ "email": string }`.
- The JWT signing secret uses the existing `SESSION_SECRET` environment variable unless a later approved spec introduces a dedicated JWT secret.
- If `SESSION_SECRET` is unset, local development may continue to use the existing default `dev-secret-change-me`.
- JWTs must be signed and verified by the server; clients must not be trusted for unsigned user identity.
- JWT payloads must include only the identity fields needed by existing authenticated controllers and browser user display.
- JWTs must include an expiration.
- JWTs issued by login are valid for 1 hour.
- Renewed JWTs are valid for 1 hour from renewal.
- JWT lifetime is configurable through the `JWT_EXPIRES_IN_SECONDS` environment variable.
- JWT lifetime is configurable through the `jwt_expires_in_seconds` key in `config/app.yml`.
- `JWT_EXPIRES_IN_SECONDS` and `jwt_expires_in_seconds` are expressed in seconds.
- When both sources are present, `JWT_EXPIRES_IN_SECONDS` takes precedence over `config/app.yml`.
- When neither source is present, the default JWT lifetime is `3600` seconds.
- Non-numeric, zero, or negative JWT lifetime values are rejected during application config loading.
- Protected API requests without a bearer token, with a malformed bearer header, with an invalid token, or with an expired token return `401` with the existing unauthenticated JSON shape unless the implementation needs a more specific deterministic error message documented in the plan.
- `POST /api/login` must not require or validate an inbound bearer token.
- The browser must store the JWT in `localStorage` so `fetch` calls can add the `Authorization` header after page reloads.
- Generated browser bundles under `public/js` remain build artifacts and must not be committed.

## Deterministic Behavior

### Login

- `POST /api/login` continues to trim and lowercase the submitted email.
- Missing or blank email continues to return `400` with `Email required`.
- Unknown email continues to return `403` with `Email not found`.
- Successful login returns `200` with:
  - `ok: true`
  - the current `user` object
  - `token`, containing the signed JWT
  - `token_type: "Bearer"`
  - `expires_in_seconds`, containing the configured token lifetime in seconds
- Successful login does not create or require an Express session.
- The browser login flow stores the token and redirects/continues using the existing post-login navigation behavior.

### Token Renewal

- The application exposes a protected renew API endpoint under `/api/*`.
- The renew endpoint requires `Authorization: Bearer <token>`.
- The renew endpoint accepts only a currently valid, unexpired JWT.
- A missing, malformed, invalid, or expired token sent to the renew endpoint returns `401` JSON.
- A successful renew response returns `200` with:
  - `ok: true`
  - the current authenticated user identity
  - `token`, containing a new signed JWT
  - `token_type: "Bearer"`
  - `expires_in_seconds`, containing the configured token lifetime in seconds
- The renewed token replaces the previous token in browser `localStorage`.
- This spec does not provide renewal after the 1-hour token has already expired; after expiry, the user must log in again.

### Authenticated API Requests

- Every existing protected `/api/*` route except `POST /api/login` accepts authentication through `Authorization: Bearer <token>`.
- The bearer scheme comparison is case-insensitive.
- The token value itself is treated as case-sensitive and must verify exactly.
- Accepted tokens populate the authenticated request context with user id, email, and nickname.
- Existing controllers use the authenticated request context instead of session state for authorization and user-specific behavior.
- Existing successful API behavior remains unchanged after authentication succeeds.
- Existing authorization failures that happen after authentication, such as workspace authorization failures, remain unchanged.
- Invalid or missing bearer authentication returns `401` JSON and does not fall back to a cookie session.

### Browser API Calls

- Browser login stores the JWT after successful `POST /api/login`.
- Browser login stores the JWT in `localStorage`.
- Browser API helper methods add `Authorization: Bearer <token>` to every API request except `POST /api/login` when a token is present.
- Browser API helper methods do not send `credentials: "include"` for JWT-authenticated API calls.
- Browser code renews the token before it expires when the user is actively using the app and a valid token is still available.
- If renewal succeeds, browser code stores the renewed token in `localStorage` and continues using it for future API calls.
- If renewal fails with `401`, the browser clears the stored token and sends the user to `/login`.
- If an authenticated API call receives `401`, the browser clears the stored token and sends the user to `/login`.
- Logout clears the browser-stored token and redirects to `/login`.
- `POST /api/logout` may remain as a compatibility endpoint, but server-side logout is stateless because this spec does not add token revocation.

### Page And Event Access

- `GET /login` remains publicly accessible.
- The root page `/` must remain reachable so the browser application can load and perform JWT-backed `/api/me` authentication after page load.
- Page-level protection must not rely on Express session state.
- The existing `/events` server-sent events endpoint is not under `/api`; because browser `EventSource` cannot send an `Authorization` header directly, this spec preserves current notification usability by allowing a token-authenticated equivalent that does not require custom headers. The implementation plan must choose one deterministic approach within approved scope, such as replacing EventSource with a fetch-capable stream client or introducing an authenticated API event endpoint compatible with bearer headers.

## Assumptions

- `Update login to jwt` means replacing session-cookie authentication for API calls, not adding JWT alongside session cookies.
- `Allow bearer token to be sent in headers for all api calls except login api endpoint` means protected API calls require bearer auth and the login endpoint is the only API endpoint that remains unauthenticated.
- The current `SESSION_SECRET` name may be reused as the JWT signing secret to avoid introducing a new required runtime variable in this change.
- A 1-hour JWT lifetime is the default after login and after each renewal.
- Operators may override JWT lifetime through environment configuration or `config/app.yml`.
- Renewal is based on the current valid access token; this change does not introduce a separate long-lived refresh token.
- Stateless logout is acceptable for this change; immediate invalidation of already-issued tokens requires a future revocation or token-version spec.

## Impact And Regression Considerations

- Removing Express session auth affects all protected controllers that currently read `req.session.userId`, `req.session.email`, or `req.session.nickname`.
- Browser reloads must keep the user signed in using stored JWT state rather than server session state.
- Browser reloads after token expiry must require login again unless the token was renewed before expiry.
- The root page currently uses server-side session gating; that gate must change or the browser app cannot bootstrap from a stored JWT.
- SSE expiry notifications currently use `/events` with session auth; this flow needs an explicitly token-compatible path to avoid silently disabling notifications.
- API clients must store and send the JWT after login.
- Existing cookie-authenticated clients will no longer authenticate unless a future approved spec explicitly preserves cookie fallback.
- Token secret changes invalidate all previously issued JWTs.
- Storing JWTs in `localStorage` makes tokens available to browser JavaScript; this is accepted for this change and increases the importance of avoiding XSS.

## Acceptance Criteria

- `POST /api/login` succeeds for an existing email and returns a signed JWT plus the authenticated user.
- Login responses report the effective configured token lifetime in `expires_in_seconds`.
- `POST /api/login` does not require `Authorization`.
- The renew endpoint returns a new signed JWT using the effective configured token lifetime when called with a valid unexpired bearer token.
- Renew responses report the effective configured token lifetime in `expires_in_seconds`.
- The renew endpoint rejects missing, malformed, invalid, and expired bearer tokens with `401` JSON.
- Protected `/api/*` endpoints reject missing, malformed, invalid, and expired bearer tokens with `401` JSON.
- Protected `/api/*` endpoints accept valid `Authorization: Bearer <token>` headers and preserve their existing successful behavior.
- Protected `/api/*` endpoints no longer depend on Express session cookies.
- The browser login flow stores the returned token in `localStorage` and uses it for subsequent API calls.
- The browser renews the token before expiry during active app usage and replaces the stored token after successful renewal.
- After token expiry without successful renewal, the browser redirects to login.
- Browser API calls except login include the bearer header when a token is stored.
- The browser can reload the main page and restore authenticated app state from the stored token.
- Browser logout clears the stored token and returns the user to `/login`.
- Existing reservation expiry notification behavior remains available through a token-compatible mechanism.
- README documents the JWT bearer login flow and runtime secret behavior.
- Automated tests cover login token issuance, authenticated API acceptance, missing/invalid/expired token rejection, and browser API header behavior where practical.

## Validation Plan

- Add or update deterministic unit tests for JWT signing and verification behavior.
- Add or update deterministic tests for default 1-hour token expiration, configured token lifetime, precedence, and renewal behavior.
- Add or update controller or middleware tests for authenticated and unauthenticated request handling.
- Add or update browser TypeScript tests only if the repository has an existing browser test pattern; otherwise validate browser header construction through TypeScript build and focused code review.
- Run `npx tsc -p tsconfig.json --noEmit`.
- Run `npx tsc -p tsconfig.client.json --noEmit`.
- Run `npm test`.
- Run `npm run build`.
- Run `git diff --check`.

## Documentation Requirements

- Update `README.md` runtime configuration to describe JWT bearer authentication and the signing secret behavior.
- Document the JWT lifetime environment variable, `config/app.yml` key, precedence, units, and default.
- Remove or revise documentation that describes `SESSION_SECRET` only as an Express session signing secret.
- Update agent-facing instructions only if implementation changes local startup, validation, architecture boundaries, generated artifacts, or future-agent authentication expectations.

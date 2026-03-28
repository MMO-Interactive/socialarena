# API Analysis: Current State and What We Likely Need Next

> Repository note: This analysis is intentionally committed in-repo for ongoing API planning and iteration.

## Scope analyzed

This analysis reviewed the API router and helper layer in:

- `api/v1/index.php`
- `api/v1/bootstrap.php`
- related current-state notes in `STANDALONE_EDITOR_API_CURRENT_STATE.md`

The focus is the standalone editor API under `/api/v1` and adjacent platform handler usage patterns.

## Current API shape (what exists today)

### 1) Single-file route router with session-auth

The API is centrally routed in `api/v1/index.php` and is currently based on PHP session authentication where the API token is effectively `session_id()`.

Implemented auth routes:

- `POST /auth/editor-login`
- `POST /auth/refresh`
- `POST /auth/select-studio`
- `POST /auth/logout`

### 2) Studio-scoped editor domain routes

The API already supports a meaningful editor surface:

- dashboard summary
- project listing + creation + detail
- series season/episode creation
- assets listing
- idea-board load/save + item actions
- starting image generation + refresh
- video clip generation + refresh
- bridge clip queue + refresh
- timeline load/save + autosave
- export init + complete + list

### 3) Strongly pragmatic reuse of legacy handlers

A major implementation trait: newer editor endpoints proxy into legacy `includes/idea_board_handlers.php` flows for generation and refresh actions.

This gets feature leverage quickly, but keeps coupling to legacy action semantics and payload shape.

### 4) Basic response conventions with mixed success envelope

Error responses are standardized with:

```json
{
  "success": false,
  "error": { "code": "...", "message": "..." }
}
```

But success payloads are mixed:

- sometimes top-level domain payloads (`project`, `exports`, etc.)
- sometimes explicit `success: true`
- sometimes passthrough payloads from proxied handlers

This is workable, but inconsistent for client SDK generation and stricter typed clients.

## Key strengths

- **Clear route coverage for editor MVP needs** (project lifecycle, idea board, timeline, exports).
- **Studio boundary checks exist** and are enforced in multiple paths.
- **Backwards compatibility strategy is practical** via handler proxying.
- **Data model adaptation helpers exist** (`table_exists`, enum support checks), reducing hard failures in partially migrated environments.

## Gaps / risks observed

## 1) Auth model is not ideal for API consumers

Current auth is session-id-as-bearer. This is convenient internally but weaker for externalized API use:

- no dedicated API token format/claims
- no scoped tokens (editor-only vs full account capabilities)
- no refresh token rotation model
- difficult revocation/audit granularity

## 2) Missing API contract formalization

There is no canonical OpenAPI source of truth for `/api/v1`.

Result:

- no generated typed clients
- no contract test automation
- response shape drift risk across endpoints

## 3) Async generation model is partially normalized

Generation-like operations exist (starting images, clips, bridge clips), but job semantics are not fully unified.

Likely pain points as usage grows:

- inconsistent status vocabulary across job families
- polling endpoints differ by domain path
- no single reusable long-running-job abstraction

## 4) Inconsistent success envelope / metadata

Without a consistent envelope (request id, pagination metadata, version metadata, tracing), observability and generic client middleware are harder.

## 5) Limited operational controls in API layer

From API surface and helper behavior, likely missing or minimal:

- rate limiting / abuse guardrails
- idempotency key support for POST creates
- structured request correlation IDs
- first-class audit logging per route/action

## 6) Export pipeline remains placeholder-like

Export init currently creates records with `upload_url: null` and storage path placeholders; complete marks records done.

For production-grade workflows, this usually needs:

- signed upload URLs
- resumable upload support
- checksum validation
- state machine with retries/fail reasons

## 7) Versioning and evolution strategy could get brittle

`/api/v1` namespace exists, which is good. But there is no visible deprecation, sunset, or compatibility policy in code/docs.

## What we are likely to need next (prioritized)

## P0 — Foundation hardening (do next)

1. **Publish OpenAPI spec for all existing `/api/v1` routes**
   - lock request/response contracts
   - add examples for all generation endpoints
2. **Unify success envelope**
   - include `success`, `data`, optional `meta`, optional `request_id`
3. **Introduce request correlation IDs + structured logs**
   - propagate `X-Request-Id` through responses and logs
4. **Define common async job status schema**
   - shared statuses: `queued|processing|completed|failed|canceled`
   - shared job resource representation

## P1 — Security and client reliability

1. **Move to dedicated API tokens** (or short-lived access + refresh tokens)
   - keep session bridge temporarily for compatibility
2. **Add idempotency keys for create/queue endpoints**
   - especially exports and generation queue endpoints
3. **Add route-level rate limits**
   - stricter for auth and generation endpoints
4. **Standardize error code catalog**
   - unique stable machine-readable codes across all endpoints

## P2 — Product/API maturity

1. **First-class jobs API**
   - `POST /jobs`, `GET /jobs/{id}`, callbacks/webhooks optional
2. **Production export pipeline**
   - signed upload, completion verification, lifecycle states
3. **Cursor pagination + filtering conventions**
   - standardized list endpoint query behavior
4. **Deprecation policy + compatibility tests**
   - contract tests run in CI against route fixtures

## Suggested target API capabilities map

A practical shape to target over next phases:

- **Auth & Sessions**: scoped tokens, refresh rotation, revoke endpoint
- **Projects**: CRUD + publish transitions + optimistic concurrency
- **Generation Jobs**: unified queue/status/cancel/retry
- **Assets**: signed upload/download, metadata extraction, retention policies
- **Exports**: async pipeline, webhook/event updates
- **Observability**: request ids, audit trail, metrics per route

## Migration approach (low-risk)

1. **Stabilize current endpoints first** (contract + envelope + error map) without breaking route paths.
2. **Add new unified job endpoints in parallel** while old domain-specific endpoints continue working.
3. **Introduce token auth as additive**, then phase down session-id bearer for desktop clients.
4. **Deprecate legacy proxy-dependent endpoints only after parity** and migration telemetry confirms adoption.

## Concrete 30/60/90-day plan

### First 30 days

- OpenAPI draft for all current routes
- success/error normalization RFC
- request-id and structured log middleware
- idempotency design for create/queue routes

### 60 days

- token auth in parallel with current auth
- first unified jobs endpoints (read/status)
- export init with signed upload URL (initial cloud target)

### 90 days

- clip/image/job route convergence
- export completion verification + retry states
- formal deprecation headers and migration guides

## Bottom line

The API is already beyond a prototype: it supports meaningful editor workflows today. The biggest next need is **not more ad-hoc endpoints**, but **platform-level API consistency** (contract, envelope, auth model, job abstraction, and operability controls). That will let you scale clients and features without compounding integration debt.

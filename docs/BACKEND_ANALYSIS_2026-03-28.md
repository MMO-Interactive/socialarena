# Backend analysis (2026-03-28)

## Executive summary
The backend is a PHP + MySQL monolith with a hybrid API surface:
- a newer JSON API under `api/v1/*` (session-token driven), and
- many legacy endpoint-style handler scripts in `includes/*handlers.php`.

It is feature-rich and already enforces auth/authorization in many places, but operationally it needs standardization around API contracts, security controls, and testability to scale safely.

## Current backend shape

### 1) Runtime and entrypoints
- DB/session bootstrap is done in `includes/db_connect.php` and `includes/session_bootstrap.php`.
- Environment configuration is centralized in `includes/config.php`.
- The newer backend surface is routed through `api/v1/index.php` + helper functions in `api/v1/bootstrap.php`.
- Legacy JSON-style actions still live in many handler files under `includes/`.

### 2) Data and domain model
- The schema is broad and product-aligned (users, studios, permissions, universes, series, stories, projects, budgets, media, etc.).
- The app supports single-user ownership and studio-based collaboration/visibility.

### 3) Auth and authorization
- Session-based auth is used globally; API supports bearer-like session tokens via `Authorization: Bearer` or `X-Editor-Session`.
- Studio permission checks exist (`enforceStudioPermission`, role/permission matrix lookups).
- New API endpoints generally enforce auth and membership; legacy handlers vary in strictness and response style.

### 4) Error handling and API consistency
- `api/v1` has structured error responses (`api_error`) and centralized exception handling.
- Legacy handlers often throw generic exceptions and return mixed 400 responses with ad hoc payloads.

### 5) File/media handling
- Multiple handlers perform direct uploads with extension/MIME checks and `move_uploaded_file`.
- Upload logic is repeated across many files instead of one shared hardened service.

### 6) Delivery maturity
- No repository-level automated backend test suite was found (`composer.json`/`phpunit`/`tests` not present).
- Backend logic is spread across many procedural handlers (32 `*handlers.php` files), which increases maintenance risk.

## What you are likely to need next (prioritized)

## P0 (do first)
1. **API contract unification layer**
   - Standardize all backend responses to one envelope (`success`, `data`, `error`, `meta`) and shared status code strategy.
   - Goal: avoid front-end branching and reduce regression risk across old/new endpoints.

2. **Cross-cutting security baseline**
   - Add CSRF protection for cookie-authenticated browser endpoints.
   - Add request rate limiting for auth and AI-generation endpoints.
   - Replace trust in `\$_FILES['type']` with server-side content sniffing (`finfo`) and centralized allowlists.

3. **Centralized input validation**
   - Introduce reusable validators (IDs, enum fields, date fields, URL/media fields).
   - Remove per-handler duplicated validation logic.

## P1 (high value)
4. **Service/repository refactor for hot paths**
   - Start with projects/story media/series media handlers.
   - Move business rules from script-level switches into reusable service classes.

5. **Observability and incident readiness**
   - Add request IDs, structured logs (JSON), and timing metrics around DB + upstream calls.
   - Add environment-level error reporting policy and distinguish user-safe vs operator logs.

6. **API versioning + deprecation plan**
   - Keep `api/v1` as the canonical surface.
   - Mark legacy `includes/*handlers.php` endpoints with migration status and sunset windows.

## P2 (scale/readiness)
7. **Automated test foundation**
   - Add PHPUnit + baseline integration tests for auth, permissions, CRUD, and media workflows.
   - Add contract tests for `api/v1` JSON schemas.

8. **Schema/index review and data governance**
   - Validate high-traffic query indexes (projects, stories, studio visibility lookups).
   - Add explicit migration tooling and schema version tracking if absent.

9. **Asynchronous job strategy for long-running AI/media tasks**
   - Introduce queue + worker model for generation, transcoding, retries, and dead-letter handling.

## Suggested 30-day backend plan
- **Week 1:** define API envelope standard, add shared response helpers for legacy handlers, choose validation library pattern.
- **Week 2:** implement CSRF + rate limiting + centralized upload validation.
- **Week 3:** extract services for `project_handlers.php` and `story_media_handlers.php`; add first integration tests.
- **Week 4:** instrument request IDs/logs, publish endpoint migration map, and lock first deprecation milestones.

## Immediate risk register
- Inconsistent endpoint behavior between legacy and `api/v1` surfaces.
- Procedural handler sprawl causing slower feature delivery and higher defect probability.
- Missing automated regression safety net.
- Repeated upload logic increasing security drift risk.


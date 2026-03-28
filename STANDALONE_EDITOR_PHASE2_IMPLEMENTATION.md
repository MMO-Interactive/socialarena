# Standalone Editor Phase 2 Implementation

Date: 2026-03-19

## Purpose

This document defines the implementation plan for Phase 2 of the standalone editor roadmap:

- Universal Studio Scoping

The goal of this phase is to move studio context from a mostly frontend-managed convention into a consistent backend-enforced rule.

This is not a feature expansion phase. It is an architecture-hardening phase.

## Executive Summary

The editor is now clearly intended to operate inside a studio context:

- users authenticate
- users belong to one or more studios
- the editor should load data for one studio at a time
- permissions and visibility should come from studio membership

Right now the implementation is only partially coherent:

- the frontend stores and forwards `studio_id`
- some backend routes consult current studio context
- some backend project lookups enforce studio membership
- other routes still rely too heavily on the renderer passing the right `studio_id`

Phase 2 makes studio context authoritative at the server boundary.

## Primary Goal

Make studio context a first-class backend rule rather than a frontend convention.

At the end of this phase:

- every studio-sensitive request must resolve an effective studio
- every studio-sensitive request must validate membership
- every returned object must belong to that studio
- the editor must never operate in ambiguous scope

## What This Phase Is Solving

Without universal studio scoping, the system risks:

- cross-studio data leakage
- inconsistent project and asset visibility
- permission bugs
- confusing dashboard and browser results
- future migration pain once collaboration expands

This phase exists to stop that before more surface area gets added.

## Product Rules For Phase 2

These rules should be treated as non-optional for implementation.

### 1. The editor is studio-scoped

The editor must always have an effective studio context.

That context may come from:

- selected studio in the current authenticated session
- explicit studio-selection API call
- a temporary dev fallback only if the product still intentionally supports it

The long-term rule is:

- authenticated editor session => active studio required

### 2. Studio membership is authoritative

If a user is not a member of a studio, they must not be able to:

- browse its projects
- load its assets
- import its platform projects
- generate against its data
- write to its editor-bound objects

### 3. Backend enforcement matters more than client intent

The renderer may send `studio_id`, but that must not be the primary protection model.

The server must:

- resolve effective studio context
- verify user membership
- reject mismatched objects even if the renderer sends a valid-looking id

### 4. Studio context must be visible and stable

The user should always be able to see:

- current studio
- whether studio context is resolved
- whether they are switching studios

And studio switching must trigger a clean scoped reload.

## Scope

This phase covers:

- auth/session studio selection
- backend studio resolution
- studio membership enforcement
- project, asset, idea-board, cast, and location scoping
- dashboard and import path scoping
- standalone app studio lifecycle

This phase does not cover:

- renderer modularization
- new AI generation features
- stage redesign
- document/spec rewrites beyond what is needed for correctness

## Required Product Decision

### Personal Workspace

One unresolved product question affects this phase:

- Is `Personal Workspace` a real tenant type?

There are two valid models.

#### Option A: Personal Workspace is real

If kept, define it explicitly as:

- a non-studio tenant type
- isolated from team studios
- with its own scope rules

That means the backend must model:

- tenant type = `studio` or `personal`

#### Option B: Personal Workspace is temporary only

If removed, then:

- authenticated editor sessions must always resolve a studio
- no authenticated editor route may proceed without active studio context

### Recommendation

For Phase 2, implement the backend so it can tolerate a temporary null studio only where explicitly allowed, but move the default product behavior toward:

- studio required

That keeps development flexible while preserving the correct direction.

## Desired Architecture

## Session Model

Authenticated editor session should expose:

```json
{
  "user": {
    "id": 5,
    "username": "JamesProctor"
  },
  "studios": [
    {
      "id": 12,
      "name": "Tinkerbox Studios",
      "role": "owner"
    }
  ],
  "current_studio_id": 12
}
```

## Effective Studio Resolution

Every studio-sensitive backend route should resolve studio context in this order:

1. explicit route resource relationship if the object itself already defines studio
2. authenticated session `current_studio_id`
3. explicit request `studio_id` only if used to select context or confirm context
4. dev fallback only if route explicitly allows it

Important:

- request `studio_id` should not override object ownership
- request `studio_id` should not bypass session membership

## Resource Ownership Model

The following objects should be treated as studio-owned unless explicitly marked otherwise:

- projects
- series
- episodes
- stories
- idea boards
- assets
- cast
- locations
- timelines
- exports
- editor sessions

## Backend Implementation Plan

## 1. Centralize Studio Resolution

Add or standardize helper functions in [api/v1/bootstrap.php](C:/wamp64/www/adventure/api/v1/bootstrap.php):

- `api_get_current_studio_id(): ?int`
- `api_set_current_studio_id(?int $studioId): void`
- `api_require_current_studio_id(): int`
- `api_user_has_studio_access(PDO $pdo, int $userId, int $studioId): bool`
- `api_require_studio_membership(PDO $pdo, int $userId, int $studioId): void`
- `api_resolve_effective_studio_id(PDO $pdo, int $userId, array $options = []): ?int`

`api_resolve_effective_studio_id(...)` should support:

- strict mode:
  - require studio and membership
- permissive mode:
  - allow null only for explicitly allowed routes
- object-bound mode:
  - derive studio from loaded object and verify current context matches

### Required Rule

Routes must call the helper.

They should not each implement their own studio logic ad hoc.

## 2. Audit All Editor Routes

Review every route in [api/v1/index.php](C:/wamp64/www/adventure/api/v1/index.php) and group them as follows.

### A. Studio-Selection / Auth Routes

Examples:

- login
- refresh
- select-studio

Expected behavior:

- these may operate before full studio context is active
- they are allowed to set context

### B. Studio-Scoped Read Routes

Examples:

- dashboard
- projects list
- project detail
- asset browsing
- series/episode outlines

Expected behavior:

- resolve effective studio
- require membership
- return only studio-owned resources

### C. Studio-Scoped Write Routes

Examples:

- create project
- create season
- create episode
- save idea board
- save timeline
- generation endpoints
- exports

Expected behavior:

- require current studio
- validate target resource belongs to that studio
- reject writes that try to cross studio ownership

### D. Resource-Bound Routes

Examples:

- `/editor/projects/{type}/{id}`
- `/editor/projects/{type}/{id}/idea-board`
- `/editor/projects/{type}/{id}/starting-images/generate`
- `/editor/projects/{type}/{id}/video-clips/generate`

Expected behavior:

- load resource
- determine actual studio from resource ownership
- verify resource studio matches current studio
- reject if current studio differs

This is stronger than simply trusting the request body.

## 3. Tighten Project Lookup Enforcement

[api_find_project(...)](C:/wamp64/www/adventure/api/v1/bootstrap.php) already started enforcing studio rules.

Phase 2 should make that pattern universal:

- every top-level project lookup should verify effective studio
- every subordinate lookup should inherit project studio
- helper objects like idea boards, timelines, and exports should not be loadable cross-studio

## 4. Studio-Scoped Listing Queries

Listing functions should never return mixed-scope data once a current studio is set.

Audit and tighten:

- `api_list_editor_projects(...)`
- dashboard summary queries
- platform import browsing
- studio summary queries

For each one:

- filter by studio ownership
- do not rely on the frontend to post-filter

## 5. Generation Route Enforcement

Generation routes are especially sensitive because they may:

- read project data
- create board items
- upload inputs
- create assets
- write outputs back

Audit and harden:

- starting images generate / refresh
- video clips generate / refresh
- bridge clips generate / refresh
- idea-board generate routes

Required behavior:

- resolve project studio from project lookup
- reject if current session studio does not match
- ensure created assets are associated with the same studio

## 6. Series / Episode Ownership Consistency

Phase 1 introduced:

- series container
- episode entry project

Phase 2 should make studio ownership explicit across that hierarchy.

Required invariant:

- series studio
- season studio
- episode studio
- entry editor project studio

must all match.

If any mismatch is discovered:

- treat it as invalid data
- return an error instead of silently accepting it

## Frontend Implementation Plan

## 1. Make Studio Context Blocking and Explicit

In [standalone-editor/renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js):

- keep the studio gate after login
- do not allow dashboard/editor views to initialize before studio context is resolved
- make studio switching a first-class flow

Expected behavior:

1. login succeeds
2. studios are loaded
3. user selects studio
4. dashboard loads in that studio context

## 2. Reduce the Role of `studio_id` in the Client

Right now the client appends `studio_id` broadly.

For Phase 2:

- keep sending it where useful for clarity
- but treat it as a hint, not the main guardrail

Update request wrapper expectations:

- if the backend says the current studio is invalid or missing, the client should reopen studio selection
- if a resource no longer belongs to current studio, the client should show a scope error and reset to a safe view

## 3. Clean Studio Switch Lifecycle

When user switches studio:

- clear platform modal state
- clear selected asset state
- clear editor selection state
- clear current project selection if the selected project does not belong to the new studio
- reload:
  - dashboard
  - project listings
  - studio screens
  - platform browse state

### Recommended helper

Add a dedicated function in [standalone-editor/renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js):

- `resetStateForStudioSwitch()`

This should centralize all state invalidation.

## 4. Visible Current Studio State

The top bar already shows studio context. Phase 2 should make this more authoritative.

Recommended additions:

- current studio badge
- clear switch-studio action
- error banner when current studio becomes invalid

## 5. Scope Errors Should Be First-Class

Instead of generic API failures, the client should recognize and surface:

- missing studio context
- unauthorized studio membership
- resource belongs to different studio

Example error language:

- `Select a studio to continue.`
- `You no longer have access to this studio.`
- `This project belongs to a different studio.`

## API Contract Adjustments

The following response fields should be treated as expected Phase 2 contract:

## Auth / Session

```json
{
  "user": {},
  "studios": [],
  "current_studio_id": 12
}
```

## Studio Selection

```json
{
  "ok": true,
  "current_studio_id": 12
}
```

## Scope Errors

All scope failures should normalize to:

```json
{
  "error": {
    "code": "studio_scope_invalid",
    "message": "This request is outside the current studio scope."
  }
}
```

Recommended codes:

- `studio_required`
- `studio_forbidden`
- `studio_scope_invalid`
- `resource_not_in_studio`

## Route Audit Checklist

Every editor route should be reviewed against this checklist.

### For each route, answer:

1. Does this route read studio-owned data?
2. Does this route write studio-owned data?
3. Does it derive studio from the session, request, or object?
4. Does it validate user membership?
5. Does it reject mismatched object ownership?
6. Does it return only studio-owned results?

If any answer is unclear, the route is not done.

## Concrete Route Groups To Audit

### Auth

- `/auth/editor-login`
- `/auth/refresh`
- `/auth/select-studio`

### Dashboard / Browse

- `/editor/dashboard`
- project list routes
- project detail routes

### Project Lifecycle

- create film / series / episode
- create season / episode within series
- import platform project

### Workflow

- idea board load/save/generate
- starting images generate/refresh
- video clips generate/refresh
- bridge clips generate/refresh

### Editor

- timeline load/save
- export create/list/status

### Libraries

- cast
- locations
- assets
- audio/music if covered by the editor API layer

## Database / Data Model Considerations

Phase 2 may expose missing ownership fields.

Audit whether each relevant table has:

- direct `studio_id`
- or a guaranteed ownership chain to an object that has `studio_id`

If a table has neither, it is a risk.

Priority examples:

- editor project mappings
- idea board mappings
- timelines
- exports
- generated asset references

The rule is:

- every writable object must either own or inherit studio identity deterministically

## Rollout Plan

## Step 1: Backend Helpers

Implement and standardize studio resolution helpers in [api/v1/bootstrap.php](C:/wamp64/www/adventure/api/v1/bootstrap.php).

Exit condition:

- all route handlers can call the same helper layer

## Step 2: Read Route Audit

Audit read routes first:

- dashboard
- project list
- project detail
- series outline

Exit condition:

- no read route returns cross-studio resources

## Step 3: Write Route Audit

Audit write routes:

- create/update project
- generation routes
- save routes

Exit condition:

- no write route accepts a resource outside current studio

## Step 4: Frontend Studio Lifecycle Hardening

Update [standalone-editor/renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js) to:

- treat studio as blocking context
- reset state cleanly on switch
- surface studio errors clearly

Exit condition:

- studio switching is stable and intentional

## Step 5: Final Dev-Fallback Decision

Choose whether to keep or remove null-studio fallback.

Exit condition:

- product behavior is explicit, not ambiguous

## Validation Plan

## Backend Validation

Test cases:

1. user logs in and selects studio A
2. dashboard only returns studio A data
3. project from studio B cannot be opened while in studio A
4. generation route against studio B project fails
5. switching to studio B enables that project
6. series and episode entry project remain in the same studio

## Frontend Validation

Test cases:

1. login without current studio opens studio picker
2. selecting studio loads dashboard successfully
3. switching studio clears stale project state
4. stale selected project does not survive invalid scope
5. scope errors show meaningful notices

## Manual Regression Areas

After Phase 2 changes, re-test:

- dashboard
- project library
- series screen
- episodes screen
- project import
- idea board generation
- starting images generation
- video clip generation
- export flow

## Exit Criteria

Phase 2 is complete when:

- every editor request is studio-valid by backend enforcement
- the backend does not rely on the renderer as the primary scope protection
- users cannot cross studio boundaries accidentally
- current studio is visible and stable in the app
- studio switching performs a clean scoped reload
- scope failures return clear normalized errors

## Non-Goals

This phase does not require:

- renderer modularization
- new workflow-stage features
- new AI generation capabilities
- redesign of the editor UI

Those come later.

## Recommended File Targets

Primary:

- [api/v1/bootstrap.php](C:/wamp64/www/adventure/api/v1/bootstrap.php)
- [api/v1/index.php](C:/wamp64/www/adventure/api/v1/index.php)
- [standalone-editor/renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js)

Secondary if needed:

- [database.sql](C:/wamp64/www/adventure/database.sql)
- [STANDALONE_EDITOR_API_CONTRACT.md](C:/wamp64/www/adventure/STANDALONE_EDITOR_API_CONTRACT.md)
- [STANDALONE_EDITOR_ARCHITECTURE.md](C:/wamp64/www/adventure/STANDALONE_EDITOR_ARCHITECTURE.md)

## Bottom Line

Phase 2 is about making the existing studio direction real.

The editor already looks studio-scoped in places. This phase makes that true at the architecture boundary.

If done correctly, it prevents a large class of permission, ownership, and scope bugs before the next growth phase.

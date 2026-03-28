# Standalone Editor Implementation Roadmap

Date: 2026-03-18

## Purpose

This document converts the coherence review into an execution roadmap.

It is focused on implementation order, architectural priorities, and the concrete areas of the codebase that should change next.

This is not a feature wishlist. It is a stabilization and product-foundation plan.

## Primary Goal

Move the standalone editor from:

- fast-moving prototype

to:

- stable, studio-scoped, story-first AI filmmaking product foundation

## Guiding Principles

1. Fix structural incoherence before adding major new surface area.
2. Align backend types with frontend product concepts.
3. Make studio scope universal and explicit.
4. Reduce renderer coupling before the next major growth phase.
5. Preserve the current core loop while making the architecture more durable.

## Phase 1: Backend Product Model Alignment

Status: Complete

### Goal

Make backend types and hierarchy match the product model already implied by the frontend.

### Why This Comes First

The frontend now treats `series`, `episode`, and `film` as valid concepts, but the backend still primarily supports `film` and `episode`.

That mismatch undermines everything else.

### Outcomes

- backend accepts the same top-level project types the frontend exposes
- project lookup and listing become consistent with UI
- series and episodes have a defined relationship
- idea promotion targets become well-defined

### Required Decisions

- Is `series` directly editable in the editor, or only through episodes?
- Does a promoted idea create:
  - a film
  - a series
  - or a series with an initial episode scaffold?

### Files To Update

- [api/v1/bootstrap.php](C:/wamp64/www/adventure/api/v1/bootstrap.php)
- [api/v1/index.php](C:/wamp64/www/adventure/api/v1/index.php)
- [database.sql](C:/wamp64/www/adventure/database.sql)
- [standalone-editor/renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js)

### Work Items

- expand backend allowed project types
- define `series -> episode` relationship in API payloads
- normalize project creation rules
- make project listing consistent across dashboard and platform browser
- make promote-to-project flow aware of `film` vs `series`

### Completed In This Phase

- backend now accepts `film`, `series`, and `episode` coherently
- `series` is backed by real API lookup/list/create behavior
- promoted `series` creates an initial scaffold:
  - `Series`
  - `Season 1`
  - `Episode 1`
  - linked story
  - entry episode editor project
- project payloads now expose:
  - `series_id`
  - `season_id`
  - `episode_id`
  - `entry_project_id`
  - `series_outline`
- standalone project promotion now explicitly supports:
  - `Promote to Film`
  - `Promote to Series`
  - `Promote to Episode`
- standalone studio screens now include:
  - `Series`
  - `Episodes`
  - series outline management
  - add season
  - add episode
  - open entry episode
- imported series now behave as series containers, while episodes remain the actual editing units

### Exit Criteria

- a project type shown in the UI is always valid in backend APIs
- a `series` no longer behaves like a UI-only label
- a `film`, `series`, and `episode` all have defined backend handling

## Phase 2: Universal Studio Scoping

Status: Complete

### Goal

Make studio context a first-class backend rule rather than a frontend convention.

### Why This Comes Second

The studio model is foundational. If it is left partial, the system will accumulate permission bugs, data ambiguity, and future migration pain.

### Outcomes

- every studio-sensitive API route enforces studio membership and studio context
- the editor never operates in ambiguous scope
- switching studios cleanly reloads scoped data

### Required Decisions

- Is `Personal Workspace` a real product concept?
- If yes, define it explicitly as a tenant type.
- If no, remove it and require studio selection always.

### Files To Update

- [api/v1/bootstrap.php](C:/wamp64/www/adventure/api/v1/bootstrap.php)
- [api/v1/index.php](C:/wamp64/www/adventure/api/v1/index.php)
- [standalone-editor/renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js)

### Work Items

- audit all editor API routes for studio enforcement
- stop relying on the renderer appending `studio_id` as the primary protection
- standardize current-studio resolution at the server boundary
- make asset, project, idea-board, cast, and location access consistently scoped
- finalize the launch-time studio selection flow

### Completed In This Phase

- backend now has shared studio-scope helpers for:
  - current studio resolution
  - studio membership validation
  - effective studio enforcement
- editor API routes now resolve studio context explicitly at the route boundary
- id-only routes are studio-aware:
  - timeline autosave
  - export completion
  - bridge clip refresh
- project-bound routes now use shared project-in-scope helpers instead of ad hoc lookup behavior
- scope errors are normalized around:
  - `STUDIO_REQUIRED`
  - `STUDIO_FORBIDDEN`
  - `RESOURCE_NOT_IN_STUDIO`
- the renderer now treats studio context as authoritative:
  - local projects carry `studioId`
  - studio switching resets stale editor state
  - local project lists are filtered by current studio
  - autosave/open/save are studio-aware
  - scope failures reopen studio selection cleanly

### Exit Criteria

- every editor request is studio-valid by backend enforcement
- users cannot cross studio boundaries accidentally
- studio context is visible, stable, and authoritative

## Phase 3: Renderer Modularization

Status: In Progress

### Goal

Break the renderer monolith into maintainable modules without breaking the current workflow.

### Why This Comes Third

The product now has enough moving parts that continuing inside one 9k-line renderer will keep producing regressions.

### Outcomes

- clearer ownership boundaries
- lower regression risk
- easier future AI/editor feature work

### Current Progress

- renderer modularization is actively underway
- major UI, workflow, studio, asset, and editor blocks have already been extracted into dedicated modules
- [renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js) has been reduced from roughly `9.5k` lines to `2947` lines
- the most recent extraction moved:
  - action dispatch
  - DOM event binding
  - shell composition
  - workflow stage rendering
  - editor workspace rendering
  - playback / timeline / inspector support
  - workflow draft and mutation state
  - editor / timeline state mutation
  - editor selection resolution
  - series / episode management

### Target Module Split

- auth and studio session
- API client
- dashboard and navigation
- project normalization and persistence
- script stage
- starting images stage
- video clips stage
- editor timeline
- inspector and AI tools
- assets library
- export and playback bridge

### Files To Create or Refactor

- [standalone-editor/renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js)
- new files under:
  - `standalone-editor/ui/`
  - `standalone-editor/state/`
  - `standalone-editor/workflow/`
  - `standalone-editor/editor/`
  - `standalone-editor/api/`

### Work Items

- extract API request and auth/session logic first
- extract workflow stages next
- extract timeline/editor logic after that
- leave `renderer.js` as composition/bootstrap only

### Started In This Phase

- created first extracted frontend helpers under:
  - [standalone-editor/state/app-state.js](C:/wamp64/www/adventure/standalone-editor/state/app-state.js)
  - [standalone-editor/api/client.js](C:/wamp64/www/adventure/standalone-editor/api/client.js)
  - [standalone-editor/api/auth-session.js](C:/wamp64/www/adventure/standalone-editor/api/auth-session.js)
  - [standalone-editor/api/platform-projects.js](C:/wamp64/www/adventure/standalone-editor/api/platform-projects.js)
  - [standalone-editor/state/project-normalization.js](C:/wamp64/www/adventure/standalone-editor/state/project-normalization.js)
  - [standalone-editor/state/project-persistence.js](C:/wamp64/www/adventure/standalone-editor/state/project-persistence.js)
  - [standalone-editor/state/project-selection.js](C:/wamp64/www/adventure/standalone-editor/state/project-selection.js)
  - [standalone-editor/studio/dashboard.js](C:/wamp64/www/adventure/standalone-editor/studio/dashboard.js)
  - [standalone-editor/studio/project-library.js](C:/wamp64/www/adventure/standalone-editor/studio/project-library.js)
  - [standalone-editor/studio/studio-picker.js](C:/wamp64/www/adventure/standalone-editor/studio/studio-picker.js)
  - [standalone-editor/studio/views.js](C:/wamp64/www/adventure/standalone-editor/studio/views.js)
  - [standalone-editor/assets/library.js](C:/wamp64/www/adventure/standalone-editor/assets/library.js)
  - [standalone-editor/workflow/project-pitch.js](C:/wamp64/www/adventure/standalone-editor/workflow/project-pitch.js)
- updated [standalone-editor/index.html](C:/wamp64/www/adventure/standalone-editor/index.html) to load those helpers before [standalone-editor/renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js)
- converted renderer ownership for:
  - app-state seeding
  - API request handling
  - auth/session serialization and application
  - dashboard/platform project orchestration
  - project normalization and studio-scoped filtering
  - project snapshot/load/create persistence helpers
  - project selection and studio synchronization helpers
  - dashboard summary/task derivation and rendering
  - studio project library / series / episodes rendering
  - studio context picker rendering
  - remaining studio shell views
  - asset library / asset detail rendering
  - project pitch and workflow placeholder rendering
- kept current runtime behavior and boot flow intact by using compatibility delegates from `renderer.js`
- continued extraction beyond the initial slice:
  - [standalone-editor/workflow/script.js](C:/wamp64/www/adventure/standalone-editor/workflow/script.js)
  - [standalone-editor/workflow/idea-board.js](C:/wamp64/www/adventure/standalone-editor/workflow/idea-board.js)
  - [standalone-editor/workflow/media-generation.js](C:/wamp64/www/adventure/standalone-editor/workflow/media-generation.js)
  - [standalone-editor/editor/timeline.js](C:/wamp64/www/adventure/standalone-editor/editor/timeline.js)
  - [standalone-editor/editor/playback.js](C:/wamp64/www/adventure/standalone-editor/editor/playback.js)
  - [standalone-editor/editor/inspector.js](C:/wamp64/www/adventure/standalone-editor/editor/inspector.js)
  - [standalone-editor/editor/actions.js](C:/wamp64/www/adventure/standalone-editor/editor/actions.js)
  - [standalone-editor/editor/editing.js](C:/wamp64/www/adventure/standalone-editor/editor/editing.js)
  - [standalone-editor/editor/workspace.js](C:/wamp64/www/adventure/standalone-editor/editor/workspace.js)
- renderer ownership has now moved further for:
  - script workspace rendering
  - idea board workspace rendering
  - starting images and video clips rendering
  - timeline render helpers
  - inspector selection summary formatting
  - playhead sync formatting/render helpers
  - preview rendering
  - playback timer ownership
  - transport button sync
  - playback stepping/start/stop/pause helpers
  - scene context derivation
  - scene completeness and continuity helpers
  - scene-segment derivation and binding
  - shot-planning helper generation
  - bridge clip actions
  - rough-cut assembly helpers
  - generated-clip-to-edit handoff
  - timeline movement and marker helpers
  - clip split / trim / transition mutation helpers
  - clip and asset class formatting
  - inspector value shaping
  - edit-stage workspace rendering
  - timeline/preview/inspector composition for the edit stage
- `renderer.js` is now materially shrinking rather than only delegating:
  - previous measured size before the latest timeline cut: `7542` lines
  - measured size after the timeline cut: `7314` lines
  - measured size after the playback cut: `7153` lines
  - measured size after the inspector/context cut: `6888` lines
  - measured size after the editor action cut: `6621` lines
  - measured size after the editing-helper cut: `6503` lines
  - current measured size after the edit-workspace cut: `6184` lines
  - current measured size after the shell/composition cut: `5843` lines
  - current measured size after auth/modal/render-utils cut: `5649` lines
  - current measured size after auth/session event cut: `5564` lines

### Exit Criteria

- no single renderer file owns the entire app
- workflow stages are isolated enough to change without breaking unrelated views

## Phase 4: Stage Separation and Workflow Hardening

### Goal

Make each workflow stage structurally independent and robust.

### Why This Comes Now

The core loop works, but stage coupling still causes layout and state regressions.

### Outcomes

- `Starting Images` and `Video Clips` no longer share brittle structure
- script, images, clips, and edit stages have clearer state ownership
- multi-clip-per-scene workflow is fully consistent across stages

### Files To Update

- [standalone-editor/renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js)
- [standalone-editor/styles.css](C:/wamp64/www/adventure/standalone-editor/styles.css)

### Work Items

- give `Video Clips` its own component structure and CSS classes
- stop reusing `starting-image-*` layout patterns where they no longer fit
- make script scene clips, starting-image seed selection, and video-clip request slots line up cleanly
- harden `Build Rough Cut` and `Finish & Open Edit`

### Exit Criteria

- each stage has its own stable layout system
- scene-to-clip mapping is consistent from script through edit

## Phase 5: Series / Episode Workflow Integration

### Goal

Make `Series` and `Episode` behave like real workflow entities, not labels.

### Outcomes

- a series can contain episodes in a visible structured way
- idea promotion can target a series cleanly
- episode editing and film editing are clearly distinguished

### Files To Update

- [standalone-editor/renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js)
- [api/v1/bootstrap.php](C:/wamp64/www/adventure/api/v1/bootstrap.php)
- [api/v1/index.php](C:/wamp64/www/adventure/api/v1/index.php)
- [STANDALONE_EDITOR_V1_FEATURE_SPEC.md](C:/wamp64/www/adventure/STANDALONE_EDITOR_V1_FEATURE_SPEC.md)

### Work Items

- add visible episode listing/selection for series projects
- define how the core loop operates inside an episode
- keep film workflow simpler than series workflow

### Exit Criteria

- `Series` means something operationally
- `Episode` is not just a renamed project

## Phase 6: Documentation Realignment

### Goal

Make the docs honest and implementation-aligned.

### Outcomes

- spec matches actual workflow
- architecture doc matches actual code structure
- API docs match actual routes and scope rules

### Files To Update

- [STANDALONE_EDITOR_V1_FEATURE_SPEC.md](C:/wamp64/www/adventure/STANDALONE_EDITOR_V1_FEATURE_SPEC.md)
- [STANDALONE_EDITOR_ARCHITECTURE.md](C:/wamp64/www/adventure/STANDALONE_EDITOR_ARCHITECTURE.md)
- [STANDALONE_EDITOR_API_CONTRACT.md](C:/wamp64/www/adventure/STANDALONE_EDITOR_API_CONTRACT.md)
- [STANDALONE_EDITOR_API_CURRENT_STATE.md](C:/wamp64/www/adventure/STANDALONE_EDITOR_API_CURRENT_STATE.md)
- [STANDALONE_EDITOR_COHERENCE_REVIEW.md](C:/wamp64/www/adventure/STANDALONE_EDITOR_COHERENCE_REVIEW.md)

### Work Items

- update product hierarchy
- update studio-scoping rules
- update module breakdown
- separate target-state docs from current-state docs clearly

### Exit Criteria

- docs can be trusted as a real engineering reference again

## Implementation Priority Summary

### Highest Priority

1. backend product model alignment
2. universal studio scoping
3. renderer modularization

### Medium Priority

4. stage separation and workflow hardening
5. series/episode workflow integration

### Ongoing Priority

6. documentation realignment

## Immediate Task Breakdown

### Task Block A

Backend project-type alignment

- update allowed project types
- define series handling
- normalize project creation/listing/find rules

### Task Block B

Studio-scope enforcement audit

- inspect every editor route
- enforce current studio consistently
- remove ambiguous scope paths

### Task Block C

Renderer extraction pass 1

- extract auth and studio session
- extract API client
- extract top-level navigation state

### Task Block D

Workflow extraction pass 2

- extract script stage
- extract starting images stage
- extract video clips stage

### Task Block E

Timeline/editor extraction pass 3

- extract timeline rendering
- extract inspector logic
- extract AI scene actions

## Risks If This Roadmap Is Not Followed

If the team continues adding features without addressing these structural issues, the likely outcomes are:

- increasing regressions
- confusing project semantics
- studio-permission bugs
- harder onboarding for future contributors
- more expensive rewrite later

## Success Condition

This roadmap is successful when:

- the product model is consistent across UI, API, and database
- studio context is universal and enforced
- the core loop remains intact while the codebase becomes modular
- `Film`, `Series`, and `Episode` all behave predictably
- the docs match the actual system again

## Recommended Next Action

Start with Phase 1 immediately:

- backend product model alignment

That is the first dependency for everything else.

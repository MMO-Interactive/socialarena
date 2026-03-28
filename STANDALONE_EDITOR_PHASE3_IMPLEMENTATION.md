# Standalone Editor Phase 3 Implementation Guide

Date: 2026-03-19

Status: In Progress

## Purpose

This document defines the implementation target for Phase 3: renderer modularization.

Phase 1 aligned the product model.
Phase 2 made studio scope authoritative.
Phase 3 is about making the standalone editor maintainable enough to keep growing without constant regression.

This is not a generic refactor note. It is the implementation guide for how to break the renderer apart while keeping the current product working.

## Why Phase 3 Matters

The standalone editor currently works, but too much of the system lives in one file:

- auth
- studio session
- API client logic
- project normalization
- workflow stages
- timeline editing
- AI actions
- asset libraries
- export UI
- modal handling
- event binding

That is now the main structural risk in the app.

If new features continue landing in the current renderer shape:

- regressions will keep increasing
- stage-specific fixes will keep breaking unrelated screens
- AI/editor features will become slower to build
- studio/product rules will keep getting duplicated

Phase 3 fixes that.

## Phase 3 Goal

Turn the standalone frontend from:

- one oversized renderer with mixed responsibilities

into:

- a composition-based frontend where each subsystem has a clear owner

Without:

- breaking the current core loop
- changing the product model again
- rewriting the app from scratch

## Non-Goals

Phase 3 is not:

- a visual redesign
- a new feature phase
- a framework migration
- a TypeScript migration
- a rewrite to React/Vue/etc.

Stay in the current vanilla Electron renderer architecture.
The goal is separation of responsibility, not technology churn.

## Current Problem Statement

The current [renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js) mixes:

- state definition
- state mutation
- API orchestration
- persistence
- platform import
- stage rendering
- timeline rendering
- inspector formatting
- input handling
- keyboard shortcuts
- modal handling
- polling loops
- studio scope logic

That produces three main failure modes:

1. Local fixes have broad blast radius

Changing one stage often affects:

- selection state
- autosave
- editor layout
- asset browser behavior

2. Product rules are duplicated

Examples:

- studio scope assumptions
- project normalization
- series/episode logic
- stage progression logic

3. The file no longer expresses architecture

The implementation is real, but the structure no longer communicates the system clearly.

## Design Principles For Phase 3

1. Split by responsibility, not by arbitrary file size.
2. Extract stable foundations before volatile UI pieces.
3. Keep one shared state object for now.
4. Move logic behind module boundaries before changing behavior.
5. Preserve all existing external behavior unless a bug must be fixed.
6. Prefer pure helpers for formatting and derivation.
7. Keep DOM rendering functions near the feature they render.
8. Do not create circular dependencies.

## Target Frontend Module Structure

Create the following directories under:

- [standalone-editor](C:/wamp64/www/adventure/standalone-editor)

### 1. `state/`

Purpose:

- state shape
- normalization helpers
- persistence helpers
- selection helpers

Target files:

- [standalone-editor/state/app-state.js](C:/wamp64/www/adventure/standalone-editor/state/app-state.js)
- [standalone-editor/state/project-normalization.js](C:/wamp64/www/adventure/standalone-editor/state/project-normalization.js)
- [standalone-editor/state/project-persistence.js](C:/wamp64/www/adventure/standalone-editor/state/project-persistence.js)
- [standalone-editor/state/project-selection.js](C:/wamp64/www/adventure/standalone-editor/state/project-selection.js)

Owns:

- initial `state`
- `projects`
- project normalization
- studio-scoped local project filtering
- autosave/load/open/save file helpers

### 2. `api/`

Purpose:

- API request orchestration
- auth refresh
- studio-scope error handling
- platform import helpers

Target files:

- [standalone-editor/api/client.js](C:/wamp64/www/adventure/standalone-editor/api/client.js)
- [standalone-editor/api/auth-session.js](C:/wamp64/www/adventure/standalone-editor/api/auth-session.js)
- [standalone-editor/api/platform-projects.js](C:/wamp64/www/adventure/standalone-editor/api/platform-projects.js)
- [standalone-editor/api/generation.js](C:/wamp64/www/adventure/standalone-editor/api/generation.js)

Owns:

- `apiRequest`
- `refreshAuthSession`
- login/logout/refresh wrappers
- platform project import
- starting image/video clip/bridge API calls

### 3. `workflow/`

Purpose:

- stage-specific rendering and logic

Target files:

- [standalone-editor/workflow/idea-board.js](C:/wamp64/www/adventure/standalone-editor/workflow/idea-board.js)
- [standalone-editor/workflow/project-pitch.js](C:/wamp64/www/adventure/standalone-editor/workflow/project-pitch.js)
- [standalone-editor/workflow/script.js](C:/wamp64/www/adventure/standalone-editor/workflow/script.js)
- [standalone-editor/workflow/starting-images.js](C:/wamp64/www/adventure/standalone-editor/workflow/starting-images.js)
- [standalone-editor/workflow/video-clips.js](C:/wamp64/www/adventure/standalone-editor/workflow/video-clips.js)
- [standalone-editor/workflow/stage-shell.js](C:/wamp64/www/adventure/standalone-editor/workflow/stage-shell.js)

Owns:

- each workflow stage’s render helpers
- stage-specific mutations
- stage status/checklist computation
- stage actions

### 4. `editor/`

Purpose:

- timeline/editor feature set

Target files:

- [standalone-editor/editor/timeline.js](C:/wamp64/www/adventure/standalone-editor/editor/timeline.js)
- [standalone-editor/editor/scene-track.js](C:/wamp64/www/adventure/standalone-editor/editor/scene-track.js)
- [standalone-editor/editor/inspector.js](C:/wamp64/www/adventure/standalone-editor/editor/inspector.js)
- [standalone-editor/editor/playback.js](C:/wamp64/www/adventure/standalone-editor/editor/playback.js)
- [standalone-editor/editor/bridge-clips.js](C:/wamp64/www/adventure/standalone-editor/editor/bridge-clips.js)
- [standalone-editor/editor/transitions.js](C:/wamp64/www/adventure/standalone-editor/editor/transitions.js)

Owns:

- timeline rendering
- timeline selection
- track math
- playhead sync
- scene-track derivation
- inspector formatting for clip/scene selections
- bridge clip modal/actions

### Phase 3 Progress Snapshot

Extracted and live:

- `api/client.js`
- `api/auth-session.js`
- `api/platform-projects.js`
- `state/app-state.js`
- `state/project-normalization.js`
- `state/project-persistence.js`
- `state/project-selection.js`
- `state/workflow-state.js`
- `studio/dashboard.js`
- `studio/project-library.js`
- `studio/studio-picker.js`
- `studio/views.js`
- `assets/library.js`
- `workflow/project-pitch.js`
- `workflow/script.js`
- `workflow/idea-board.js`
- `workflow/media-generation.js`
- `editor/timeline.js`
- `editor/playback.js`
- `editor/inspector.js`
- `editor/actions.js`
- `editor/editing.js`
- `editor/workspace.js`
- `ui/shell.js`
- `ui/render-utils.js`
- `ui/modals.js`
- `ui/auth.js`
- `ui/events.js`

Renderer reduction status:

- previous measured size before timeline extraction: `7542` lines
- measured size after timeline extraction: `7314` lines
- measured size after playback extraction: `7153` lines
- measured size after inspector/context extraction: `6888` lines
- measured size after editor action extraction: `6621` lines
- measured size after editing-helper extraction: `6503` lines
- current measured size after edit-workspace extraction: `6184` lines
- current measured size after shell/composition extraction: `5843` lines
- current measured size after auth/modal/render-utils extraction: `5649` lines
- current measured size after auth/session event extraction: `5564` lines

That means Phase 3 is no longer only adding wrapper files. `renderer.js` is actively shrinking as extracted modules take ownership.

### 5. `studio/`

Purpose:

- dashboard/studio views
- studio picker
- series/episode container views

Target files:

- [standalone-editor/studio/dashboard.js](C:/wamp64/www/adventure/standalone-editor/studio/dashboard.js)
- [standalone-editor/studio/studio-picker.js](C:/wamp64/www/adventure/standalone-editor/studio/studio-picker.js)
- [standalone-editor/studio/project-library.js](C:/wamp64/www/adventure/standalone-editor/studio/project-library.js)
- [standalone-editor/studio/series.js](C:/wamp64/www/adventure/standalone-editor/studio/series.js)
- [standalone-editor/studio/episodes.js](C:/wamp64/www/adventure/standalone-editor/studio/episodes.js)

Owns:

- dashboard rendering
- studio-shell views
- series/episode management views
- studio selection gate

### 6. `assets/`

Purpose:

- asset library and asset details surfaces

Target files:

- [standalone-editor/assets/library.js](C:/wamp64/www/adventure/standalone-editor/assets/library.js)
- [standalone-editor/assets/details.js](C:/wamp64/www/adventure/standalone-editor/assets/details.js)
- [standalone-editor/assets/filters.js](C:/wamp64/www/adventure/standalone-editor/assets/filters.js)

Owns:

- media bin
- generated images/videos screens
- voice/music/brand asset screens
- asset filtering/tagging/review state

### 7. `ui/`

Purpose:

- shared UI helpers and app shell composition

Target files:

- [standalone-editor/ui/icons.js](C:/wamp64/www/adventure/standalone-editor/ui/icons.js)
- [standalone-editor/ui/shell.js](C:/wamp64/www/adventure/standalone-editor/ui/shell.js)
- [standalone-editor/ui/modals.js](C:/wamp64/www/adventure/standalone-editor/ui/modals.js)
- [standalone-editor/ui/notices.js](C:/wamp64/www/adventure/standalone-editor/ui/notices.js)
- [standalone-editor/ui/render-utils.js](C:/wamp64/www/adventure/standalone-editor/ui/render-utils.js)

Owns:

- shell/header rendering
- shared buttons/icons
- modal wrappers
- HTML escaping and small formatting helpers

## Module Ownership Rules

These rules are important.

### Rule 1

Only `api/` should know how to talk to:

- `window.editorShell.apiRequest`
- `window.editorShell.apiLogin`
- `window.editorShell.apiRefresh`
- `window.editorShell.apiLogout`

### Rule 2

Only `state/` should define:

- project normalization
- local project filtering
- autosave serialization shape

### Rule 3

Only `editor/` should own:

- timeline math
- scene-track derivation
- clip/track movement
- playhead behavior

### Rule 4

Only `workflow/` should own stage-specific business logic for:

- script
- starting images
- video clips

### Rule 5

`renderer.js` should end Phase 3 as:

- bootstrap
- wiring
- high-level render routing
- event delegation entrypoint

Not as the owner of every feature.

## Implementation Order

Do not modularize everything at once.

Use this sequence.

### Step 1: Extract Shared Foundations

Priority: Highest

Move first:

- auth/session logic
- API request wrapper
- project normalization
- autosave/load/save/open helpers
- studio-scoped project filtering

Reason:

These are cross-cutting and already stable enough to extract safely.

### Step 2: Extract Studio / Dashboard / Asset Views

Priority: High

Move next:

- dashboard rendering
- studio screens
- asset management screens

Reason:

These are broad but less entangled with timeline editing than the main editor.

### Step 3: Extract Workflow Stages

Priority: High

Move:

- idea board
- project pitch
- script
- starting images
- video clips

Reason:

Each stage is now substantial enough to deserve its own module.

### Step 4: Extract Editor Core

Priority: High

Move:

- timeline render logic
- scene track
- inspector
- playback
- bridge clips
- transitions

Reason:

This is the most complex subsystem and should be split after foundations are stable.

### Step 5: Thin Renderer Bootstrap

Priority: Final

Make [renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js) the composition shell only.

## Concrete Extraction Sequence

### Phase 3A

Create:

- `state/app-state.js`
- `state/project-normalization.js`
- `state/project-persistence.js`
- `api/client.js`
- `api/auth-session.js`

Move into those files:

- state definition helpers
- auth storage helpers
- studio selection lifecycle helpers
- API request wrapper
- auth refresh/session recovery logic

Current status:

- `state/app-state.js` created
- `api/client.js` created
- `api/auth-session.js` created
- `api/platform-projects.js` created
- `state/project-normalization.js` created
- `state/project-persistence.js` created
- `state/project-selection.js` created
- `studio/dashboard.js` created
- `studio/project-library.js` created
- `studio/studio-picker.js` created
- `studio/views.js` created
- `assets/library.js` created
- `workflow/project-pitch.js` created
- `workflow/script.js` created
- `workflow/media-generation.js` created
- `workflow/idea-board.js` created
- [standalone-editor/index.html](C:/wamp64/www/adventure/standalone-editor/index.html) now loads those helpers before [standalone-editor/renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js)
- renderer now delegates:
  - app-state seeding
  - API/auth-session
  - dashboard/platform project orchestration
  - project normalization
  - project persistence
  - project selection/studio synchronization
  - dashboard summary/task derivation and rendering
  - studio project library / series / episodes rendering
  - studio context picker rendering
  - remaining studio shell views
  - asset library / asset detail rendering
  - project pitch and workflow placeholder rendering
  - script export formatting
  - script stage rendering
  - starting images rendering
  - video clips rendering
  - idea board checklist and rendering
  through compatibility wrappers

Current note:

- `renderer.js` has now been reduced from the earlier ~9.6k peak to about ~7.5k lines
- the next extraction slice should move directly into the remaining workflow stage modules:
  - editor/timeline modules

### Phase 3B

Create:

- `assets/details.js`

Move:

- dashboard rendering
- studio screens
- asset-browser screens

### Phase 3C

Create:

- `workflow/script.js`
- `workflow/starting-images.js`
- `workflow/video-clips.js`
- `workflow/project-pitch.js`
- `workflow/idea-board.js`

Move:

- all stage renderers
- stage state helpers
- stage event-side mutation helpers

### Phase 3D

Create:

- `editor/timeline.js`
- `editor/scene-track.js`
- `editor/inspector.js`
- `editor/playback.js`
- `editor/bridge-clips.js`
- `editor/transitions.js`

Move:

- timeline rendering
- playhead sync
- clip movement/split/duplicate/delete
- inspector formatting
- bridge modal logic
- transition controls

## Import / Dependency Strategy

Keep dependencies directional.

Preferred dependency direction:

- `renderer.js`
  - imports from `state/`
  - imports from `api/`
  - imports from `studio/`
  - imports from `workflow/`
  - imports from `editor/`
  - imports from `ui/`

Avoid:

- `workflow/` importing `editor/`
- `editor/` importing `workflow/`
- `api/` importing `ui/`

If cross-domain access is needed:

- move that helper into `state/` or `ui/render-utils.js`

## State Strategy

Do not replace the current single app state in Phase 3.

Keep:

- one shared `state`
- one shared `projects`
- one top-level `render()`

But:

- move readers/mutators into modules
- pass state and helper refs explicitly where needed

That keeps risk lower.

## Event Strategy

Do not fully rewrite event binding.

Instead:

- keep the central delegated event handler
- move action handlers into grouped dispatchers

Recommended dispatcher split:

- `handleStudioAction(...)`
- `handleWorkflowAction(...)`
- `handleEditorAction(...)`
- `handleAssetAction(...)`
- `handleAuthAction(...)`

That is the intermediate step before deeper event modularization.

## Testing / Validation Plan

After each extraction step:

1. run:
   - `node --check standalone-editor/renderer.js`
   - `node --check` on every newly created module
2. launch the app
3. verify:
   - login/session restore
   - studio selection
   - dashboard
   - one workflow stage
   - editor timeline
   - asset screen

Do not wait until the end of Phase 3 to test.

## Regression Guardrails

These behaviors must remain intact throughout Phase 3:

- login works
- studio picker works
- project open/save/autosave works
- core loop still works:
  - script
  - starting images
  - video clips
  - edit
- platform import still works
- export still works

If any extraction threatens one of those, stop and stabilize before continuing.

## Exit Criteria For Phase 3

Phase 3 is complete when:

- [renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js) is reduced to bootstrap/composition responsibility
- stage logic no longer lives inline in one monolith
- studio/dashboard/assets/workflow/editor responsibilities are visibly separated
- adding a feature to one stage no longer requires touching unrelated stage code
- the app still passes the core end-to-end manual workflow checks

## What Not To Do

Do not:

- convert to a new frontend framework during Phase 3
- combine modularization with a visual redesign
- change backend product/studio rules again
- rename large parts of the domain model mid-refactor
- try to perfect every old helper before extraction

The goal is better structure, not endless cleanup.

## Immediate Next Action

Start Phase 3 with:

1. `api/client.js`
2. `api/auth-session.js`
3. `state/project-normalization.js`
4. `state/project-persistence.js`

That is the cleanest first slice because it removes the most duplicated cross-cutting logic with the least UI risk.

## Progress Update

Phase 3 is now materially underway.

Extracted and live:

- `api/client.js`
- `api/auth-session.js`
- `api/platform-projects.js`
- `state/app-state.js`
- `state/project-normalization.js`
- `state/project-persistence.js`
- `state/project-selection.js`
- `studio/dashboard.js`
- `studio/project-library.js`
- `studio/studio-picker.js`
- `studio/views.js`
- `assets/library.js`
- `workflow/project-pitch.js`
- `workflow/script.js`
- `workflow/idea-board.js`
- `workflow/media-generation.js`
- `editor/timeline.js`
- `editor/playback.js`
- `editor/inspector.js`
- `editor/actions.js`
- `editor/editing.js`
- `editor/workspace.js`
- `ui/shell.js`
- `ui/render-utils.js`
- `ui/modals.js`
- `ui/auth.js`
- `ui/events.js`
- `ui/action-dispatch.js`
- `ui/bindings.js`

Measured renderer reduction:

- earlier renderer size during Phase 3: about `9.5k` lines
- current [renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js): `2947` lines

What remains in `renderer.js` now is mostly:

- top-level bootstrap and helper wiring
- remaining composition glue
- remaining local orchestration/polling and bootstrap helpers that have not yet been moved into dedicated modules

Next highest-value work:

1. continue removing remaining composition glue from [renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js)
2. split any remaining state mutation clusters into focused modules
3. finish reducing the renderer to bootstrap/composition responsibility only

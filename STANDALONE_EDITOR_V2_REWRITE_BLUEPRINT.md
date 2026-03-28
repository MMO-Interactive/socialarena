# Standalone Editor V2 Rewrite Blueprint

## Purpose

This document defines the rewrite plan for Standalone Editor V2.

V2 exists because V1 has reached the point where incremental repair is no longer the right strategy. The next version should not be a patch-over of the current renderer-driven shell. It should be a deliberate rebuild around a stable product boundary, a modular architecture, and an AI-native creative workflow.

V2 must:

- use the existing V1 API as its backend contract
- honor the web vs creator-app separation defined in [SOCIALARENA_WEB_VS_CREATOR_APP_BOUNDARY.md](C:/wamp64/www/adventure/SOCIALARENA_WEB_VS_CREATOR_APP_BOUNDARY.md)
- be modular from the beginning
- avoid monolithic files and monolithic classes
- treat AI generation as a first-class system concern, not an add-on
- ship around one flawless 7-step creative loop before expanding further

---

## Foundational Session Rule

Studio is the top-level container for every creator session.

That means:

- authentication is required before studio selection
- a studio is required before the creator workflow can load
- there is no personal mode in V2
- after authentication, if no current studio is resolved, the app must go directly to a studio-selection UI showing the authenticated user’s studios
- after authentication and studio resolution, the first screen must be a dashboard
- the user must be able to switch studios from inside an active session
- the editor must not allow the user into the workflow shell until studio context exists

V2 should treat studio scope as foundational session state, not a secondary filter applied after the app has already loaded.

---

## Product Rule

V2 is not a general-purpose shell with many partially working surfaces.

V2 is an AI-native creator application with one primary job:

`Idea -> Pitch -> Script -> Starting Images -> Video Clips -> Edit -> Export/Release`

Everything in V2 should either:

- directly support that loop
- review or validate work inside that loop
- provide infrastructure required to keep that loop stable

Anything outside that should be deferred until the 7-step loop is reliable.

---

## Non-Negotiable Principles

### 1. One Platform, Two Clients

V2 must follow the product boundary already established:

- web platform = management, review, operations, approvals, analytics, publishing coordination
- standalone creator app = creation, generation, editing, export preparation

V2 should not reintroduce product confusion by rebuilding web-like management features into the editor.

### 1A. Studio-Scoped Session Is Mandatory

The creator app must not operate without studio context.

Required behavior:

- launch -> auth/session restore
- if the user is not authenticated, show login/authentication UI first
- after authentication, fetch or restore the user’s studio list
- if `currentStudioId` exists, continue
- if `currentStudioId` does not exist, show studio selection UI immediately using the user’s actual studios
- after studio selection, land on dashboard first
- allow studio switching from the active dashboard or workflow shell
- do not render the workflow shell in a personal fallback mode

This rule applies before project loading, workflow loading, asset loading, or generation loading.

### 2. Modular From Day One

No new monoliths.

Specifically:

- no giant `renderer.js`
- no giant `app.js`
- no single controller class that owns everything
- no file that becomes the hidden owner of state, rendering, events, and API orchestration at once

Every module must have a narrow responsibility.

### 3. AI Is Foundational

AI generation must not be treated as “buttons attached to an editor.”

The editor itself must assume:

- scenes carry generation context
- clips can be generated, extended, bridged, replaced, and reviewed
- continuity context matters
- prompts are derived from structured story state
- generation status is part of the editing model

V2 should think in:

`Story -> Scene -> Shot -> Clip -> Timeline`

Not:

`Asset -> Timeline`

### 4. Seven-Step Workflow Is Canonical

The following process is the product backbone:

1. Idea Board
2. Idea Pitch
3. Script
4. Starting Image Generation
5. Clip Generation
6. Edit
7. Export / Release

V2 succeeds only when this sequence is coherent, dependable, and pleasant to use end to end.

### 5. Add Nothing Major Until the Core Loop Is Stable

Do not expand V2 with secondary features until the 7-step workflow is:

- reliable
- understandable
- studio-scoped
- API-consistent
- recoverable after errors
- internally coherent

---

## Scope of V2

## In Scope

- authenticated studio-scoped standalone creator app
- local project persistence plus platform sync
- end-to-end 7-step workflow
- AI generation orchestration for starting images and video clips
- timeline editing and rough cut assembly
- export preparation and export lifecycle
- scene metadata and shot planning as native concepts
- review-ready status tracking inside the editor

## Out of Scope for Initial V2

- large studio management surfaces
- messaging/discussion systems
- billing/admin
- publishing dashboards
- marketplace behavior
- advanced collaboration overlays
- speculative side workflows outside the 7-step loop

These belong to web or to a later V2.x, not the first V2 milestone.

---

## V2 Product Architecture

V2 should be organized around four top-level product domains.

### 1. Session Domain

Owns:

- auth session
- studio context
- user identity
- permissions context
- platform connection state

### 2. Project Domain

Owns:

- local project documents
- normalization
- persistence
- import/export of local files
- current project selection
- project sync state

### 3. Workflow Domain

Owns:

- the 7-step process
- stage transitions
- stage completeness
- stage validation
- story/scene/clip data used by the workflow

### 4. Editor Domain

Owns:

- timeline
- inspector
- preview/playback
- asset attachment inside the edit stage
- AI-aware edit actions like bridge clip, next shot, cutaway, extend shot

---

## V2 Technical Architecture

V2 should use small modules grouped by domain, not by random utility convenience.

Recommended structure:

```text
standalone-editor-v2/
  app/
    bootstrap.js
    app-shell.js
    router.js
    lifecycle.js

  session/
    session-store.js
    auth-client.js
    studio-context.js
    permissions.js

  api/
    client.js
    endpoints/
      auth.js
      dashboard.js
      projects.js
      idea-board.js
      script.js
      starting-images.js
      video-clips.js
      timeline.js
      exports.js

  project/
    project-store.js
    project-normalizer.js
    project-persistence.js
    project-import.js
    project-sync.js

  workflow/
    workflow-store.js
    workflow-engine.js
    stage-registry.js
    stages/
      idea-board/
        state.js
        actions.js
        view.js
        selectors.js
      idea-pitch/
        state.js
        actions.js
        view.js
        selectors.js
      script/
        state.js
        actions.js
        view.js
        selectors.js
      starting-images/
        state.js
        actions.js
        polling.js
        view.js
        selectors.js
      video-clips/
        state.js
        actions.js
        polling.js
        view.js
        selectors.js
      edit/
        state.js
        actions.js
        view.js
        selectors.js
      export-release/
        state.js
        actions.js
        polling.js
        view.js
        selectors.js

  editor/
    timeline/
      state.js
      actions.js
      selectors.js
      layout.js
      renderer.js
    inspector/
      state.js
      actions.js
      selectors.js
      renderer.js
    playback/
      controller.js
      renderer.js
    assets/
      state.js
      actions.js
      selectors.js
      renderer.js
    ai/
      scene-context.js
      prompt-building.js
      continuity.js
      generation-actions.js

  ui/
    components/
    layout/
    modals/
    notifications/
    shared/

  state/
    event-bus.js
    command-bus.js
    selectors.js
```

---

## Module Rules

Every module must follow these rules.

### Rule 1. State, Actions, Selectors, View Are Separate

For every meaningful feature area:

- `state.js` owns shape/defaults
- `actions.js` owns mutation and side effects
- `selectors.js` owns read/computed state
- `view.js` or `renderer.js` owns markup/rendering only

No feature should mix all four in one file.

### Rule 2. API Calls Never Live in View Files

Views must not call the API directly.

Views dispatch actions.
Actions use endpoint modules.
Endpoint modules use the shared API client.

### Rule 3. No Hidden Global Mutation

All cross-feature updates should move through a known store or command/action layer.

Avoid:

- free-form mutation from arbitrary functions
- “just edit the project object in place from anywhere”
- mixed render + mutate helpers

### Rule 4. Polling Is Its Own Concern

Generation polling for:

- starting images
- video clips
- export

must live in dedicated `polling.js` files, not scattered through render logic or button handlers.

### Rule 5. Renderers Must Be Dumb

Renderer/view modules should assemble UI from already-derived state.

They should not:

- normalize project structures
- derive complex prompt context
- mutate workflow state
- call platform sync directly

---

## AI-Native Design Requirements

V2 must be explicitly AI-native.

That means the system model should include:

### Scene Context

Each scene should own:

- title
- summary
- objective
- location
- characters
- mood
- time of day
- camera style
- visual references
- continuity notes

### Shot Context

Each clip request or shot slot should own:

- shot title
- shot type
- prompt
- dialogue/narration
- motion/camera notes
- generation status
- generated takes
- approved take

### Generation Context

Generation actions should be built from:

- project context
- scene context
- adjacent scene context where relevant
- current clip/timeline context where relevant
- explicit user prompt overrides

### Continuity Context

The editor should always be able to reason about:

- scene continuity
- clip adjacency
- scene metadata completeness
- missing context that weakens generation quality

AI is not a side panel. It is one of the primary ways the editor understands the work.

---

## The Canonical Seven-Step Workflow

V2 should treat each stage as a first-class bounded domain.

## 1. Idea Board

Purpose:

- capture creative atoms before project commitment

Must support:

- structured board items
- categories like character/location/scene/style/clip/note
- prompt preview
- generation history review
- save/load

Exit condition:

- enough board context exists to pitch the project cleanly

## 2. Idea Pitch

Purpose:

- convert the board into a promotable concept

Must support:

- format selection: film / series / episode where valid
- logline
- concept
- audience
- tone
- visual style
- references
- success criteria
- explicit promotion target

Exit condition:

- the project is promoted and structurally valid

## 3. Script

Purpose:

- create scene-by-scene, clip-aware script structure

Must support:

- scene creation/removal/reorder
- scene metadata
- characters-in-scene
- multiple clips per scene
- per-clip dialogue/narration
- per-clip prompts
- human-readable script export

Exit condition:

- scenes and clip slots exist with enough detail to generate visuals

## 4. Starting Image Generation

Purpose:

- generate anchor visuals per scene

Must support:

- request generation through the V1 API
- polling and refresh
- returned variations
- approve one anchor image per scene

Exit condition:

- every target scene has an approved starting frame

## 5. Clip Generation

Purpose:

- generate scene clips from approved scene images and clip prompts

Must support:

- per-scene, per-clip-slot generation
- queued / generating / ready / failed states
- returned takes
- choosing a preferred take
- rough cut handoff

Exit condition:

- every required clip slot has a preferred generated take or explicit placeholder status

## 6. Edit

Purpose:

- assemble and refine the story

Must support:

- timeline
- scene track / narrative track
- media tracks
- preview
- inspector
- clip replacement
- bridge clips
- next shot / cutaway / extend shot actions
- rough cut generation from selected takes

Exit condition:

- project is edit-complete enough for export/release

## 7. Export / Release

Purpose:

- prepare and deliver the final production output

Must support:

- export settings
- export queue/progress
- completion/failure handling
- release metadata handoff

Exit condition:

- export succeeds and the release handoff state is clear

---

## V2 and the V1 API

V2 must use the existing V1 API as the initial backend contract.

That means:

- no backend rewrite is required to start V2
- endpoint modules should wrap V1 API routes cleanly
- V2 should introduce an internal client contract layer so UI code never knows V1 route details directly

Recommended rule:

- V1 API remains the transport contract
- V2 frontend defines its own typed endpoint wrappers and normalized result shapes

Example:

- `api/endpoints/video-clips.js`
  - `generateClip(projectRef, sceneRef, clipRef, payload)`
  - `refreshClip(projectRef, sceneRef, clipRef)`

The rest of the app should never manually construct raw route strings.

---

## Studio Scoping Requirements

V2 must preserve the studio-scoped architecture.

Required behavior:

- login/authentication comes first
- editor cannot operate without studio context
- studio selection is a hard session gate, not an optional topbar control
- studio selection UI must be based on the authenticated user’s real studios, not a raw fallback text field
- dashboard is the first post-auth, post-studio destination
- switching studios must be a first-class session action
- session/store owns `currentStudioId`
- project browser only shows studio-scoped records
- local persisted project records carry studio identity
- API endpoint wrappers always operate in studio context
- studio switches clear invalid live project state safely

There should be no “silent fallback” into ambiguous workspace state and no personal-mode bypass.

---

## V2 Data Model Priorities

V2 should normalize around these entities:

- `Studio`
- `Project`
- `Film`
- `Series`
- `Episode`
- `IdeaBoard`
- `Scene`
- `ShotSlot`
- `GeneratedTake`
- `TimelineItem`
- `ExportJob`

Important rule:

- scene and shot-slot data should exist independent of timeline items
- timeline items are editorial realizations of scene/shot state, not the story itself

---

## Rewrite Strategy

Do not rewrite everything at once without milestones.

Use staged delivery.

## Phase A. Foundation

Build:

- app bootstrap
- session/store
- studio context
- API client and endpoint wrappers
- project store and persistence
- workflow engine and stage registry

No advanced UI first. Get architecture correct.

## Phase B. Canonical Workflow UI

Build only the 7-step surfaces:

- idea board
- idea pitch
- script
- starting images
- video clips
- edit
- export/release

No secondary studio screens unless they are required to support the main loop.

## Phase C. AI-Native Editing Layer

Build:

- scene track
- continuity panel
- next shot / cutaway / extend shot
- bridge clip
- shot planning

These should sit naturally in the editor model, not as plugin-like features.

## Phase D. Hardening

Focus on:

- sync reliability
- error handling
- recovery from failed generation
- local persistence integrity
- stage completeness validation
- render performance

## Phase E. Expansion

Only after the 7-step loop is stable:

- additional review-only surfaces
- secondary creative helpers
- richer asset workflows
- extended collaboration hooks

---

## Success Criteria for V2

V2 is successful when:

- the editor is modular by construction
- no central file becomes a new monolith
- the 7-step workflow works end to end without broken handoffs
- AI generation feels native to story, scene, shot, and timeline
- studio scope is reliable
- the V1 API is consumed through clean endpoint modules
- the product boundary with web remains clear

---

## Failure Conditions

V2 should be considered off-track if:

- one new file starts becoming the new renderer monolith
- workflow stages share uncontrolled mutable state
- API calls start leaking back into UI render files
- AI generation is implemented as isolated button logic without scene/shot context
- side features are prioritized before the 7-step loop is stable
- desktop starts reabsorbing web management concerns

---

## Immediate Next Steps

1. Freeze V1 feature expansion except for break/fix work.
2. Define the V2 folder structure in a new root or clearly isolated app directory.
3. Implement the V2 foundation first:
   - session store
   - authentication flow
   - studio selection flow
   - studio context
   - API client
   - endpoint wrappers
   - project store
   - workflow engine
4. Build the 7-step workflow screens in order.
5. Add AI-native scene/shot/timeline features only after the baseline loop is functioning.

---

## Final Position

V2 should not be “V1 but cleaner.”

It should be a deliberate creator application built around one clear promise:

`SocialArena Creator App is the AI-native place where films and series are actually made.`

The architecture, workflow, module boundaries, and feature priorities must all reinforce that.

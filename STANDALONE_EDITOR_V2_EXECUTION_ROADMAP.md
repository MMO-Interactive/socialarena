# Standalone Editor V2 Execution Roadmap

Date: 2026-03-28

## Purpose

This document turns the V2 blueprint and the current progress review into an execution plan.

The goal is not to brainstorm features. The goal is to finish V2 in the right order so the product becomes a dependable AI-native film production system built on the V1 API.

This roadmap assumes the current V2 direction is correct:

- studio-scoped session first
- modular architecture from the start
- one canonical seven-step workflow
- scene-first production model
- AI generation as part of the system core, not attached afterward

---

## Current Position

V2 is already materially real.

What is already in place:

- authenticated studio-scoped session flow
- dashboard-first entry after auth and studio selection
- modular codebase split into:
  - `api/`
  - `app/`
  - `session/`
  - `state/`
  - `workflow/`
- seven-stage workflow structure
- real stage implementations for:
  - `Idea Board`
  - `Idea Pitch`
  - `Script`
  - `Starting Image Generation`
  - `Clip Generation`
  - `Edit`
  - `Export / Release`
- a scene-first editor direction:
  - active scene
  - scene grouping
  - slot visibility
  - placement types
  - generated clip traceability

What is still incomplete:

- persistence and rehydration are uneven
- local state is stronger than remote durability
- timeline mechanics are still early
- the scene/shot/clip model is stronger in UI than in saved contract
- reopen/recovery behavior is not yet dependable enough

---

## Success Criteria For V2

V2 should only be considered successful when all of the following are true:

1. A user can authenticate, select a studio, land on dashboard, open or create a project, and complete the full seven-step workflow without losing state.
2. `Idea Board`, `Idea Pitch`, `Script`, `Starting Images`, `Clip Generation`, `Edit`, and `Export / Release` can all be reopened from saved project state with coherent rehydration.
3. The editor treats scenes as foundational containers and not as optional labels.
4. Timeline placements always have an explicit role.
5. The app remains modular and no new monolithic owner file emerges.
6. The V1 API is used consistently enough that V2 can ship before a backend rewrite is required.

---

## Critical Path

The critical path for V2 is:

1. persistence and rehydration
2. scene/shot/slot orchestration
3. editor mechanics
4. saved-state recovery and restore
5. polish and reliability

That means the next work should not be broad feature growth.

It should be:

- making the existing seven-step loop durable
- making scene-first orchestration real
- making the editor operationally complete enough to finish work

---

## Phases

## Phase 1: Persistence And Rehydration

### Objective

Make the seven-step workflow durable across save, reopen, reload, and stage transitions.

### Why This Is First

Right now the biggest product risk is not UI. It is that some of the strongest V2 ideas still live mostly in local derived state.

Until persistence is consistent, the product cannot be trusted.

### Primary Targets

- [state/project-workspace.js](C:/wamp64/www/adventure/standalone-editor-v2/state/project-workspace.js)
- [app/project-controller.js](C:/wamp64/www/adventure/standalone-editor-v2/app/project-controller.js)
- [api/endpoints/projects.js](C:/wamp64/www/adventure/standalone-editor-v2/api/endpoints/projects.js)
- [workflow/stages/idea-pitch/actions.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stages/idea-pitch/actions.js)
- [workflow/stages/script/actions.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stages/script/actions.js)
- [workflow/stages/edit/actions.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stages/edit/actions.js)

### Work

1. Define one canonical project save shape for V2 local state.
2. Persist pitch draft and applied pitch state into project data.
3. Persist script scenes, clips, and scene confidence state into project data.
4. Persist edit draft state:
   - timeline placements
   - active scene
   - selected media metadata
   - placement types
   - scene-grouped lane state
5. Rehydrate all of the above on project open.
6. Reconcile derived state versus saved state:
   - what is stored directly
   - what is rebuilt
   - what is temporary UI state only

### Exit Criteria

- closing and reopening a project restores:
  - pitch
  - script
  - starting image approvals
  - clip generation state
  - timeline placements
  - export history summary
- switching stages does not silently discard work
- local restore behavior is predictable and explainable

---

## Phase 2: Scene / Shot / Slot Canonicalization

### Objective

Make the scene-first AI production model the actual operating model of V2, not just a UI direction.

### Why This Is Second

This is the differentiator.

If scenes do not actually own shot intent and slot fulfillment, V2 drifts back toward a generic AI editor.

### Primary Targets

- [workflow/pipeline-intelligence.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/pipeline-intelligence.js)
- [workflow/stages/script/state.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stages/script/state.js)
- [workflow/stages/script/actions.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stages/script/actions.js)
- [workflow/stages/clip-generation/state.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stages/clip-generation/state.js)
- [workflow/stages/clip-generation/view.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stages/clip-generation/view.js)
- [workflow/stages/edit/view.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stages/edit/view.js)

### Work

1. Formalize a canonical local model:
   - `scene`
   - `shot_slot`
   - `clip_request`
   - `generated_take`
   - `timeline_placement`
2. Make `Generate Entire Scene` create a real execution package:
   - shot plan
   - clip slots
   - request priority/state
3. Make slot pills fully action-aware:
   - `missing` -> generate
   - `planned` -> queue
   - `generated` -> review
   - `fulfilled` -> replace/regenerate
4. Ensure generated takes keep traceability:
   - prompt
   - shot notes
   - shot role
   - planning source
5. Make scene confidence operational:
   - score
   - state
   - reason breakdown

### Exit Criteria

- every planned shot in a scene has an identifiable slot
- every generated clip request resolves back to a scene and slot
- the editor can answer:
  - what this clip is for
  - what scene it belongs to
  - whether the scene is complete

---

## Phase 3: Editing Engine Completion

### Objective

Turn the `Edit` stage from a strong orchestration shell into a usable production editing engine.

### Why This Is Third

V2 already has the right conceptual editor. It now needs the minimum mechanics required to finish actual work.

### Primary Targets

- [workflow/stages/edit/state.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stages/edit/state.js)
- [workflow/stages/edit/actions.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stages/edit/actions.js)
- [workflow/stages/edit/view.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stages/edit/view.js)
- [styles.css](C:/wamp64/www/adventure/standalone-editor-v2/styles.css)

### Work

1. Add reliable clip selection behavior across all lanes.
2. Add reorder/move behavior for timeline placements.
3. Add split.
4. Add trim start and trim end.
5. Add replace-in-slot workflow.
6. Add scene move behavior:
   - moving a scene moves its owned narrative placements
7. Add playhead-driven editing:
   - playhead visibility
   - position-aware operations
8. Improve preview/program monitor behavior so playback feels tied to timeline context, not just selected media.

### Exit Criteria

- the editor supports meaningful rough-cut assembly work
- narrative clips can be moved, split, trimmed, and replaced
- scene ownership remains intact while editing
- the timeline behaves like one coherent editing surface

---

## Phase 4: Platform Contract Hardening

### Objective

Stabilize how V2 uses the V1 API so local scene-first behavior and platform-backed data stop drifting apart.

### Why This Is Fourth

The V1 API is the contract V2 must ship against. That means ambiguity in saved shape or remote ownership will become operational debt if not tightened.

### Primary Targets

- [api/client.js](C:/wamp64/www/adventure/standalone-editor-v2/api/client.js)
- [api/endpoints/projects.js](C:/wamp64/www/adventure/standalone-editor-v2/api/endpoints/projects.js)
- [api/endpoints/starting-images.js](C:/wamp64/www/adventure/standalone-editor-v2/api/endpoints/starting-images.js)
- [api/endpoints/video-clips.js](C:/wamp64/www/adventure/standalone-editor-v2/api/endpoints/video-clips.js)
- [api/endpoints/exports.js](C:/wamp64/www/adventure/standalone-editor-v2/api/endpoints/exports.js)
- [app/project-controller.js](C:/wamp64/www/adventure/standalone-editor-v2/app/project-controller.js)

### Work

1. Make project save/load shape versioned.
2. Normalize how stage payloads merge into project data.
3. Ensure all saved remote project loads can rebuild:
   - pitch
   - script
   - starting images
   - clip generation
   - edit timeline
4. Define authoritative ownership rules:
   - what comes from V1 API
   - what V2 derives locally
   - what V2 persists back into project payloads
5. Harden studio-scoped access and stale-project recovery.

### Exit Criteria

- remote project open is reliable
- stage rehydration from platform data is coherent
- save/open behavior does not depend on hidden local-only assumptions

---

## Phase 5: Reliability, Recovery, And Product Tightening

### Objective

Make the seven-step loop dependable enough for repeated use, not just impressive in a single run.

### Why This Is Fifth

Once persistence, orchestration, and editing are in place, the biggest remaining differentiator is reliability.

### Primary Targets

- [app/lifecycle.js](C:/wamp64/www/adventure/standalone-editor-v2/app/lifecycle.js)
- [app/workspace-controller.js](C:/wamp64/www/adventure/standalone-editor-v2/app/workspace-controller.js)
- [session/session-store.js](C:/wamp64/www/adventure/standalone-editor-v2/session/session-store.js)
- stage-specific `actions.js` modules

### Work

1. Add robust error messaging at stage boundaries.
2. Add autosave strategy where safe.
3. Harden project reload and crash recovery.
4. Ensure stage entry hooks always rehydrate what they need.
5. Tighten workflow notices and action feedback so users understand system state.
6. Remove remaining placeholder behavior and ambiguous labels.

### Exit Criteria

- the user can recover from stage errors without losing work
- saved projects restore cleanly after restart
- the seven-step loop feels intentional and dependable, not fragile

---

## Delivery Order Inside The Phases

### Immediate Order

1. Phase 1
2. Phase 2
3. Phase 3
4. Phase 4
5. Phase 5

### Why This Order Is Correct

- durability before sophistication
- canonical model before advanced editing
- editing completion before contract hardening would be risky
- reliability/polish last, after structural work is stable

---

## Guardrails

These rules should stay in force during the rewrite.

### 1. No New Monoliths

If a new module starts becoming the hidden owner of:

- state
- rendering
- API orchestration
- event handling

split it before it becomes V1 again.

### 2. No Major Feature Growth Outside The Seven-Step Loop

Do not expand into:

- studio ops
- messaging
- publishing management
- broad analytics

until the seven-step loop is dependable.

### 3. No Regression To Clip-First Thinking

The correct product model remains:

`Scene -> Shot Slot -> Clip Request -> Generated Take -> Timeline Placement`

Not:

`Clip -> Timeline`

### 4. Timeline Placements Must Always Have A Role

The media bin can stay flexible.

The timeline cannot.

Every placement must have a declared purpose.

---

## Suggested Milestones

## Milestone A

`Projects reopen cleanly with pitch, script, and edit state restored`

### Required

- Phase 1 substantially complete

## Milestone B

`Scene generation packages are real and slot-driven across Script, Clip Generation, and Edit`

### Required

- Phase 2 substantially complete

## Milestone C

`The rough-cut editor supports actual editing work`

### Required

- Phase 3 substantially complete

## Milestone D

`Remote project save/open behavior is stable enough for serious use`

### Required

- Phase 4 substantially complete

## Milestone E

`The seven-step loop is dependable and product-ready`

### Required

- Phase 5 complete

---

## Recommended Immediate Next Work Block

The next correct implementation block is:

1. persist `Idea Pitch` into project data
2. persist `Script` into project data
3. persist `Edit` timeline state into project data
4. make project open rebuild all three cleanly

This is the right next block because it removes the biggest current product risk:

`strong workflow ideas with incomplete durability`

---

## Bottom Line

V2 no longer needs a product-definition phase.

It needs disciplined execution.

The product direction is already strong enough:

- studio-scoped
- modular
- seven-step
- scene-first
- AI-native

The next work must make it durable, operational, and recoverable so the product stops being an impressive prototype and starts becoming a dependable production system.

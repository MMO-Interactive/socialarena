# Standalone Editor V2 Progress Review

Date: 2026-03-28

## Findings

### High

1. V2 has a real modular foundation, but the seven-step workflow is not yet uniformly persisted through the V1 API.

The rewrite has clearly moved away from the V1 monolith. The V2 codebase is already split into:

- `api/`
- `app/`
- `session/`
- `state/`
- `workflow/`

That is the right architectural direction and materially better than V1.

However, persistence is uneven:

- `Idea Board` is clearly wired through platform save/load in [project-controller.js](C:/wamp64/www/adventure/standalone-editor-v2/app/project-controller.js)
- `Starting Images`, `Clip Generation`, and `Export / Release` have dedicated endpoint wrappers in:
  - [starting-images.js](C:/wamp64/www/adventure/standalone-editor-v2/api/endpoints/starting-images.js)
  - [video-clips.js](C:/wamp64/www/adventure/standalone-editor-v2/api/endpoints/video-clips.js)
  - [exports.js](C:/wamp64/www/adventure/standalone-editor-v2/api/endpoints/exports.js)

But `Idea Pitch`, `Script`, and most of `Edit` are still primarily local state flows inside:

- [project-workspace.js](C:/wamp64/www/adventure/standalone-editor-v2/state/project-workspace.js)
- [idea-pitch/actions.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stages/idea-pitch/actions.js)
- [script/actions.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stages/script/actions.js)
- [edit/actions.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stages/edit/actions.js)

That means the product boundary is strong, but the data durability is still partial. This is the biggest remaining product risk in V2.

2. The editor is now scene-first in intent, but scene ownership is still mostly a frontend state model rather than a backend-enforced model.

The strongest current V2 improvement is the move toward:

`Scene -> Shot Slot -> Clip Request -> Generated Take -> Timeline Placement`

This now shows up materially in:

- scene confidence
- generate-entire-scene scaffolding
- scene grouping in the timeline
- slot-level status pills
- placement types for timeline items

Relevant files:

- [pipeline-intelligence.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/pipeline-intelligence.js)
- [script/view.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stages/script/view.js)
- [clip-generation/view.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stages/clip-generation/view.js)
- [edit/view.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stages/edit/view.js)

But this is still mainly enforced in V2 state and UI, not yet as a saved cross-stage canonical backend model. The local model is coherent; the platform contract is not yet equally explicit.

3. `Edit` is becoming the orchestration engine it should be, but it still lacks true timeline editing operations.

The `Edit` stage is now much more than a placeholder:

- media import
- source vs sequence distinction
- scene lane
- grouped narrative/support lanes
- active scene
- placement types
- slot-level orchestration

That is real progress.

But it is still missing foundational editor operations:

- trim
- split
- reorder by drag or precise movement
- slip/replace workflows
- scene-span manipulation
- playhead-driven editing

So V2 now has the correct editing model, but not yet a mature editing engine.

### Medium

4. The V2 shell correctly enforces `Authentication -> Studio Selection -> Dashboard -> Workflow`, and this is one of the strongest parts of the rewrite.

This was a major architectural correction and it is now clearly reflected in:

- [session-store.js](C:/wamp64/www/adventure/standalone-editor-v2/session/session-store.js)
- [bootstrap.js](C:/wamp64/www/adventure/standalone-editor-v2/app/bootstrap.js)
- [lifecycle.js](C:/wamp64/www/adventure/standalone-editor-v2/app/lifecycle.js)
- [app-shell.js](C:/wamp64/www/adventure/standalone-editor-v2/app/app-shell.js)

This is coherent with the V2 blueprint and with the broader studio-scoped product direction.

5. The stage architecture is clear and matches the intended product boundary.

The canonical seven stages are explicitly defined in [stage-registry.js](C:/wamp64/www/adventure/standalone-editor-v2/workflow/stage-registry.js):

1. `Idea Board`
2. `Idea Pitch`
3. `Script`
4. `Starting Image Generation`
5. `Clip Generation`
6. `Edit`
7. `Export / Release`

This is one of the best parts of V2. The app now feels designed around a production pipeline, not a tool menu.

6. The app shell still carries some dashboard-era presentation weight that is stronger than the stage surfaces themselves.

The shell is much better than earlier V2 passes, but the main product value is increasingly inside stage-specific views, especially:

- `Script`
- `Clip Generation`
- `Edit`

That means future polish should bias toward deepening those workflow surfaces, not expanding shell flourish.

### Low

7. The module layout is already good enough to support further growth without repeating V1’s core renderer failure.

This matters.

V2 already avoids the central V1 problem. The current file structure demonstrates that the rewrite is not just cosmetic. It has already changed the ownership model of the app.

## What Is Working Well

### 1. The rewrite is real, not theoretical.

V2 is already a distinct modular application with:

- Electron app shell
- session domain
- workspace/project domain
- stage-specific workflow modules
- endpoint wrappers around the V1 API

That is a genuine rewrite foundation, not just a restyled V1.

### 2. The product identity is much clearer.

V2 now reads as:

`AI-native film production system`

instead of:

`editor plus generation buttons`

This is visible in the current `Script`, `Clip Generation`, and `Edit` stages.

### 3. The strongest conceptual improvement is the move from clip-centric editing to scene-driven orchestration.

The current V2 edit model now supports:

- scene ownership
- slot tracking
- placement types
- active scene context
- scene-grouped lanes

This is the right long-term differentiator.

## What Still Needs Improvement

### 1. Make persistence and rehydration consistent across all seven stages.

The next major milestone should be:

- pitch durability
- script durability
- edit/timeline durability
- reopen-project rehydration that fully restores stage state

This is the biggest remaining product gap.

### 2. Turn slot status into a full orchestration layer.

The timeline is already exposing slot status and slot navigation. The next step is to make slot actions explicit:

- `missing` -> generate shot
- `planned` -> queue clip generation
- `generated` -> review/select preferred take
- `fulfilled` -> replace/regenerate

This will make the timeline a control surface, not just an output view.

### 3. Finish the editing engine.

The scene-first model is good. The actual editing operations are still early.

The next meaningful edit work is:

- trim
- split
- reorder
- replace shot in slot
- scene move / scene delete behavior

### 4. Decide what is canonical between local project state and remote project state for V2.

Right now V2 has:

- strong local stage state
- partial remote stage persistence

That is a normal rewrite stage, but it should not remain ambiguous for long.

V2 needs one clear rule for:

- what is authoritative
- what is cached
- what gets re-derived
- what gets saved directly

## Overall Assessment

V2 is materially ahead of where V1 was structurally.

The rewrite is already succeeding in three important ways:

- studio-scoped session model is correct
- modular architecture is real
- the editor is becoming scene-first and AI-native in its core model

The main thing V2 still lacks is not product direction.
It lacks completion of the data contract and the editing engine behind that direction.

## Current Status

### Overall

V2 is not production-ready.

But it is no longer a shell of placeholders either.

It is best described as:

`an early but structurally coherent AI-native production system rewrite with real workflow and editor progress, but incomplete persistence and incomplete editor mechanics`

## Recommended Next Sequence

1. Finish cross-stage persistence for `Idea Pitch`, `Script`, and `Edit`
2. Make slot pills fully action-aware and generation-aware
3. Add true editing mechanics to the timeline
4. Tighten reopen/reload behavior so projects restore cleanly from saved state
5. Only after that, expand into additional AI orchestration or secondary studio features


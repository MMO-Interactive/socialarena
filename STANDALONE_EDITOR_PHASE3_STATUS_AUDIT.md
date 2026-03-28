# Standalone Editor Phase 3 Status Audit

## Purpose

This document audits the current state of Phase 3, focused specifically on the renderer modularization effort.

It answers:

- how much `renderer.js` has actually been reduced
- what still lives inside `renderer.js`
- what remains before Phase 3 can be considered complete
- what the highest-value remaining extraction work is

## Executive Summary

Phase 3 has made real progress.

The renderer is no longer a near-10k-line monolith. It has been reduced to a materially smaller file, and large portions of UI, workflow, studio, asset, playback, timeline, modal, and event logic have been extracted into dedicated modules.

Current measured size:

- [renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js): `2947` lines

This is a real reduction from the earlier Phase 3 baseline of roughly:

- about `9.5k` lines

That means the renderer has already been reduced by roughly:

- `65% to 70%`

However, Phase 3 is **not complete yet**.

The file is smaller, but it still owns too much state mutation, project shaping, workflow data construction, polling orchestration, and composition logic to be called a pure bootstrap/composition layer.

## Current Assessment

### What Has Gone Well

- large UI render blocks have been extracted
- the event binding layer has been extracted
- action dispatch has been extracted
- the editor workspace render block has been extracted
- workflow stage render blocks have mostly been extracted
- studio screens have mostly been extracted
- renderer line count is now actually going down, not just shifting sideways

### What Is Still True

`renderer.js` still acts as:

- app bootstrap
- app state owner
- project normalization and draft-state owner
- workflow data transformer
- polling coordinator
- composition orchestrator
- remaining business-logic glue layer

That is much better than before, but still not the Phase 3 end state.

## Current File Reality

## Measured Size

- [renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js): `2947` lines

## Still-Present Major Function Groups

The current renderer still contains large amounts of logic in these categories.

### 1. Project / Draft / State Construction

Examples:

- `createWorkflowState(...)`
- `createIdeaBoardState(...)`
- `createProjectPitchState(...)`
- `createScriptState(...)`
- `createStartingImagesState(...)`
- `createVideoClipsState(...)`
- `createVideoClipScene(...)`
- `createVideoClipRequest(...)`

These are not shell-level responsibilities. These belong in dedicated state/model modules.

### 2. Script and Workflow Data Mutation

Examples:

- `ensureScriptDraft(...)`
- `updateScriptField(...)`
- `addScriptScene(...)`
- `updateScriptScene(...)`
- `addScriptClip(...)`
- `updateScriptClip(...)`
- `removeScriptClip(...)`
- `removeScriptScene(...)`

These are still core workflow-state mutation helpers living in the renderer.

### 3. Starting Images and Video Clips State Mutation

Examples:

- `ensureStartingImagesDraft(...)`
- `ensureVideoClipsDraft(...)`
- `updateStartingImageScene(...)`
- `addStartingImageVariation(...)`
- `approveStartingImageVariation(...)`
- `removeStartingImageVariation(...)`
- `updateVideoClipRequest(...)`
- `addGeneratedVideoClip(...)`
- `approveGeneratedVideoClip(...)`
- `ensureGeneratedClipAsset(...)`
- `recomputeVideoClipSceneAggregate(...)`

These are business/state concerns and should not remain in the renderer long term.

### 4. Idea Board State Mutation

Examples:

- `createIdeaCard(...)`
- `updateIdeaCard(...)`
- `updateIdeaCardStructuredField(...)`
- `moveIdeaCard(...)`
- `connectIdeaCards(...)`
- `addIdeaCard(...)`
- `removeIdeaCard(...)`

The rendering of the idea board has been extracted, but the data mutation layer is still renderer-owned.

### 5. Studio and Project Selection Lifecycle

Examples:

- `projectBelongsToStudio(...)`
- `projectBelongsToCurrentStudio(...)`
- `getStudioScopedProjects(...)`
- `getProject(...)`
- `resetStateForStudioSwitch(...)`
- `synchronizeProjectSelectionToStudio(...)`
- `getCurrentStudioSummary(...)`

These are still meaningful ownership responsibilities inside the renderer.

### 6. Platform Normalization / Mapping

Examples:

- `normalizePlatformProject(...)`
- `normalizePlatformIdeaBoard(...)`
- `normalizePlatformAsset(...)`
- `normalizePlatformTimeline(...)`
- `serializeIdeaBoardForPlatform(...)`

Some API work has been extracted already, but the renderer still owns substantial platform-to-local mapping logic.

### 7. Polling and Async Workflow Coordination

Examples:

- `applyStartingImagePayload(...)`
- `queuedStartingImageScenes(...)`
- `stopStartingImagePolling(...)`
- `syncStartingImagePolling(...)`
- `queuedVideoClipRequests(...)`
- `stopVideoClipPolling(...)`
- `syncVideoClipPolling(...)`

This is still orchestration-heavy logic inside the renderer and should likely move into workflow-specific controllers.

### 8. Edit-Flow and Timeline Data Mutation

Examples:

- `createTimelineClipFromAsset(...)`
- `findSceneInsertIndex(...)`
- `recalculateTimelineDuration(...)`
- `appendAssetToTrack(...)`
- `replaceTimelineClipForScene(...)`
- `addSelectedAssetToTimeline(...)`
- `estimateWidth(...)`
- `loadImportedAssetMetadata(...)`

These are deeper editor-domain responsibilities, not render-only work.

### 9. AI / Story / Shot Planning Glue

Examples:

- `ensureVideoClipSceneForScriptScene(...)`
- `appendPlannedShots(...)`
- `getTimelineNeighbors(...)`
- `buildNextShotFromClip(...)`
- `buildCutawayFromClip(...)`
- `buildExtensionFromClip(...)`

Some of the heavy inspector helpers were extracted, but the renderer still owns meaningful story-to-edit glue.

### 10. Top-Level Render Composition

Examples:

- `render()`
- stage switching inside `render()`
- view routing between:
  - dashboard
  - studio views
  - asset views
  - editor stages

This is much smaller than before, but still central enough that the renderer is not yet just a bootstrap file.

## What Has Already Been Successfully Extracted

The following modules are already live and are reducing pressure on the renderer:

- [client.js](C:/wamp64/www/adventure/standalone-editor/api/client.js)
- [auth-session.js](C:/wamp64/www/adventure/standalone-editor/api/auth-session.js)
- [platform-projects.js](C:/wamp64/www/adventure/standalone-editor/api/platform-projects.js)
- [app-state.js](C:/wamp64/www/adventure/standalone-editor/state/app-state.js)
- [project-normalization.js](C:/wamp64/www/adventure/standalone-editor/state/project-normalization.js)
- [project-persistence.js](C:/wamp64/www/adventure/standalone-editor/state/project-persistence.js)
- [project-selection.js](C:/wamp64/www/adventure/standalone-editor/state/project-selection.js)
- [dashboard.js](C:/wamp64/www/adventure/standalone-editor/studio/dashboard.js)
- [project-library.js](C:/wamp64/www/adventure/standalone-editor/studio/project-library.js)
- [studio-picker.js](C:/wamp64/www/adventure/standalone-editor/studio/studio-picker.js)
- [views.js](C:/wamp64/www/adventure/standalone-editor/studio/views.js)
- [library.js](C:/wamp64/www/adventure/standalone-editor/assets/library.js)
- [project-pitch.js](C:/wamp64/www/adventure/standalone-editor/workflow/project-pitch.js)
- [script.js](C:/wamp64/www/adventure/standalone-editor/workflow/script.js)
- [idea-board.js](C:/wamp64/www/adventure/standalone-editor/workflow/idea-board.js)
- [media-generation.js](C:/wamp64/www/adventure/standalone-editor/workflow/media-generation.js)
- [timeline.js](C:/wamp64/www/adventure/standalone-editor/editor/timeline.js)
- [playback.js](C:/wamp64/www/adventure/standalone-editor/editor/playback.js)
- [inspector.js](C:/wamp64/www/adventure/standalone-editor/editor/inspector.js)
- [actions.js](C:/wamp64/www/adventure/standalone-editor/editor/actions.js)
- [editing.js](C:/wamp64/www/adventure/standalone-editor/editor/editing.js)
- [workspace.js](C:/wamp64/www/adventure/standalone-editor/editor/workspace.js)
- [shell.js](C:/wamp64/www/adventure/standalone-editor/ui/shell.js)
- [render-utils.js](C:/wamp64/www/adventure/standalone-editor/ui/render-utils.js)
- [modals.js](C:/wamp64/www/adventure/standalone-editor/ui/modals.js)
- [auth.js](C:/wamp64/www/adventure/standalone-editor/ui/auth.js)
- [events.js](C:/wamp64/www/adventure/standalone-editor/ui/events.js)
- [action-dispatch.js](C:/wamp64/www/adventure/standalone-editor/ui/action-dispatch.js)
- [bindings.js](C:/wamp64/www/adventure/standalone-editor/ui/bindings.js)

This is real progress and is the main reason the renderer has already dropped under 4k lines.

## Remaining Structural Problems

## 1. Renderer Still Owns Too Much Domain State

The biggest remaining issue is that the renderer is no longer mostly UI rendering, but it is still the place where too many domain mutations happen.

That means:

- workflow changes still frequently require touching the renderer
- project model changes still frequently require touching the renderer
- editor behavior changes still frequently require touching the renderer

This is better than before, but still not the intended Phase 3 end state.

## 2. Helper Wiring Is Still Very Large

The helper initialization block is still dense and large.

That is expected during modularization, but it is also a signal that the renderer still acts as the main dependency container for too many modules.

This is not fatal, but it means Phase 3 is not yet at the point where the renderer is “small and obvious.”

## 3. Some Delegates Are Still Thin Wrapper Noise

There are still a number of small wrapper functions that just forward to extracted helpers.

Those are not harmful, but they add line count and cognitive noise if they do not provide meaningful abstraction.

Examples:

- render-only delegates
- helper passthroughs
- selector passthroughs

Some should remain, but many can likely be reduced further once the next extraction layer is done.

## 4. Deprecated / Legacy Cleanup Still Exists

Examples:

- `deprecatedFormatSeriesMeta(...)`
- `deprecatedFormatSeriesMetaResolved(...)`

These should be audited and likely removed once confirmed unused.

## How Much Phase 3 Is Actually Complete

### Practical Estimate

By structure, not by line count alone:

- Phase 3 is roughly `70% to 80%` complete

### Why Not Higher

Because the hardest remaining work is not simple extraction anymore.

The remaining work is the more important kind:

- removing domain mutation clusters from the renderer
- reducing helper initialization complexity
- finishing the shift from “big composition-plus-logic file” to “true app bootstrap/composition layer”

## What Must Still Be Done To Finish Phase 3

## Task Group 1: Move Workflow State Mutation Out

Recommended new modules:

- `state/workflow/project-pitch-state.js`
- `state/workflow/script-state.js`
- `state/workflow/starting-images-state.js`
- `state/workflow/video-clips-state.js`
- `state/workflow/idea-board-state.js`

Move out:

- create/update/add/remove logic for workflow stages
- draft seeding
- scene/clip mutation helpers
- variation/take approval helpers

This is the highest-value remaining extraction.

## Task Group 2: Move Editor State Mutation Out

Recommended new modules:

- `editor/timeline-state.js`
- `editor/asset-to-timeline.js`
- `editor/clip-generation-sync.js`

Move out:

- timeline clip creation
- scene insert logic
- timeline recalculation
- generated clip insertion/replacement
- asset-to-track helpers

This is the second highest-value remaining extraction.

## Task Group 3: Move Polling / Async Orchestration Out

Recommended new modules:

- `workflow/starting-images-polling.js`
- `workflow/video-clips-polling.js`

Move out:

- queue inspection
- start/stop polling
- payload application
- polling lifecycle orchestration

These are controller responsibilities, not renderer responsibilities.

## Task Group 4: Reduce App Shell Composition Further

Possible module:

- `ui/app-router.js`

Move out:

- current view routing
- stage routing
- shell selection between dashboard / studio / asset / editor

The goal is for `render()` to become extremely small and obvious.

## Task Group 5: Clean Up Thin Delegates and Dead Helpers

Actions:

- remove obviously dead legacy helpers
- remove passthrough wrappers that no longer add value
- keep only delegates that meaningfully stabilize boundaries

This is lower-value than extraction of domain state, but necessary to truly finish the phase cleanly.

## Recommended Remaining Phase 3 Sequence

### Step 1

Extract workflow state mutation.

This will remove the largest remaining non-render responsibility from the renderer.

### Step 2

Extract editor/timeline mutation helpers.

This will remove the biggest remaining edit-domain logic from the renderer.

### Step 3

Extract polling/orchestration.

This will remove the remaining async workflow lifecycle logic from the renderer.

### Step 4

Reduce `render()` and helper initialization further.

This will make the renderer look like a true bootstrap/composition file.

### Step 5

Do a dead-code and delegate cleanup pass.

This will close the phase cleanly instead of leaving the renderer smaller but still messy.

## Exit Criteria Recheck

Phase 3 should only be considered complete when all of these are true:

- `renderer.js` is mostly bootstrap/composition
- workflow state mutation is no longer renderer-owned
- editor/timeline state mutation is no longer renderer-owned
- polling/orchestration is no longer renderer-owned
- the renderer is no longer the place where unrelated domain logic accumulates
- core end-to-end behavior still works

At the moment, those criteria are **not yet fully met**.

## Final Assessment

Phase 3 is going well.

It is no longer fake modularization. The renderer has been reduced materially and meaningfully.

But the phase is not finished yet.

The remaining work is now less about extracting obvious render blocks and more about moving the remaining domain mutation and orchestration logic out of the renderer.

That is the part that will determine whether Phase 3 ends as:

- a smaller monolith

or

- a genuinely modular frontend architecture

Right now, the project is between those two states.

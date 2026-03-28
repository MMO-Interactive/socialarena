# Standalone Editor Coherence Review

Date: 2026-03-18

## Purpose

This document is a ground-to-top coherence review of the standalone editor as it currently exists.

The goal is not to restate features. The goal is to answer:

- Is the product direction coherent?
- Is the current implementation coherent with that direction?
- What is already working structurally?
- What still needs to be corrected or hardened?

## Executive Summary

The standalone editor is no longer just a rough-cut tool. It has become a story-first AI filmmaking workflow with:

- a preproduction pipeline
- image generation
- video generation
- a timeline editor
- a narrative track
- studio-scoping in progress

That direction is coherent and strong.

The biggest current weaknesses are not feature gaps. They are architecture gaps:

1. the backend project model still does not fully match the frontend product model
2. studio scoping is only partially systemic
3. the renderer has become too large and too coupled
4. `Video Clips` is still structurally too dependent on `Starting Images`
5. the docs and the implementation have drifted apart

So the editor is coherent in product vision, but not yet fully coherent in implementation structure.

## What Is Coherent

### 1. The Core Workflow Is Coherent

The current workflow is understandable and product-valid:

`Idea Board -> Project Pitch -> Script -> Starting Images -> Video Clips -> Edit`

That is a strong creative pipeline. It matches how AI-assisted filmmaking should work better than a traditional clip-first editor.

### 2. The Editor Is Becoming Story-First

The addition of a narrative/scene track above the media tracks is one of the strongest architectural decisions in the app.

The timeline is no longer only:

- clips
- audio
- tracks

It now also understands:

- scenes
- scene context
- scene continuity
- AI generation context

That is coherent with the product’s intended identity.

### 3. The AI-Native Direction Is Coherent

The editor is no longer just “an editor with generation buttons.”

It is increasingly structured like:

`Story -> Scene -> Shot -> Clip -> Timeline`

That is the correct mental model for an AI-native filmmaking tool.

### 4. The Studio-Scoped Direction Is Correct

The move toward studio context is correct and important.

The correct top-level shape is:

- Studio
- Idea Boards
- Projects
- Films
- Series
- Episodes
- Assets
- Cast
- Locations
- Sessions

That is the right long-term container model for this product.

## Major Incoherences

### 1. Backend Project Types Still Do Not Match Frontend Project Types

This is currently the biggest end-to-end product-model break.

The frontend now treats these as valid first-class formats:

- series
- episode
- film
- trailer
- clip

But the backend still only truly allows:

- film
- episode

Relevant code:

- [api/v1/bootstrap.php#L199](C:/wamp64/www/adventure/api/v1/bootstrap.php#L199)
- [api/v1/bootstrap.php#L201](C:/wamp64/www/adventure/api/v1/bootstrap.php#L201)
- [api/v1/bootstrap.php#L266](C:/wamp64/www/adventure/api/v1/bootstrap.php#L266)
- [standalone-editor/renderer.js#L14](C:/wamp64/www/adventure/standalone-editor/renderer.js#L14)
- [standalone-editor/renderer.js#L50](C:/wamp64/www/adventure/standalone-editor/renderer.js#L50)
- [standalone-editor/renderer.js#L2725](C:/wamp64/www/adventure/standalone-editor/renderer.js#L2725)

Impact:

- the UI claims support for `Series`
- the backend still behaves like the product is really only `Film` and `Episode`

This makes the system product-incoherent.

### 2. Studio Scope Is Present, But Not Yet Fully Systemic

Studio context now exists in the auth/session flow and is shown in the app. That is good.

But the enforcement is still only partial.

Relevant code:

- [api/v1/index.php#L33](C:/wamp64/www/adventure/api/v1/index.php#L33)
- [api/v1/index.php#L78](C:/wamp64/www/adventure/api/v1/index.php#L78)
- [api/v1/index.php#L103](C:/wamp64/www/adventure/api/v1/index.php#L103)
- [api/v1/bootstrap.php#L229](C:/wamp64/www/adventure/api/v1/bootstrap.php#L229)
- [standalone-editor/renderer.js#L3741](C:/wamp64/www/adventure/standalone-editor/renderer.js#L3741)

Current state:

- the frontend appends `studio_id` broadly
- some backend routes respect current studio context
- but studio enforcement is not yet universal as a first-class backend rule

Impact:

- scope is improving
- but it is still possible for architecture drift to happen because studio filtering is not yet uniformly authoritative

### 3. The Renderer Has Become a Monolith

This is the biggest maintainability and regression risk in the application.

Current file:

- [standalone-editor/renderer.js](C:/wamp64/www/adventure/standalone-editor/renderer.js)

Current size:

- about 9,095 lines

It currently mixes:

- auth
- studio selection
- API request logic
- workflow stages
- script editing
- starting images
- video clips
- asset library
- timeline editor
- AI actions
- export coordination
- inspector logic

Impact:

- behavior may work
- but the codebase is no longer structurally coherent
- every new feature increases the chance of hidden regressions

This should now be treated as a structural problem, not a stylistic one.

### 4. `Video Clips` Still Reuses `Starting Images` Structure Too Aggressively

The `Video Clips` stage works, but it is still built on reused `Starting Images` layout classes and structural assumptions.

Relevant code:

- [standalone-editor/renderer.js#L1815](C:/wamp64/www/adventure/standalone-editor/renderer.js#L1815)
- [standalone-editor/renderer.js#L2013](C:/wamp64/www/adventure/standalone-editor/renderer.js#L2013)
- [standalone-editor/styles.css#L1248](C:/wamp64/www/adventure/standalone-editor/styles.css#L1248)
- [standalone-editor/styles.css#L1258](C:/wamp64/www/adventure/standalone-editor/styles.css#L1258)
- [standalone-editor/styles.css#L1289](C:/wamp64/www/adventure/standalone-editor/styles.css#L1289)

Impact:

- the stage works functionally
- but the UI architecture is not clean
- this is why layout regressions have appeared repeatedly in that part of the app

### 5. The Docs and the App Have Drifted

The implementation has evolved beyond the original shape of the editor, while the documents still describe an earlier and cleaner model.

Relevant docs:

- [STANDALONE_EDITOR_V1_FEATURE_SPEC.md](C:/wamp64/www/adventure/STANDALONE_EDITOR_V1_FEATURE_SPEC.md)
- [STANDALONE_EDITOR_ARCHITECTURE.md](C:/wamp64/www/adventure/STANDALONE_EDITOR_ARCHITECTURE.md)
- [STANDALONE_EDITOR_API_CURRENT_STATE.md](C:/wamp64/www/adventure/STANDALONE_EDITOR_API_CURRENT_STATE.md)

Current issue:

- the app is now more AI-native and more workflow-heavy than the docs describe
- the docs still imply a cleaner module boundary than the code actually has
- the product model has changed faster than the written architecture

Impact:

- the team no longer has a fully reliable written source of truth

### 6. The “Studio Required” Model Still Has a Fallback That Dilutes It

The current app still allows a null-context fallback called `Personal Workspace`.

Relevant code:

- [standalone-editor/renderer.js#L4580](C:/wamp64/www/adventure/standalone-editor/renderer.js#L4580)
- [standalone-editor/renderer.js#L7870](C:/wamp64/www/adventure/standalone-editor/renderer.js#L7870)

That may be acceptable as a temporary dev convenience, but it is not fully aligned with the intended product model that the editor should require studio context.

Impact:

- the architecture says “studio-scoped”
- the runtime still says “studio-scoped unless null”

That is not fully coherent yet.

### 7. Series/Episode Hierarchy Exists Conceptually But Not Yet Operationally

The editor now understands the words:

- series
- episode
- film

But the workflow is still fundamentally centered around a single active project.

What is still missing:

- true `Series -> Episodes` hierarchy inside the main working flow
- clear distinction between editing a film and editing an episode within a series
- promotion from idea into either film or series as a real first-class process

Impact:

- the concept exists
- the hierarchy does not yet fully drive behavior

## Secondary Incoherences

### 1. Desktop Auth Is Still PHP Session-Shaped

This is acceptable short term, but it is not yet the strongest desktop/API boundary.

It works, but it should be treated as technical debt rather than final architecture.

### 2. Presentation Debt Still Exists

The app is stronger conceptually than it sometimes looks visually because many screens were added incrementally.

That means:

- some screens feel more polished than others
- some sections are still visually coupled in ways that do not reflect the real product model

### 3. Naming and Data Ownership Still Need Tightening

The model is moving toward:

- studio-level ideas
- promoted projects
- scene-level context
- clip-level dialog and generation

That is the right direction.

But some old assumptions are still present in state shape and UI naming.

## What Needs To Improve Next

### 1. Make Backend Types Match Product Types

The backend project model must be expanded so it truly matches the frontend product model.

That means:

- supporting `series` properly
- defining how `episode` relates to `series`
- not pretending the editor supports a type that the backend still rejects

### 2. Make Studio Scope Universal

Studio context should become a true backend rule, not just a frontend convention.

That means:

- every studio-sensitive API route should enforce current studio context
- project, asset, cast, location, and idea lookups should all be studio-guarded consistently

### 3. Split the Renderer Into Real Modules

This is now urgent.

The renderer should be separated into modules such as:

- auth and studio session
- dashboard and navigation
- script stage
- starting images stage
- video clips stage
- asset library
- editor timeline
- inspector and AI actions
- API client

Without this split, coherence will continue to erode as features are added.

### 4. Separate `Video Clips` From `Starting Images`

The `Video Clips` stage should stop inheriting so much of its visual and structural shape from `Starting Images`.

It should become its own stage with:

- its own state ownership
- its own layout classes
- its own editor panel structure

### 5. Update the Written Architecture

The docs need to become honest about the current system.

At minimum:

- update the feature spec
- update the architecture doc
- make the product hierarchy explicit
- document studio scoping as a foundational rule

### 6. Decide the Fate of `Personal Workspace`

This needs a clear decision:

- keep it as a real non-studio workspace type
- or remove it and require studio selection always

Leaving it in a semi-real state will keep the architecture ambiguous.

### 7. Formalize the Top-Level Product Model

The app should explicitly model:

- Studio
- Idea Boards
- Idea Pitch
- Promotion
- Film
- Series
- Episode
- Assets
- Cast
- Locations
- Sessions

That model should exist not just in the UI, but in:

- backend types
- API contracts
- editor session state
- documentation

## Open Questions

### 1. What Should Be the Actual Editor Unit for a Series?

Should a user:

- open a `Series` directly in the editor
- or always edit at the `Episode` level once inside a series

This needs a hard product decision.

### 2. Is `Personal Workspace` Real or Temporary?

If it is temporary, it should be treated as a dev override only.

If it is real, it needs to become part of the product model explicitly.

### 3. Where Do Idea Boards Truly Live?

Should idea boards be:

- studio-level only
- or studio-level plus project-level descendants after promotion

This affects data ownership and workflow structure.

## Bottom Line

The editor is coherent in vision.

It is becoming a real AI-native filmmaking product with:

- a story-first workflow
- a narrative-aware timeline
- image and clip generation
- a rough-cut editing loop
- studio context moving into the architecture

But it is not yet fully coherent in implementation.

The biggest issues are now structural:

1. backend type mismatch
2. incomplete studio enforcement
3. oversized renderer
4. stage coupling
5. documentation drift

If those are corrected, the editor will stop feeling like a fast-moving prototype and start feeling like a stable product foundation.

## Recommended Next Sequence

1. Make backend types and hierarchy match the product model
2. Enforce studio scope universally
3. Split the renderer into modules
4. Separate `Video Clips` from `Starting Images`
5. Update docs to match reality
6. Finalize the `Studio -> Idea -> Promote -> Film/Series -> Episode` model

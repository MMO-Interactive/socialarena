# AI Standalone Studio Build Order

## Goal
This document defines the implementation order an AI agent should follow.

It is intentionally opinionated.

## Current State
The repo already contains:

- Electron shell
- login gate
- dashboard
- project browser
- platform project import
- local media import
- basic timeline
- basic playback
- basic inspector

Because the editor exists, the next work should focus on the creation pipeline that feeds it.

## Build In This Order

### Phase 1. Project Stage Model
Build first:

- project stages
- current stage tracking
- stage progress metadata
- dashboard stage badges

Why first:
- all later workflow screens need stage ownership

Done when:
- a project can be marked as being in `idea_board`, `script`, `starting_images`, `video_clips`, or `edit`

### Phase 2. Idea Board Screen
Build second:

- dedicated idea board page in app
- concept brief fields
- references
- notes
- format selection

Why second:
- this is the start of the default user journey

Done when:
- a creator can create and save a concept brief for a project

### Phase 3. Script Screen
Build third:

- scene list
- script blocks
- per-scene generation intent
- scene status

Why third:
- this turns concept into structured generation inputs

Done when:
- a project has structured scenes that can feed image/clip generation

### Phase 4. Starting Image Generation Screen
Build fourth:

- per-scene image generation queue
- prompt display
- approval/regenerate workflow

Why fourth:
- video generation should not start from unapproved inputs

Done when:
- scenes can store approved starting images

### Phase 5. Video Clip Generation Screen
Build fifth:

- clip generation jobs
- queue/progress/status
- approve/regenerate controls

Why fifth:
- this produces the media that flows into editing

Done when:
- approved generated clips can be selected for editorial use

### Phase 6. Handoff To Editor
Build sixth:

- send approved clips directly into editor media bin
- create timeline from selected clips
- open editor workspace on handoff

Why sixth:
- this connects the creation pipeline to the existing editor

Done when:
- a creator can complete the upstream flow and land in editing with assets loaded

## Do Not Prioritize Before The Above

- advanced timeline polish
- extra menu expansion
- deep inspector options
- advanced export presets
- broad settings panels
- non-essential dashboard decoration

These are valid later, but not first.

## AI Task Selection Rule
If choosing between two tasks:

- choose the one that removes friction between workflow stages
- do not choose the one that only beautifies an isolated screen

## Preferred Near-Term Deliverables
If the AI must immediately implement something next, choose one:

1. project stage model
2. idea board screen
3. script scene editor
4. starting image approval queue
5. clip generation queue

## Minimum Success Condition
The standalone app is on the right path only when a creator can:

1. define an idea
2. convert it into scenes
3. approve generated visual inputs
4. approve generated clips
5. edit the result

Until that exists, the product is still incomplete regardless of editor polish.

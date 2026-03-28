# SocialArena Editor V1 Feature Specification

## Overview
SocialArena Editor is a standalone desktop video assembly editor designed to connect directly to the SocialArena platform. The goal of V1 is not to compete with Premiere, Resolve, or Final Cut. The goal is to give SocialArena creators a focused editing environment for assembling AI-generated media into publishable clips, scenes, episodes, and short films.

V1 should prioritize:

- reliable timeline editing
- strong SocialArena integration
- fast rough-cut workflows
- simple rendering/export
- low cognitive overhead for creators already working inside SocialArena

## Product Goal
Enable a creator to:

1. open a SocialArena story, episode, or film project
2. pull generated clips, starting images, music, dialogue, and visual assets into a local editor
3. build a rough cut on a timeline
4. export a finished video
5. push the result back into SocialArena for release and publishing

## Primary Users

- solo AI creators building clips, shorts, and episodes
- small studios using SocialArena as their production OS
- editors assembling AI-generated media into publishable content

## V1 Product Positioning
This is an AI-first assembly editor, not a general-purpose post-production suite.

SocialArena Editor V1 is for:

- rough cuts
- clip assembly
- timing and structure
- soundtrack placement
- title cards
- export and publish

It is not for:

- advanced color grading
- deep audio engineering
- motion graphics
- multicam broadcast editing
- professional VFX compositing

## Core V1 Use Cases

### 1. Episode Rough Cut
A creator opens an episode from SocialArena, imports all generated scene clips, arranges them on the timeline, inserts transitions and title cards, adds music, and exports a preview cut.

### 2. Trailer Assembly
A creator pulls selected clips from multiple scenes, adds promo text and music, then exports a trailer and pushes it back to SocialArena as public media.

### 3. Short Clip Publishing
A creator assembles one or more generated clips, trims them, adds captions and music, and exports a short-form clip for release.

## V1 Scope

### Included

- SocialArena login
- project browser
- asset sync
- local project cache
- video timeline
- audio timeline
- image still support
- text/title cards
- trim in/out
- clip split
- drag and drop reordering
- mute / volume controls
- timeline zoom
- transport controls
- preview player
- save/open editor project
- MP4 export
- upload export back to SocialArena

### Explicitly Excluded From V1

- advanced transitions library
- keyframing
- effect stacks
- color correction suite
- LUTs
- waveform-based audio editing
- subtitle authoring
- collaborative realtime editing
- cloud rendering
- proxy transcoding automation beyond minimal support

## Functional Requirements

### Authentication

- User can sign in with SocialArena credentials or API token.
- Editor stores session securely.
- Editor can refresh session without re-login when possible.

### Project Browser

- Browse:
  - films
  - series
  - seasons
  - episodes
  - scenes
  - clips
- Show metadata:
  - title
  - description
  - studio
  - status
  - clip count
  - latest updated time

### Asset Import

- Import video assets from SocialArena
- Import starting images from clips
- Import released screenshots
- Import audio from Music Library
- Import local assets from disk

### Timeline

- Multiple video tracks
- Multiple audio tracks
- One title/graphics track minimum
- Drag clip to place on timeline
- Snap adjacent clips
- Split clip
- Trim start/end
- Move clips between tracks
- Delete clip from timeline without deleting source asset
- Show playhead timecode

### Playback

- Play / pause
- Seek
- Frame-ish stepping acceptable for V1
- Playback from current cursor
- Loop selection optional if low-cost

### Audio

- Audio clips on audio tracks
- Basic gain / volume slider
- Mute toggle
- Fade in / fade out optional if simple

### Text / Titles

- Add title card clip
- Edit:
  - text
  - font size
  - alignment
  - background color
  - duration

### Export

- Export H.264 MP4
- Choose resolution:
  - 1080p
  - 720p
- Choose bitrate preset:
  - draft
  - balanced
  - final
- Save locally
- Upload to SocialArena as:
  - clip
  - trailer
  - episode export
  - draft render

### Sync Back To SocialArena

- Save timeline project metadata
- Upload rendered outputs
- Link outputs to clip/scene/episode/project records
- Store thumbnail if generated locally

## Suggested UI Areas

### 1. Top Bar

- current project
- sync status
- save status
- export button
- upload to SocialArena button

### 2. Left Panel

- media bin
- project browser
- imported assets
- search/filter

### 3. Center

- preview monitor
- transport controls

### 4. Bottom

- timeline

### 5. Right Panel

- selected clip properties
- volume
- trim
- text settings
- metadata

## File/Project Model

The standalone editor should maintain its own local project file, with remote references back to SocialArena.

Minimum structure:

- local project id
- remote project type
- remote project id
- asset manifest
- timeline JSON
- local cache index
- last sync timestamp

## Success Criteria For V1

- user can go from SocialArena episode to rough cut without leaving the editor
- editor opens and saves reliably
- timeline interactions feel responsive
- export succeeds consistently
- publish/upload back to SocialArena works

## V1 Non-Functional Requirements

- desktop-first
- stable on Windows first
- handles medium-size projects without freezing
- resilient to interrupted uploads/downloads
- clear offline behavior when SocialArena is unreachable

## Post-V1 Roadmap Candidates

- transitions
- subtitle/caption system
- proxy media generation
- improved waveform view
- templates for trailer cuts
- direct timeline import from story planner clips
- cloud render queue
- collaborative annotations

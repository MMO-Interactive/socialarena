# SocialArena Editor Architecture and Tech Stack

## Overview
SocialArena Editor should be built as a desktop application that syncs with the SocialArena web platform through a versioned API.

The correct product strategy is not to build a full post-production competitor. The correct strategy is to build an AI-first assembly editor tightly integrated with SocialArena’s story, clip, asset, and publishing systems.

## Recommended Stack

### Desktop Shell

- **Primary recommendation:** Electron
- **Alternative:** Tauri

Recommendation rationale:

- Electron has a larger ecosystem for media tooling.
- Easier access to filesystem and FFmpeg workflows.
- Faster iteration for a React-based UI.

If footprint becomes a major concern later, evaluate Tauri in V2.

### Frontend

- React
- TypeScript
- Zustand or Redux Toolkit for state
- TanStack Query for API state

### Rendering / Export

- FFmpeg
- FFprobe

### Local Storage

- SQLite for local project/session cache
- local filesystem media cache

### API Communication

- REST or REST-like JSON API from SocialArena
- signed URLs for media upload/download

## Why Desktop First

Desktop is the right choice because:

- video editing needs local file access
- export requires native process handling
- browser storage is too limiting for reliable asset caching
- desktop offers better stability for offline and semi-offline workflows

## High-Level System Architecture

### 1. SocialArena Platform

Responsibilities:

- authentication
- project metadata
- studio permissions
- asset registry
- publish/release records

### 2. Desktop Editor App

Responsibilities:

- timeline UX
- local playback
- local asset cache
- autosave
- export orchestration

### 3. Local Worker Layer

Responsibilities:

- FFmpeg process execution
- thumbnail generation
- waveform generation later
- proxy generation later

## Data Flow

### Open Project

1. user logs in
2. editor fetches accessible projects
3. user selects episode/film/clip project
4. editor fetches asset manifest
5. editor downloads/caches only needed assets
6. editor loads latest timeline JSON

### Save Project

1. timeline changes locally
2. autosave to SQLite
3. periodic sync to SocialArena timeline endpoint

### Export

1. user selects export settings
2. FFmpeg renders local MP4
3. app creates export record remotely
4. app uploads file
5. app marks export complete
6. optional publish flow begins

## Recommended Module Breakdown

### App Shell

- auth/session manager
- navigation/router
- update checker

### Project Browser

- remote project listing
- filters and search
- recent projects

### Media Bin

- imported remote assets
- local imports
- search/sort

### Timeline Engine

- tracks
- items
- drag/drop
- trim/split
- zoom
- snapping

### Preview Engine

- current frame rendering
- playback transport

### Export Service

- ffmpeg command generation
- export job status
- upload completion

### Sync Service

- API wrapper
- upload/download
- conflict handling

## Timeline Engine Strategy

Do not overengineer V1.

Recommended V1 timeline model:

- absolute time track positioning
- simple lane-based placement
- no keyframing
- no nested sequences
- no advanced transition engine

This keeps V1 buildable.

## Media Handling Strategy

### V1

- download original media to local cache
- lightweight cache manifest in SQLite
- use direct files for playback and render

### V2

- generate low-res proxy media for smoother playback

## Playback Strategy

V1 target:

- good-enough playback for rough cut work
- not perfect realtime on huge projects

Approach:

- HTML5 video for basic video playback
- canvas overlays for guides/titles if needed
- keep effect system minimal

## Export Strategy

Use FFmpeg as the core export engine.

Why:

- stable
- proven
- flexible
- available cross-platform

Export presets:

- draft
- balanced
- final

## Local Persistence Strategy

Use SQLite for:

- session state
- last-opened project
- local timeline autosaves
- cache manifest
- pending uploads

This makes the app resilient if SocialArena is offline.

## Sync Strategy

Use a hybrid local-first model.

- Always save locally first.
- Sync to server second.
- If server unavailable, queue sync attempts.

This is the correct architecture for creator trust.

## Security Model

- token-based auth
- encrypted token storage
- signed media URLs
- studio permission checks enforced server-side

Desktop app should never trust cached authorization alone.

## Observability

The editor should log:

- API failures
- export failures
- sync queue failures
- upload interruptions

Logs should be viewable in-app for debugging.

## Release Strategy

### V1 Platform Target

- Windows first

### Packaging

- Electron Builder

### Updates

- auto-update optional in V1
- manual installer acceptable initially

## Team/Implementation Estimate

### V1 Rough Build

For one strong full-stack/product engineer:

- architecture/setup: 1 to 2 weeks
- auth/browser/media bin: 2 to 3 weeks
- timeline basics: 4 to 6 weeks
- export/upload/publish: 2 to 3 weeks
- polish/bug fixing: 2 to 4 weeks

Estimated total:

- **2 to 4 months** for a useful V1

### Full Serious Editor

- **12 to 36 months**
- multiple engineers

## Build Order Recommendation

1. auth + project browser
2. media bin + download cache
3. timeline read/write model
4. timeline UI interactions
5. playback monitor
6. export
7. upload to SocialArena
8. publish from export

## Recommendation Summary

Build SocialArena Editor as:

- a desktop application
- Windows-first
- Electron + React + TypeScript
- FFmpeg-powered export
- local-first, API-synced

Keep it narrowly focused on:

- assembling AI-generated media
- rough cuts
- fast release

That is the most winnable product.

# AI Standalone Studio Mission

## Purpose
This document is written for AI agents working on the standalone SocialArena desktop app.

The goal is to remove ambiguity about what the product is supposed to become and what should be built first.

## Product Identity
The standalone app is not just a video editor.

The intended end state is a **standalone AI creator studio** for SocialArena with one tight default workflow:

1. idea board
2. script writing
3. starting image generation
4. video clip generation
5. editing
6. export and publish

## Most Important Product Principle
The product should feel like a **guided creation pipeline**, not a bag of disconnected tools.

If an AI agent has to choose between:

- adding more isolated controls, menus, and settings
- or improving the core guided creation flow

it should choose the guided flow first.

## What The App Should Optimize For

- low cognitive overhead
- clear next step for the creator
- direct movement from concept to finished video
- strong SocialArena integration
- local-first desktop strengths: file access, caching, playback, rendering

## What The App Should Not Optimize For Yet

- advanced editor complexity before upstream creation flow exists
- feature parity with Premiere or Resolve
- full post-production depth
- broad settings surfaces before the core path is solid
- abstract architecture work without clear user-facing workflow gain

## Current Strategic Interpretation
The app already has:

- auth
- dashboard
- platform browsing
- media import
- a basic timeline editor
- basic playback

That means the next priority is **not** more editor polish by default.

The next priority is building the creation flow that leads into the editor.

## Required Default User Journey
When a user starts a new project, the expected default journey should be:

1. create or open project
2. define concept in idea board
3. turn concept into structured script/scenes
4. approve starting images
5. generate and approve video clips
6. send approved clips into the editor
7. export and publish

## AI Decision Rule
If uncertain what to build next, prefer the feature that most improves:

- stage-to-stage continuity
- creator guidance
- project progression visibility
- handoff into the next stage

over isolated UI polish.

## Relationship To Existing Docs
This file does not replace:

- [STANDALONE_EDITOR_V1_FEATURE_SPEC.md](C:/wamp64/www/adventure/STANDALONE_EDITOR_V1_FEATURE_SPEC.md)
- [STANDALONE_EDITOR_ARCHITECTURE.md](C:/wamp64/www/adventure/STANDALONE_EDITOR_ARCHITECTURE.md)
- [STANDALONE_EDITOR_API_CONTRACT.md](C:/wamp64/www/adventure/STANDALONE_EDITOR_API_CONTRACT.md)

It should be read as the AI-facing priority lens for implementing them.

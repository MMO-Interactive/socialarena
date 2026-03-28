# SocialArena Standalone Editor API Current State

## Purpose
This document describes the API surface that is currently implemented in the SocialArena PHP platform under `/api/v1`.

It is intentionally different from the planned contract in [STANDALONE_EDITOR_API_CONTRACT.md](C:/wamp64/www/adventure/STANDALONE_EDITOR_API_CONTRACT.md):
- the contract describes target behavior
- this document describes what exists right now

## Base URL

Local default:

```text
http://localhost/adventure/api/v1
```

## Authentication Model

Current auth is PHP-session based, exposed to the desktop app as a bearer token:

- `POST /api/v1/auth/editor-login` creates a PHP session
- the response `token` is the PHP `session_id()`
- authenticated requests send:

```http
Authorization: Bearer <session_id>
```

Notes:
- login uses `username` or `email`, but the standalone app now submits `username`
- this is not JWT-based
- token refresh currently just returns the same active session id

## Response Shape

Success responses use:

```json
{
  "success": true
}
```

plus endpoint-specific fields.

Error responses use:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

## Implemented Endpoints

### Auth

#### `POST /api/v1/auth/editor-login`

Authenticate a platform user for standalone editor usage.

Request:

```json
{
  "username": "JamesProctor",
  "password": "secret"
}
```

Response:

```json
{
  "success": true,
  "token": "php-session-id",
  "user": {
    "id": 1,
    "username": "JamesProctor"
  },
  "expires_at": "2026-03-14T20:00:00Z"
}
```

#### `POST /api/v1/auth/refresh`

Refreshes the authenticated session response payload.

#### `POST /api/v1/auth/logout`

Destroys the active PHP session.

### Dashboard

#### `GET /api/v1/editor/dashboard`

Returns a platform-backed summary used by the standalone dashboard.

Current payload includes:
- studios
- recent platform projects
- upcoming tasks
- summary stats
- queued export count when `editor_exports` exists

### Projects

#### `GET /api/v1/editor/projects`

Lists accessible projects for the authenticated user.

Current filters are passed through `$_GET`, but the implementation is centered on:
- `type`
- studio-aware access

#### `POST /api/v1/editor/projects`

Creates a minimal backing platform project for a standalone-local project.

Current behavior:
- creates a minimal `stories` row
- creates a linked `projects` row
- returns project metadata for linking the local standalone project to the platform

This endpoint exists primarily to let local standalone projects become platform-backed before generation actions.

#### `GET /api/v1/editor/projects/{type}/{id}`

Returns a full project payload.

Current response includes:
- project metadata
- scenes
- clips
- asset count

### Assets

#### `GET /api/v1/editor/projects/{type}/{id}/assets`

Returns platform assets associated with the project.

Current sources include:
- story clips
- clip blocks
- music library assets

### Idea Board

#### `GET /api/v1/editor/projects/{type}/{id}/idea-board`

Loads the project’s idea board, including:
- board metadata
- items
- links

#### `POST /api/v1/editor/projects/{type}/{id}/idea-board`

Saves the project’s idea board from the standalone app back into platform tables.

Current backing tables:
- `idea_boards`
- `idea_board_items`
- `idea_board_links`
- `editor_project_idea_boards` mapping table

#### `POST /api/v1/editor/projects/{type}/{id}/idea-board/items/{item_id}/prompt-preview`

Proxy to platform idea-board prompt preview.

#### `POST /api/v1/editor/projects/{type}/{id}/idea-board/items/{item_id}/generate`

Queues idea-board image generation.

#### `POST /api/v1/editor/projects/{type}/{id}/idea-board/items/{item_id}/refresh`

Refreshes generation state for an idea-board item.

Current behavior:
- checks ComfyUI history
- if output exists, marks the item `generated`
- if history is simply not ready yet, leaves the item queued
- only marks the item failed on an actual upstream request failure

#### `POST /api/v1/editor/projects/{type}/{id}/idea-board/items/{item_id}/clip-preview`

Proxy to platform clip prompt preview.

#### `POST /api/v1/editor/projects/{type}/{id}/idea-board/items/{item_id}/clip-generate`

Queues clip generation through the existing platform handler.

#### `POST /api/v1/editor/projects/{type}/{id}/idea-board/items/{item_id}/history`

Returns recent generation history for the idea-board item.

### Starting Images

#### `POST /api/v1/editor/projects/{type}/{id}/starting-images/generate`

Current `Starting Images` stage generation endpoint.

Behavior:
- ensures the project has an idea board
- creates or updates a backing hidden `scene` idea-board item for the script scene
- queues generation through the existing platform image generator
- returns the current starting-image item state

Request:

```json
{
  "scene_id": "script-scene-1",
  "scene_title": "Opening Scene",
  "prompt": "A cinematic forest clearing at dawn with a glowing portal.",
  "shot_notes": "Wide shot, cinematic light, soft haze.",
  "reference_image_url": "https://...",
  "board_item_id": 123
}
```

Response currently includes:
- `queued`
- `starting_image.board_item_id`
- `starting_image.generated_image_url`
- `starting_image.generation_status`
- `starting_image.generation_count`
- `starting_image.prompt_id`

#### `POST /api/v1/editor/projects/{type}/{id}/starting-images/refresh`

Refreshes the queued starting-image generation state.

Behavior:
- refreshes the backing idea-board item using the existing `refresh_item` path
- returns current `generated_image_url` if generation has finished

This is what the standalone app now polls in order to create variation cards automatically.

### Timeline

#### `GET /api/v1/editor/projects/{type}/{id}/timeline`

Loads the latest saved editor timeline, if present.

Current backing table:
- `editor_timeline_projects`

If that table does not exist in the live database, the endpoint returns `timeline_project: null`.

#### `POST /api/v1/editor/projects/{type}/{id}/timeline`

Creates or updates a timeline project.

Current behavior:
- creates on first save
- increments `version` on update

#### `POST /api/v1/editor/timeline/{timeline_project_id}/autosave`

Lightweight autosave endpoint.

Current behavior:
- updates `timeline_json`
- increments version
- sets `autosaved_at`

### Exports

#### `POST /api/v1/editor/exports/init`

Creates an export record.

Current backing table:
- `editor_exports`

Current response returns:
- `export_id`
- `upload_url` placeholder
- `storage_path`

Note:
- this is currently record creation, not a true signed-upload pipeline

#### `POST /api/v1/editor/exports/{export_id}/complete`

Marks an export record complete.

#### `GET /api/v1/editor/projects/{type}/{id}/exports`

Lists export records for the project.

## Data/Schema Dependencies

The current API depends on these existing or newly introduced tables:

- `users`
- `projects`
- `stories`
- `story_scenes`
- `story_scene_clips`
- `clip_blocks`
- `studio_music_library`
- `idea_boards`
- `idea_board_items`
- `idea_board_links`
- `idea_board_generations`
- `idea_board_generation_links`
- `editor_project_idea_boards`
- `editor_timeline_projects`
- `editor_exports`

Optional dashboard enrichments also use, when present:
- `studios`
- `studio_members`
- `project_tasks`

## Current Architectural Notes

### 1. Idea-board reuse under the hood

The standalone `Starting Images` step currently uses a dedicated API route, but internally it reuses the platform idea-board generation pipeline.

That means:
- the standalone UI is stage-specific
- backend generation still flows through the proven idea-board handler path

### 2. Session-based internal proxying

The API uses internal HTTP calls to `includes/idea_board_handlers.php` for generation-related actions.

Important fix already applied:
- `session_write_close()` is called before those internal requests to avoid PHP session-lock deadlocks

### 3. ComfyUI reachability handling

Recent fix already applied:
- an empty history result no longer automatically means `ComfyUI unreachable`
- queued jobs now remain queued while ComfyUI is still generating
- only actual upstream request failures mark generation failed

## Known Gaps

These are still not complete from a product/API perspective:

- no dedicated video-clips generation endpoint yet; the `Video Clips` stage is currently seeded in the app, not fully API-backed
- no signed asset download endpoint yet
- no true resumable upload/export pipeline yet
- auth is still session-id based instead of a dedicated desktop token model
- some idea-board generation behaviors still depend on the legacy handler structure

## Recommended Reading

- [STANDALONE_EDITOR_API_CONTRACT.md](C:/wamp64/www/adventure/STANDALONE_EDITOR_API_CONTRACT.md)
- [api/v1/index.php](C:/wamp64/www/adventure/api/v1/index.php)
- [api/v1/bootstrap.php](C:/wamp64/www/adventure/api/v1/bootstrap.php)
- [includes/idea_board_handlers.php](C:/wamp64/www/adventure/includes/idea_board_handlers.php)
- [includes/comfyui.php](C:/wamp64/www/adventure/includes/comfyui.php)

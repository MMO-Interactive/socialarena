# SocialArena Editor API Contract

## Overview
This document defines the minimum API surface needed for a standalone SocialArena Editor desktop application.

The API should support four major responsibilities:

1. authentication
2. project and asset discovery
3. timeline/project persistence
4. export upload and publishing hooks

## Authentication Model

The editor should authenticate using either:

- bearer token
- session exchange endpoint that returns editor-safe API token

Recommended:

- editor-specific personal access token or short-lived JWT

## Base Assumptions

- All responses are JSON unless file/media endpoint.
- All authenticated endpoints require `Authorization: Bearer <token>`.
- API versioning should be introduced early with `/api/v1/...`.

## 1. Authentication Endpoints

### POST `/api/v1/auth/editor-login`

Authenticate for desktop editor usage.

Request:

```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

Response:

```json
{
  "token": "jwt-or-editor-token",
  "user": {
    "id": 1,
    "username": "JamesProctor"
  },
  "expires_at": "2026-03-20T18:00:00Z"
}
```

### POST `/api/v1/auth/refresh`

Refresh token.

### POST `/api/v1/auth/logout`

Invalidate editor token.

## 2. Project Discovery Endpoints

### GET `/api/v1/editor/projects`

List all accessible edit-capable projects.

Filters:

- `type=film|episode|clip`
- `studio_id`
- `status`

Response:

```json
{
  "projects": [
    {
      "id": 12,
      "type": "episode",
      "title": "Episode 1 Welcome Home",
      "description": "Episode description",
      "studio_id": 3,
      "series_id": 5,
      "season_id": 2,
      "clip_count": 14,
      "updated_at": "2026-03-13T14:45:00Z"
    }
  ]
}
```

### GET `/api/v1/editor/projects/{type}/{id}`

Return a full project payload for editing.

Response includes:

- basic metadata
- related scenes
- related clips
- asset references
- existing editor project references

## 3. Asset Endpoints

### GET `/api/v1/editor/projects/{type}/{id}/assets`

Return all assets relevant to a project.

Response:

```json
{
  "assets": [
    {
      "id": 101,
      "asset_type": "video",
      "title": "Clip 1",
      "source_type": "story_clip",
      "source_id": 7,
      "url": "https://...",
      "thumbnail_url": "https://...",
      "duration_seconds": 10.2,
      "width": 1280,
      "height": 720,
      "created_at": "2026-03-13T12:00:00Z"
    },
    {
      "id": 102,
      "asset_type": "image",
      "title": "Starting Frame",
      "source_type": "clip_block",
      "source_id": 88,
      "url": "https://..."
    },
    {
      "id": 103,
      "asset_type": "audio",
      "title": "Theme Track",
      "source_type": "music_library",
      "source_id": 5,
      "url": "https://...",
      "duration_seconds": 193.0
    }
  ]
}
```

### GET `/api/v1/editor/assets/{asset_id}/download`

Returns signed or direct URL for local caching.

### POST `/api/v1/editor/assets/import-local`

Optional future endpoint for uploading local source media into SocialArena.

## 4. Timeline Project Endpoints

### GET `/api/v1/editor/projects/{type}/{id}/timeline`

Fetch latest saved editor timeline.

Response:

```json
{
  "timeline_project": {
    "id": 55,
    "project_type": "episode",
    "project_id": 12,
    "name": "Episode 1 Rough Cut",
    "version": 4,
    "timeline_json": {},
    "updated_at": "2026-03-13T15:20:00Z"
  }
}
```

### POST `/api/v1/editor/projects/{type}/{id}/timeline`

Create or overwrite timeline project.

Request:

```json
{
  "name": "Episode 1 Rough Cut",
  "timeline_json": {
    "fps": 24,
    "duration": 123.45,
    "tracks": []
  }
}
```

Response:

```json
{
  "success": true,
  "timeline_project_id": 55,
  "version": 5,
  "saved_at": "2026-03-13T15:30:00Z"
}
```

### POST `/api/v1/editor/timeline/{timeline_project_id}/autosave`

Lightweight autosave endpoint.

## 5. Export Endpoints

### POST `/api/v1/editor/exports/init`

Create an export record before upload.

Request:

```json
{
  "project_type": "episode",
  "project_id": 12,
  "title": "Episode 1 Draft Export",
  "export_type": "draft",
  "duration_seconds": 640.4,
  "resolution": "1920x1080"
}
```

Response:

```json
{
  "export_id": 91,
  "upload_url": "https://signed-upload-url",
  "storage_path": "uploads/exports/episode_12_draft.mp4"
}
```

### POST `/api/v1/editor/exports/{export_id}/complete`

Mark export upload complete.

Request:

```json
{
  "file_size_bytes": 90440444,
  "thumbnail_url": "https://..."
}
```

### GET `/api/v1/editor/projects/{type}/{id}/exports`

List exports for that project.

## 6. Publishing Endpoints

### POST `/api/v1/editor/exports/{export_id}/publish`

Create a public-facing media record from an export.

Request:

```json
{
  "media_type": "clip",
  "title": "Episode 1 Trailer",
  "description": "A first look at the season.",
  "visibility": "public",
  "thumbnail_url": "https://..."
}
```

### GET `/api/v1/editor/publish-destinations`

Return valid destination types:

- series public media
- film public media
- studio visual feed
- draft only

## 7. Supporting Data Endpoints

### GET `/api/v1/editor/music-library`

Optional filtered access to music assets.

### GET `/api/v1/editor/templates/titles`

Optional title card presets.

### GET `/api/v1/editor/user/preferences`

Return editor settings:

- default export resolution
- default fps
- autosave interval

## 8. Timeline JSON Model

Recommended shape:

```json
{
  "fps": 24,
  "duration": 128.4,
  "tracks": [
    {
      "id": "video-1",
      "type": "video",
      "items": [
        {
          "id": "item-1",
          "asset_id": 101,
          "start": 0,
          "duration": 8.4,
          "source_in": 0,
          "source_out": 8.4,
          "transform": {
            "scale": 1,
            "position_x": 0,
            "position_y": 0
          }
        }
      ]
    },
    {
      "id": "audio-1",
      "type": "audio",
      "items": []
    }
  ]
}
```

## 9. Error Contract

All JSON errors should use a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ASSET_NOT_FOUND",
    "message": "Requested asset could not be found."
  }
}
```

## 10. Required Backend Tables

Minimum new tables:

- `editor_timeline_projects`
- `editor_exports`
- `editor_asset_cache_manifest` (optional)
- `editor_project_links` (optional depending on schema style)

## 11. Security Notes

- Respect studio visibility and permissions on every editor endpoint.
- Signed URLs should expire.
- Editor tokens should be revocable.
- Upload endpoints should validate file types and project ownership.

## 12. V1 API Priorities

Ship first:

1. auth
2. project discovery
3. assets list/download
4. timeline save/load
5. export init/complete
6. publish

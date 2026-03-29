# Asset Sync API (Audio/Video/Image)

This project now includes a lightweight asset sync layer for editor clients.

## Why this exists

When creators work from multiple devices (desktop app, browser editor, teammate workstation), local media libraries can drift. The asset sync endpoints provide a simple server-backed source of truth for uploaded assets.

## Endpoints

All endpoints are authenticated and available under `api/v1`.

- `POST /editor/assets/sync/upload`
  - Multipart form-data with required `asset` file field.
  - Optional fields:
    - `asset_key` (stable logical key; defaults to filename slug)
    - `project_type`
    - `project_id`
  - Upserts the asset in the current sync namespace.

- `GET /editor/assets/sync/changes?since=<ISO8601>&limit=100`
  - Returns changed/new assets after the `since` timestamp.
  - Omit `since` for first full sync.

- `GET /editor/assets/sync/download?asset_key=<key>`
  - Returns metadata + URL for the requested asset key.

- `POST /editor/assets/sync/delete`
  - JSON body with `asset_key`.
  - Marks an asset as deleted (tombstone) so all clients receive the removal through `changes`.

## Namespacing rules

Asset sync is automatically scoped by studio when one is selected.

- If a studio is selected: namespace is `studio_<studio_id>`.
- If no studio is selected: namespace is `user_<user_id>`.

This keeps teams isolated while still allowing solo workflows.

## Suggested client sync loop

1. Upload new/changed files with `POST /editor/assets/sync/upload`.
2. Persist returned `updated_at` cursor.
3. Poll `GET /editor/assets/sync/changes?since=<cursor>` on interval/app boot.
4. For changed assets:
   - if `deleted=true`, remove local copy.
   - otherwise compare `checksum_sha256` and fetch by URL if stale.

## Validation rules

- Allowed extensions: images (`jpg`, `jpeg`, `png`, `gif`, `webp`), audio (`mp3`, `wav`, `ogg`, `m4a`, `aac`, `flac`), and video (`mp4`, `mov`, `webm`, `mkv`).
- Maximum file size: 1GB.

## Storage location

Uploaded files and manifests are written under:

`uploads/editor_asset_sync/<namespace>/`

Each namespace maintains a `manifest.json` used by the changes feed.

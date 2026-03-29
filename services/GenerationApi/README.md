# GenerationApi (C#)

ASP.NET Core minimal API server for queuing generation jobs and dispatching them to ComfyUI-compatible servers.

## Endpoints

- `GET /health`
- `POST /api/v1/jobs`
- `GET /api/v1/jobs/{id}`
- `DELETE /api/v1/jobs/{id}` (cancel queued/running jobs)
- `POST /api/v1/jobs/{id}/retry` (clone + requeue completed/failed/canceled job)
- `GET /api/v1/jobs?take=50`
- `GET /api/v1/jobs/stats`

### Create Job Body

```json
{
  "type": "image",
  "prompt": "cinematic city skyline at sunset",
  "workflow": "optional serialized workflow",
  "callbackUrl": "https://example.com/hooks/generation",
  "metadata": {
    "projectId": "123"
  }
}
```

`type` supports: `image`, `video`, `audio`.

## Queue + Worker Behavior

1. API enqueues job and returns `202 Accepted`.
2. Background worker dequeues jobs.
3. Worker POSTs job payload to ComfyUI endpoint configured for type.
4. Job status transitions: `Queued -> Running -> Completed|Failed`.
5. Canceled jobs stop before dispatch (or before the next retry).
6. If `callbackUrl` is provided, terminal states (`Completed`, `Failed`, `Canceled`) trigger webhook callbacks.

## Configuration (`appsettings.json`)

```json
"ComfyUi": {
  "BaseUrl": "http://localhost:8188",
  "ImagePath": "/prompt",
  "VideoPath": "/prompt",
  "AudioPath": "/prompt",
  "ApiKey": "",
  "MaxDispatchAttempts": 3,
  "RetryDelayMs": 1500
}
```

You can set separate paths for image/video/audio adapters when your stack uses dedicated services.

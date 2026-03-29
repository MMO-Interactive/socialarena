using GenerationApi.Models;
using GenerationApi.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.Configure<ComfyUiOptions>(builder.Configuration.GetSection("ComfyUi"));
builder.Services.AddHttpClient<ComfyUiClient>();
builder.Services.AddHttpClient<JobCallbackClient>();
builder.Services.AddSingleton<JobStore>();
builder.Services.AddSingleton<JobQueue>();
builder.Services.AddHostedService<GenerationJobWorker>();

var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new
{
    success = true,
    service = "generation-api",
    time = DateTimeOffset.UtcNow
}));

app.MapPost("/api/v1/jobs", (CreateJobRequest request, JobStore store, JobQueue queue) =>
{
    if (string.IsNullOrWhiteSpace(request.Prompt))
    {
        return Results.BadRequest(new { success = false, error = "prompt is required" });
    }

    if (!Enum.TryParse<GenerationType>(request.Type, ignoreCase: true, out var generationType))
    {
        return Results.BadRequest(new { success = false, error = "type must be image, video, or audio" });
    }

    var job = GenerationJob.Create(generationType, request.Prompt, request.Workflow, request.CallbackUrl, request.Metadata);
    store.Upsert(job);
    queue.Enqueue(job.Id);

    return Results.Accepted($"/api/v1/jobs/{job.Id}", new
    {
        success = true,
        job
    });
});

app.MapGet("/api/v1/jobs/{id:guid}", (Guid id, JobStore store) =>
{
    var job = store.Get(id);
    return job is null
        ? Results.NotFound(new { success = false, error = "job not found" })
        : Results.Ok(new { success = true, job });
});

app.MapDelete("/api/v1/jobs/{id:guid}", (Guid id, JobStore store) =>
{
    var job = store.Get(id);
    if (job is null)
    {
        return Results.NotFound(new { success = false, error = "job not found" });
    }

    var canceled = job.MarkCanceled();
    store.Upsert(job);

    return canceled
        ? Results.Ok(new { success = true, job })
        : Results.Conflict(new { success = false, error = $"job cannot be canceled in status {job.Status}" });
});

app.MapPost("/api/v1/jobs/{id:guid}/retry", (Guid id, JobStore store, JobQueue queue) =>
{
    var job = store.Get(id);
    if (job is null)
    {
        return Results.NotFound(new { success = false, error = "job not found" });
    }

    if (job.Status is JobStatus.Running or JobStatus.Queued)
    {
        return Results.Conflict(new { success = false, error = $"job is currently {job.Status} and cannot be retried" });
    }

    var retried = GenerationJob.Create(job.Type, job.Prompt, job.Workflow, job.CallbackUrl, job.Metadata);
    store.Upsert(retried);
    queue.Enqueue(retried.Id);

    return Results.Accepted($"/api/v1/jobs/{retried.Id}", new
    {
        success = true,
        original_job_id = job.Id,
        retried_job = retried
    });
});

app.MapGet("/api/v1/jobs", (JobStore store, int take = 50) =>
{
    var jobs = store.List(take);
    return Results.Ok(new
    {
        success = true,
        jobs,
        count = jobs.Count
    });
});

app.MapGet("/api/v1/jobs/stats", (JobStore store) =>
{
    var jobs = store.List(200);
    return Results.Ok(new
    {
        success = true,
        total = jobs.Count,
        queued = jobs.Count(x => x.Status == JobStatus.Queued),
        running = jobs.Count(x => x.Status == JobStatus.Running),
        completed = jobs.Count(x => x.Status == JobStatus.Completed),
        failed = jobs.Count(x => x.Status == JobStatus.Failed),
        canceled = jobs.Count(x => x.Status == JobStatus.Canceled),
    });
});

app.Run();

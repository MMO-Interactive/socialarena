using GenerationApi.Models;
using Microsoft.Extensions.Options;

namespace GenerationApi.Services;

public sealed class GenerationJobWorker : BackgroundService
{
    private readonly JobQueue _queue;
    private readonly JobStore _store;
    private readonly ComfyUiClient _comfyUiClient;
    private readonly JobCallbackClient _jobCallbackClient;
    private readonly ComfyUiOptions _options;
    private readonly ILogger<GenerationJobWorker> _logger;

    public GenerationJobWorker(
        JobQueue queue,
        JobStore store,
        ComfyUiClient comfyUiClient,
        JobCallbackClient jobCallbackClient,
        IOptions<ComfyUiOptions> options,
        ILogger<GenerationJobWorker> logger)
    {
        _queue = queue;
        _store = store;
        _comfyUiClient = comfyUiClient;
        _jobCallbackClient = jobCallbackClient;
        _options = options.Value;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            Guid jobId;
            try
            {
                jobId = await _queue.DequeueAsync(stoppingToken);
            }
            catch (OperationCanceledException)
            {
                break;
            }

            var job = _store.Get(jobId);
            if (job is null)
            {
                _logger.LogWarning("Skipping unknown job {JobId}", jobId);
                continue;
            }

            if (job.Status == JobStatus.Canceled)
            {
                _logger.LogInformation("Skipping canceled job {JobId}", jobId);
                await _jobCallbackClient.NotifyAsync(job, stoppingToken);
                continue;
            }

            var maxAttempts = Math.Max(1, _options.MaxDispatchAttempts);
            var retryDelay = Math.Max(250, _options.RetryDelayMs);

            for (var attempt = 1; attempt <= maxAttempts; attempt++)
            {
                try
                {
                    if (job.Status == JobStatus.Canceled)
                    {
                        _logger.LogInformation("Canceled while queued/running {JobId}", jobId);
                        break;
                    }

                    job.MarkRunning();
                    _store.Upsert(job);

                    var dispatchResult = await _comfyUiClient.DispatchAsync(job, stoppingToken);
                    job.MarkCompleted(dispatchResult.ProviderJobId, dispatchResult.ResultUrl);
                    _store.Upsert(job);
                    await _jobCallbackClient.NotifyAsync(job, stoppingToken);
                    break;
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Dispatch attempt {Attempt}/{MaxAttempts} failed for {JobId}", attempt, maxAttempts, jobId);
                    if (attempt >= maxAttempts)
                    {
                        job.MarkFailed(ex.Message);
                        _store.Upsert(job);
                        _logger.LogError(ex, "Job {JobId} exhausted all dispatch attempts", jobId);
                        await _jobCallbackClient.NotifyAsync(job, stoppingToken);
                        break;
                    }

                    await Task.Delay(retryDelay * attempt, stoppingToken);
                }
            }
        }
    }
}

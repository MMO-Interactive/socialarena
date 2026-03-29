namespace GenerationApi.Models;

public enum GenerationType
{
    Image,
    Video,
    Audio
}

public enum JobStatus
{
    Queued,
    Running,
    Completed,
    Failed,
    Canceled
}

public sealed class GenerationJob
{
    public Guid Id { get; init; }
    public GenerationType Type { get; init; }
    public JobStatus Status { get; private set; }
    public string Prompt { get; init; } = string.Empty;
    public string? Workflow { get; init; }
    public string? CallbackUrl { get; init; }
    public Dictionary<string, string>? Metadata { get; init; }
    public DateTimeOffset CreatedAt { get; init; }
    public DateTimeOffset UpdatedAt { get; private set; }
    public string? ProviderJobId { get; private set; }
    public string? ResultUrl { get; private set; }
    public string? ErrorMessage { get; private set; }
    public int AttemptCount { get; private set; }

    public static GenerationJob Create(
        GenerationType type,
        string prompt,
        string? workflow,
        string? callbackUrl,
        Dictionary<string, string>? metadata)
    {
        var now = DateTimeOffset.UtcNow;
        return new GenerationJob
        {
            Id = Guid.NewGuid(),
            Type = type,
            Status = JobStatus.Queued,
            Prompt = prompt,
            Workflow = workflow,
            CallbackUrl = callbackUrl,
            Metadata = metadata,
            CreatedAt = now,
            UpdatedAt = now,
        };
    }

    public void MarkRunning()
    {
        Status = JobStatus.Running;
        AttemptCount += 1;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void MarkCompleted(string providerJobId, string? resultUrl)
    {
        Status = JobStatus.Completed;
        ProviderJobId = providerJobId;
        ResultUrl = resultUrl;
        ErrorMessage = null;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public void MarkFailed(string error)
    {
        Status = JobStatus.Failed;
        ErrorMessage = error;
        UpdatedAt = DateTimeOffset.UtcNow;
    }

    public bool MarkCanceled()
    {
        if (Status is JobStatus.Completed or JobStatus.Failed or JobStatus.Canceled)
        {
            return false;
        }

        Status = JobStatus.Canceled;
        ErrorMessage = "Canceled by user.";
        UpdatedAt = DateTimeOffset.UtcNow;
        return true;
    }
}

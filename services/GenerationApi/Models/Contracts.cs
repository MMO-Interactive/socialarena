namespace GenerationApi.Models;

public sealed class CreateJobRequest
{
    public string Type { get; init; } = string.Empty;
    public string Prompt { get; init; } = string.Empty;
    public string? Workflow { get; init; }
    public string? CallbackUrl { get; init; }
    public Dictionary<string, string>? Metadata { get; init; }
}

public sealed class ProviderDispatchResult
{
    public required string ProviderJobId { get; init; }
    public string? ResultUrl { get; init; }
}

public sealed class ComfyUiOptions
{
    public string BaseUrl { get; init; } = "http://localhost:8188";
    public string ImagePath { get; init; } = "/prompt";
    public string VideoPath { get; init; } = "/prompt";
    public string AudioPath { get; init; } = "/prompt";
    public string? ApiKey { get; init; }
    public int MaxDispatchAttempts { get; init; } = 3;
    public int RetryDelayMs { get; init; } = 1500;
}

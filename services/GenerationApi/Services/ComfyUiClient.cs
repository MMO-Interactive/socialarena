using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using GenerationApi.Models;
using Microsoft.Extensions.Options;

namespace GenerationApi.Services;

public sealed class ComfyUiClient
{
    private readonly HttpClient _httpClient;
    private readonly ComfyUiOptions _options;

    public ComfyUiClient(HttpClient httpClient, IOptions<ComfyUiOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;

        _httpClient.BaseAddress = new Uri(_options.BaseUrl);
        if (!string.IsNullOrWhiteSpace(_options.ApiKey))
        {
            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
        }
    }

    public async Task<ProviderDispatchResult> DispatchAsync(GenerationJob job, CancellationToken cancellationToken)
    {
        var path = job.Type switch
        {
            GenerationType.Image => _options.ImagePath,
            GenerationType.Video => _options.VideoPath,
            GenerationType.Audio => _options.AudioPath,
            _ => _options.ImagePath
        };

        var payload = new
        {
            prompt = job.Prompt,
            workflow = job.Workflow,
            metadata = job.Metadata,
            request_id = job.Id
        };

        using var request = new HttpRequestMessage(HttpMethod.Post, path)
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var content = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new InvalidOperationException($"ComfyUI dispatch failed ({(int)response.StatusCode}): {content}");
        }

        using var json = JsonDocument.Parse(content);
        var providerJobId = json.RootElement.TryGetProperty("prompt_id", out var promptId)
            ? promptId.GetString()
            : json.RootElement.TryGetProperty("job_id", out var jobId)
                ? jobId.GetString()
                : null;

        if (string.IsNullOrWhiteSpace(providerJobId))
        {
            providerJobId = job.Id.ToString("N");
        }

        var resultUrl = json.RootElement.TryGetProperty("result_url", out var resultUrlElement)
            ? resultUrlElement.GetString()
            : null;

        return new ProviderDispatchResult
        {
            ProviderJobId = providerJobId,
            ResultUrl = resultUrl
        };
    }
}

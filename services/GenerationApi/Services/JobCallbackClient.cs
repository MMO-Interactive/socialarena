using System.Text;
using System.Text.Json;
using GenerationApi.Models;

namespace GenerationApi.Services;

public sealed class JobCallbackClient
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<JobCallbackClient> _logger;

    public JobCallbackClient(HttpClient httpClient, ILogger<JobCallbackClient> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task NotifyAsync(GenerationJob job, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(job.CallbackUrl))
        {
            return;
        }

        try
        {
            var payload = new
            {
                job_id = job.Id,
                status = job.Status.ToString(),
                type = job.Type.ToString(),
                provider_job_id = job.ProviderJobId,
                result_url = job.ResultUrl,
                attempts = job.AttemptCount,
                error = job.ErrorMessage,
                updated_at = job.UpdatedAt
            };

            using var request = new HttpRequestMessage(HttpMethod.Post, job.CallbackUrl)
            {
                Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
            };

            using var response = await _httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                _logger.LogWarning("Job callback for {JobId} returned status {StatusCode}", job.Id, (int) response.StatusCode);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed sending callback for job {JobId}", job.Id);
        }
    }
}

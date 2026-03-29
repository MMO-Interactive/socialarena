using System.Collections.Concurrent;
using GenerationApi.Models;

namespace GenerationApi.Services;

public sealed class JobStore
{
    private readonly ConcurrentDictionary<Guid, GenerationJob> _jobs = new();

    public void Upsert(GenerationJob job) => _jobs[job.Id] = job;

    public GenerationJob? Get(Guid id) => _jobs.TryGetValue(id, out var job) ? job : null;

    public IReadOnlyList<GenerationJob> List(int take)
    {
        var safeTake = Math.Clamp(take, 1, 200);
        return _jobs.Values
            .OrderByDescending(x => x.CreatedAt)
            .Take(safeTake)
            .ToList();
    }
}

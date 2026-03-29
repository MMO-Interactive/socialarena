using System.Threading.Channels;

namespace GenerationApi.Services;

public sealed class JobQueue
{
    private readonly Channel<Guid> _channel = Channel.CreateUnbounded<Guid>();

    public void Enqueue(Guid id)
    {
        if (!_channel.Writer.TryWrite(id))
        {
            throw new InvalidOperationException("Unable to enqueue job.");
        }
    }

    public ValueTask<Guid> DequeueAsync(CancellationToken cancellationToken) =>
        _channel.Reader.ReadAsync(cancellationToken);
}

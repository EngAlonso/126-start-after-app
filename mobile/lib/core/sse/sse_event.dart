/// A single parsed Server-Sent Event frame (`event:` / `data:` lines).
class SseEvent {
  const SseEvent({required this.event, required this.data});

  final String event;
  final String data;

  @override
  String toString() => 'SseEvent(event: $event, data: $data)';
}

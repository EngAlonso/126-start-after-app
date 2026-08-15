import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/env.dart';
import '../constants/app_constants.dart';
import '../storage/secure_storage_service.dart';
import 'sse_event.dart';

/// Minimal Server-Sent Events client built on a streamed `http` GET.
///
/// Native mobile HTTP clients (and `dart:io`/`package:http`) cannot attach
/// a custom `Authorization` header to a long-lived streamed GET the way a
/// browser's `EventSource` polyfill can — so, matching the backend's
/// documented mobile auth path (see `ApiEndpoints.userEvents` /
/// `artifacts/api-server/src/routes/events.ts`), the JWT is sent as a
/// `?token=` query parameter instead of a header.
///
/// Reconnects with backoff on disconnect, and treats a stretch of silence
/// longer than [AppConstants.sseWatchdogTimeout] as a dead connection even
/// if the OS socket hasn't noticed yet (the backend pings every 25s, so a
/// healthy connection is never silent that long).
class SseClient {
  SseClient({
    required SecureStorageService storage,
    required String path,
    http.Client? client,
  })  : _storage = storage,
        _path = path,
        _client = client ?? http.Client();

  final SecureStorageService _storage;
  final String _path;
  final http.Client _client;

  StreamController<SseEvent>? _controller;
  http.StreamedResponse? _response;
  StreamSubscription<String>? _lineSubscription;
  Timer? _watchdog;
  bool _closed = false;
  int _reconnectAttempt = 0;

  Stream<SseEvent> connect() {
    _closed = false;
    _controller = StreamController<SseEvent>.broadcast(
      onCancel: close,
    );
    unawaited(_connectLoop());
    return _controller!.stream;
  }

  Future<void> _connectLoop() async {
    while (!_closed) {
      try {
        await _connectOnce();
      } catch (_) {
        // fall through to backoff + retry below
      }
      if (_closed) return;
      _reconnectAttempt++;
      final delaySeconds = [1, 2, 5, 10, 20].elementAt(
        (_reconnectAttempt - 1).clamp(0, 4),
      );
      await Future.delayed(Duration(seconds: delaySeconds));
    }
  }

  Future<void> _connectOnce() async {
    final token = await _storage.getAccessToken();
    if (token == null) throw StateError('no access token for SSE connection');

    final uri = Uri.parse('${Env.apiBaseUrl}$_path').replace(
      queryParameters: {'token': token},
    );
    final request = http.Request('GET', uri);
    _response = await _client.send(request);

    if (_response!.statusCode != 200) {
      throw HttpExceptionSse(_response!.statusCode);
    }

    _reconnectAttempt = 0;
    _resetWatchdog();

    final lines = _response!.stream.transform(utf8.decoder).transform(const LineSplitter());
    final completer = Completer<void>();

    _lineSubscription = lines.listen(
      (line) {
        _resetWatchdog();
        _handleLine(line);
      },
      onDone: () => completer.complete(),
      onError: (Object e, StackTrace st) => completer.completeError(e, st),
      cancelOnError: true,
    );

    await completer.future;
  }

  String? _pendingEvent;
  final StringBuffer _pendingData = StringBuffer();

  void _handleLine(String line) {
    if (line.isEmpty) {
      if (_pendingData.isNotEmpty) {
        _controller?.add(SseEvent(event: _pendingEvent ?? 'message', data: _pendingData.toString()));
      }
      _pendingEvent = null;
      _pendingData.clear();
      return;
    }
    if (line.startsWith(':')) return; // comment/ping frame, ignore
    if (line.startsWith('event:')) {
      _pendingEvent = line.substring(6).trim();
    } else if (line.startsWith('data:')) {
      if (_pendingData.isNotEmpty) _pendingData.write('\n');
      _pendingData.write(line.substring(5).trim());
    }
  }

  void _resetWatchdog() {
    _watchdog?.cancel();
    _watchdog = Timer(AppConstants.sseWatchdogTimeout, () {
      _lineSubscription?.cancel();
    });
  }

  Future<void> close() async {
    _closed = true;
    _watchdog?.cancel();
    await _lineSubscription?.cancel();
    _controller?.close();
  }
}

class HttpExceptionSse implements Exception {
  HttpExceptionSse(this.statusCode);
  final int statusCode;

  @override
  String toString() => 'SSE connection failed with status $statusCode';
}

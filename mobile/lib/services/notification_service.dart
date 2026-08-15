import 'package:dio/dio.dart';

import '../core/constants/api_endpoints.dart';
import '../models/notification_model.dart';

/// Thin HTTP wrapper around `GET /notifications` and the four read-mark
/// endpoints. Never modifies the backend — see
/// `artifacts/api-server/src/routes/notifications.ts` for the source of truth.
class NotificationService {
  NotificationService(this._dio);

  final Dio _dio;

  /// Fetches up to 50 notifications ordered newest-first.
  /// Pass [unreadOnly] = true to use `?unread=true` filter.
  Future<List<NotificationModel>> fetchNotifications({
    bool unreadOnly = false,
  }) async {
    final response = await _dio.get<List<dynamic>>(
      ApiEndpoints.notifications,
      queryParameters: unreadOnly ? {'unread': 'true'} : null,
    );
    final list = response.data ?? [];
    return list
        .map((e) => NotificationModel.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Marks a single notification as read.
  Future<void> markRead(int id) async {
    await _dio.post<void>(ApiEndpoints.notificationRead(id));
  }

  /// Marks every notification for the current user as read.
  Future<void> markAllRead() async {
    await _dio.post<void>(ApiEndpoints.notificationsReadAll);
  }
}

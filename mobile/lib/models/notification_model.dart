/// Mirrors the `notificationsTable` row shape from
/// `artifacts/api-server/src/routes/notifications.ts`.
class NotificationModel {
  const NotificationModel({
    required this.id,
    required this.userId,
    required this.title,
    required this.body,
    required this.type,
    required this.isRead,
    required this.createdAt,
    this.relatedId,
  });

  final int id;
  final int userId;
  final String title;
  final String body;

  /// Raw DB enum value — one of:
  /// new_request | new_offer | technician_selected | new_message |
  /// price_adjustment | status_change | support_reply | announcement |
  /// platform_credit_added | platform_credit_paid
  final String type;
  final bool isRead;

  /// Typically the service-request ID; drives deep-link navigation.
  final int? relatedId;
  final DateTime createdAt;

  bool get isUnread => !isRead;

  factory NotificationModel.fromJson(Map<String, dynamic> json) {
    return NotificationModel(
      id: json['id'] as int,
      userId: json['userId'] as int,
      title: json['title'] as String,
      body: json['body'] as String,
      type: json['type'] as String,
      isRead: json['isRead'] as bool? ?? false,
      relatedId: json['relatedId'] as int?,
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }

  NotificationModel copyWith({
    int? id,
    int? userId,
    String? title,
    String? body,
    String? type,
    bool? isRead,
    int? relatedId,
    DateTime? createdAt,
  }) {
    return NotificationModel(
      id: id ?? this.id,
      userId: userId ?? this.userId,
      title: title ?? this.title,
      body: body ?? this.body,
      type: type ?? this.type,
      isRead: isRead ?? this.isRead,
      relatedId: relatedId ?? this.relatedId,
      createdAt: createdAt ?? this.createdAt,
    );
  }
}

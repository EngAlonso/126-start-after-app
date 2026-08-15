/// A single row from `GET /api/conversations` — aggregated view of all
/// messages for one service request, as seen by the current user.
class ConversationModel {
  const ConversationModel({
    required this.requestId,
    required this.status,
    required this.serviceName,
    required this.customerId,
    required this.customerName,
    required this.technicianId,
    required this.technicianName,
    this.customerImage,
    this.technicianImage,
    this.lastMessage,
    this.lastMessageAt,
    this.lastMessageType,
    required this.messageCount,
    required this.unreadCount,
  });

  final int requestId;
  final String status;
  final String serviceName;
  final int customerId;
  final String customerName;
  final int? technicianId;
  final String? technicianName;
  final String? customerImage;
  final String? technicianImage;
  final String? lastMessage;
  final DateTime? lastMessageAt;
  final String? lastMessageType; // 'text' | 'image'
  final int messageCount;
  final int unreadCount;

  factory ConversationModel.fromJson(Map<String, dynamic> json) {
    return ConversationModel(
      requestId: json['request_id'] as int,
      status: json['status'] as String? ?? '',
      serviceName: json['service_name'] as String? ?? '',
      customerId: json['customer_id'] as int? ?? 0,
      customerName: json['customer_name'] as String? ?? '',
      technicianId: json['technician_id'] as int?,
      technicianName: json['technician_name'] as String?,
      customerImage: json['customer_image'] as String?,
      technicianImage: json['technician_image'] as String?,
      lastMessage: json['last_message'] as String?,
      lastMessageAt: json['last_message_at'] != null
          ? DateTime.tryParse(json['last_message_at'] as String)
          : null,
      lastMessageType: json['last_message_type'] as String?,
      messageCount: (json['message_count'] as num?)?.toInt() ?? 0,
      unreadCount: (json['unread_count'] as num?)?.toInt() ?? 0,
    );
  }

  /// True when [currentUserId] is the customer on this conversation (as
  /// opposed to the assigned technician). Used to decide which party's
  /// name/image to show as "the other person" — shared by both the
  /// customer and technician chat UIs.
  bool isCustomerView(int currentUserId) => currentUserId == customerId;

  /// Display name of the other party in the conversation, relative to
  /// [currentUserId]. Falls back to a generic label if the technician
  /// hasn't been assigned yet.
  String otherPartyName(int currentUserId) =>
      isCustomerView(currentUserId) ? (technicianName ?? 'فني') : customerName;

  /// Display image of the other party in the conversation, relative to
  /// [currentUserId].
  String? otherPartyImage(int currentUserId) =>
      isCustomerView(currentUserId) ? technicianImage : customerImage;
}

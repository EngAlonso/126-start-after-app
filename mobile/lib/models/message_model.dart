/// A single chat message from `GET /api/requests/:id/messages`.
class MessageModel {
  const MessageModel({
    required this.id,
    required this.requestId,
    required this.senderId,
    required this.content,
    required this.type,
    this.imageUrl,
    required this.isRead,
    required this.createdAt,
    this.senderName,
    this.senderImage,
    this.isOptimistic = false,
    this.isFailed = false,
  });

  final int id;
  final int requestId;
  final int senderId;
  final String content;
  final String type; // 'text' | 'image'
  final String? imageUrl;
  final bool isRead;
  final DateTime createdAt;
  final String? senderName;
  final String? senderImage;

  /// True while the message has been submitted but not yet confirmed by the server.
  final bool isOptimistic;

  /// True if the send attempt failed.
  final bool isFailed;

  factory MessageModel.fromJson(Map<String, dynamic> json) {
    final sender = json['sender'] as Map<String, dynamic>?;
    return MessageModel(
      id: json['id'] as int,
      requestId: json['requestId'] as int? ?? json['request_id'] as int? ?? 0,
      senderId: json['senderId'] as int? ?? json['sender_id'] as int? ?? 0,
      content: json['content'] as String? ?? '',
      type: json['type'] as String? ?? 'text',
      imageUrl: json['imageUrl'] as String? ?? json['image_url'] as String?,
      isRead: json['isRead'] as bool? ?? json['is_read'] as bool? ?? false,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : json['created_at'] != null
              ? DateTime.tryParse(json['created_at'] as String) ?? DateTime.now()
              : DateTime.now(),
      senderName: sender?['fullName'] as String?,
      senderImage: sender?['profileImage'] as String?,
    );
  }

  MessageModel copyWith({
    int? id,
    bool? isRead,
    bool? isOptimistic,
    bool? isFailed,
  }) {
    return MessageModel(
      id: id ?? this.id,
      requestId: requestId,
      senderId: senderId,
      content: content,
      type: type,
      imageUrl: imageUrl,
      isRead: isRead ?? this.isRead,
      createdAt: createdAt,
      senderName: senderName,
      senderImage: senderImage,
      isOptimistic: isOptimistic ?? this.isOptimistic,
      isFailed: isFailed ?? this.isFailed,
    );
  }
}

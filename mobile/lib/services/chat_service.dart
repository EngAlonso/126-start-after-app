import 'package:dio/dio.dart';

import '../core/constants/api_endpoints.dart';
import '../core/network/dio_client.dart';
import '../models/conversation_model.dart';
import '../models/message_model.dart';

class ChatService {
  ChatService(this._dio);

  final Dio _dio;

  /// `GET /api/conversations` — all conversations for the current user.
  Future<List<ConversationModel>> fetchConversations() async {
    try {
      final response = await _dio.get<List<dynamic>>(
        ApiEndpoints.conversations,
      );
      return (response.data ?? [])
          .cast<Map<String, dynamic>>()
          .map(ConversationModel.fromJson)
          .toList();
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  /// `GET /api/requests/:requestId/messages`
  Future<List<MessageModel>> fetchMessages(int requestId) async {
    try {
      final response = await _dio.get<List<dynamic>>(
        ApiEndpoints.requestMessages(requestId),
      );
      return (response.data ?? [])
          .cast<Map<String, dynamic>>()
          .map(MessageModel.fromJson)
          .toList();
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  /// `POST /api/requests/:requestId/messages`
  ///
  /// [type] is `'text'` (default) or `'image'`.
  /// [imageUrl] is required when [type] is `'image'`.
  Future<MessageModel> sendMessage(
    int requestId, {
    required String content,
    String type = 'text',
    String? imageUrl,
  }) async {
    try {
      final body = <String, dynamic>{'content': content, 'type': type};
      if (imageUrl != null) body['imageUrl'] = imageUrl;
      final response = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.requestMessages(requestId),
        data: body,
      );
      return MessageModel.fromJson(response.data!);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }

  /// `PATCH /api/requests/:requestId/messages/read-all`
  Future<void> markAllRead(int requestId) async {
    try {
      await _dio.patch<void>(ApiEndpoints.requestMessagesReadAll(requestId));
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }
}

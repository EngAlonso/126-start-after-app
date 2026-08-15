import 'package:dio/dio.dart';

import '../core/constants/api_endpoints.dart';
import '../core/network/dio_client.dart';

/// One category per accepted use on the existing `/upload/user` route
/// (see `artifacts/api-server/src/routes/upload.ts`) — kept as an enum so
/// callers can't pass an arbitrary string the backend doesn't recognize.
enum UploadCategory {
  chatImage,
  requestPhoto,
  profilePhoto,
  nationalId,
  voiceNote,
}

extension on UploadCategory {
  String get wireValue => switch (this) {
        UploadCategory.chatImage => 'chat',
        UploadCategory.requestPhoto => 'request',
        UploadCategory.profilePhoto => 'profile',
        UploadCategory.nationalId => 'national_id',
        UploadCategory.voiceNote => 'voice',
      };
}

class UploadedFile {
  const UploadedFile({required this.url});
  final String url;
}

/// Wraps `POST /api/upload/user` — local-disk storage used by
/// customer/technician-facing uploads. Admin CMS uploads (Cloudinary) are
/// out of scope for the mobile app.
class UploadService {
  UploadService(this._dio);

  final Dio _dio;

  Future<UploadedFile> uploadUserFile({
    required String filePath,
    required UploadCategory category,
  }) async {
    try {
      final formData = FormData.fromMap({
        'category': category.wireValue,
        'file': await MultipartFile.fromFile(filePath),
      });
      final response = await _dio.post<Map<String, dynamic>>(
        ApiEndpoints.uploadUser,
        data: formData,
      );
      return UploadedFile(url: response.data!['url'] as String);
    } on DioException catch (e) {
      throw DioClient.toApiException(e);
    }
  }
}

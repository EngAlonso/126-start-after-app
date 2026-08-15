import 'package:freezed_annotation/freezed_annotation.dart';

part 'service_model.freezed.dart';
part 'service_model.g.dart';

/// Mirrors a row from `GET /api/services` (see
/// `artifacts/api-server/src/routes/services.ts`), used by the technician
/// registration wizard's service-selection step.
@freezed
abstract class ServiceModel with _$ServiceModel {
  const factory ServiceModel({
    required int id,
    required String name,
    required String nameAr,
    String? icon,
    String? image,
    @Default(true) bool isActive,
    @Default(0) int displayOrder,
  }) = _ServiceModel;

  factory ServiceModel.fromJson(Map<String, dynamic> json) => _$ServiceModelFromJson(json);
}

import 'package:freezed_annotation/freezed_annotation.dart';

part 'area_model.freezed.dart';
part 'area_model.g.dart';

/// Mirrors a row from `GET /api/areas` (governorate is returned nested by
/// the backend but the wizard only needs `governorateId` to group areas
/// under each governorate, matching the web client's own grouping logic).
@freezed
abstract class AreaModel with _$AreaModel {
  const factory AreaModel({
    required int id,
    required String name,
    required String nameAr,
    required int governorateId,
    @Default(true) bool isActive,
  }) = _AreaModel;

  factory AreaModel.fromJson(Map<String, dynamic> json) => _$AreaModelFromJson(json);
}

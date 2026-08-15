import 'package:freezed_annotation/freezed_annotation.dart';

part 'governorate_model.freezed.dart';
part 'governorate_model.g.dart';

/// Mirrors a row from `GET /api/governorates`.
@freezed
abstract class GovernorateModel with _$GovernorateModel {
  const factory GovernorateModel({
    required int id,
    required String name,
    required String nameAr,
    @Default(true) bool isActive,
  }) = _GovernorateModel;

  factory GovernorateModel.fromJson(Map<String, dynamic> json) =>
      _$GovernorateModelFromJson(json);
}

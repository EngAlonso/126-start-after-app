import 'package:freezed_annotation/freezed_annotation.dart';

part 'technician_profile_model.freezed.dart';
part 'technician_profile_model.g.dart';

/// Mirrors the (already-stripped) technician profile embedded in
/// `formatUser()`'s response — large base64 image fields (`personalPhoto`,
/// `nationalIdFront`, `nationalIdBack`) are removed server-side before
/// this ever reaches a client, so they are intentionally absent here too.
@freezed
abstract class TechnicianProfileModel with _$TechnicianProfileModel {
  const factory TechnicianProfileModel({
    required int id,
    required int userId,
    String? status,
    int? pointsBalance,
    int? reservedPoints,
    int? yearsOfExperience,
  }) = _TechnicianProfileModel;

  factory TechnicianProfileModel.fromJson(Map<String, dynamic> json) =>
      _$TechnicianProfileModelFromJson(json);
}

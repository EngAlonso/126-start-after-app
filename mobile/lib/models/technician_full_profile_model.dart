import 'area_model.dart';
import 'service_model.dart';

/// Mirrors `GET /technicians/:id/profile` — a public (no-auth) route that
/// returns the technician's catalog data (services, coverage areas, years of
/// experience, approval status) plus aggregate rating stats. The backend
/// strips national-ID fields before responding.
///
/// Used by the Technician Profile screen (Phase 11F) to show the fields the
/// generic [UserModel]/[TechnicianProfileModel] don't carry. Hand-written
/// (not freezed) to match the existing [TechnicianPublicProfile] pattern for
/// read-only enriched profile data — see `models/offer_model.dart`.
class TechnicianFullProfileModel {
  const TechnicianFullProfileModel({
    required this.id,
    required this.userId,
    required this.approvalStatus,
    this.yearsOfExperience,
    required this.services,
    required this.areas,
    required this.averageRating,
    required this.reviewCount,
  });

  final int id;
  final int userId;
  final String approvalStatus;
  final int? yearsOfExperience;
  final List<ServiceModel> services;
  final List<AreaModel> areas;
  final double averageRating;
  final int reviewCount;

  factory TechnicianFullProfileModel.fromJson(Map<String, dynamic> json) =>
      TechnicianFullProfileModel(
        id: json['id'] as int,
        userId: json['userId'] as int,
        approvalStatus: json['approvalStatus'] as String? ?? 'pending',
        yearsOfExperience: json['yearsOfExperience'] as int?,
        services: (json['services'] as List<dynamic>? ?? [])
            .map((e) => ServiceModel.fromJson(e as Map<String, dynamic>))
            .toList(),
        areas: (json['areas'] as List<dynamic>? ?? [])
            .map((e) => AreaModel.fromJson(e as Map<String, dynamic>))
            .toList(),
        averageRating: json['averageRating'] == null
            ? 0
            : double.tryParse(json['averageRating'].toString()) ?? 0,
        reviewCount: json['reviewCount'] as int? ?? 0,
      );
}

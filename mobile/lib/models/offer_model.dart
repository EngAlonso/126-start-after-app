/// Mirrors a row from `GET /api/requests/:requestId/offers` — every field
/// the backend actually returns, nothing invented. Fields the backend never
/// sends (verification badge, online/offline, estimated duration) are
/// intentionally absent from this model rather than faked.
class OfferModel {
  const OfferModel({
    required this.id,
    required this.requestId,
    required this.technicianId,
    required this.price,
    required this.spareParts,
    required this.totalPrice,
    required this.notes,
    required this.status,
    required this.reservedPoints,
    required this.createdAt,
    required this.updatedAt,
    this.technician,
  });

  final int id;
  final int requestId;

  /// Null for an offer submitted by an admin on a technician's behalf
  /// (`POST /requests/:id/offers` allows `isAdmin` callers) — the backend
  /// stores `technicianId: null` for those.
  final int? technicianId;

  final double price;
  final double spareParts;
  final double totalPrice;
  final String? notes;

  /// One of: pending, selected, rejected, withdrawn (`offer_status` enum).
  final String status;
  final int reservedPoints;
  final String createdAt;
  final String updatedAt;

  /// Null exactly when [technicianId] is null (admin offer).
  final OfferTechnicianInfo? technician;

  bool get isAdminOffer => technician == null;
  bool get isPending => status == 'pending';
  bool get isSelected => status == 'selected';

  factory OfferModel.fromJson(Map<String, dynamic> json) {
    double asDouble(dynamic v) => v == null ? 0 : double.tryParse(v.toString()) ?? 0;

    return OfferModel(
      id: json['id'] as int,
      requestId: json['requestId'] as int,
      technicianId: json['technicianId'] as int?,
      price: asDouble(json['price']),
      spareParts: asDouble(json['spareParts']),
      totalPrice: asDouble(json['totalPrice']),
      notes: json['notes'] as String?,
      status: json['status'] as String? ?? 'pending',
      reservedPoints: json['reservedPoints'] as int? ?? 0,
      createdAt: json['createdAt']?.toString() ?? '',
      updatedAt: json['updatedAt']?.toString() ?? '',
      technician: json['technician'] is Map
          ? OfferTechnicianInfo.fromJson(json['technician'] as Map<String, dynamic>)
          : null,
    );
  }
}

/// Technician summary nested in each offer — averageRating/reviewCount are
/// computed server-side from all-time ratings, not scoped to this offer.
class OfferTechnicianInfo {
  const OfferTechnicianInfo({
    required this.id,
    required this.fullName,
    this.profileImage,
    this.mobile,
    required this.averageRating,
    required this.reviewCount,
  });

  final int id;
  final String fullName;
  final String? profileImage;
  final String? mobile;
  final double averageRating;
  final int reviewCount;

  factory OfferTechnicianInfo.fromJson(Map<String, dynamic> json) => OfferTechnicianInfo(
        id: json['id'] as int,
        fullName: json['fullName'] as String? ?? '',
        profileImage: json['profileImage'] as String?,
        mobile: json['mobile'] as String?,
        averageRating: json['averageRating'] == null
            ? 0
            : double.tryParse(json['averageRating'].toString()) ?? 0,
        reviewCount: json['reviewCount'] as int? ?? 0,
      );
}

/// Arabic label + semantic color for `offer_status` values — mirrors the
/// web app's `OFFER_STATUS_MAP` (`lib/status.ts`).
extension OfferStatusLabel on String {
  String get offerStatusLabelAr => switch (this) {
        'pending' => 'في الانتظار',
        'selected' => 'تم الاختيار',
        'rejected' => 'مرفوض',
        'withdrawn' => 'مسحوب',
        _ => this,
      };

  ({int r, int g, int b}) get offerStatusColorRgb => switch (this) {
        'pending' => (r: 233, g: 183, b: 58), // gold
        'selected' => (r: 34, g: 195, b: 93), // green
        'rejected' => (r: 220, g: 40, b: 40), // red
        _ => (r: 140, g: 140, b: 140), // gray (withdrawn)
      };
}

/// Enriched technician public profile (`GET /technicians/:id/public-profile`)
/// — used only on the Offer Details screen to show `completedJobs`, which
/// the offers-list endpoint does not include.
class TechnicianPublicProfile {
  const TechnicianPublicProfile({
    required this.id,
    required this.fullName,
    this.profileImage,
    required this.averageRating,
    required this.reviewCount,
    required this.completedJobs,
    required this.createdAt,
  });

  final int id;
  final String fullName;
  final String? profileImage;
  final double averageRating;
  final int reviewCount;
  final int completedJobs;
  final String createdAt;

  factory TechnicianPublicProfile.fromJson(Map<String, dynamic> json) => TechnicianPublicProfile(
        id: json['id'] as int,
        fullName: json['fullName'] as String? ?? '',
        profileImage: json['profileImage'] as String?,
        averageRating: json['averageRating'] == null
            ? 0
            : double.tryParse(json['averageRating'].toString()) ?? 0,
        reviewCount: json['reviewCount'] as int? ?? 0,
        completedJobs: json['completedJobs'] as int? ?? 0,
        createdAt: json['createdAt']?.toString() ?? '',
      );
}

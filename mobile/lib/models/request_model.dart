/// Mirrors a row from `POST /api/requests` and `GET /api/requests/:id`.
///
/// Written as a plain Dart class (no Freezed) since the code generator
/// is not run as part of the CI pipeline and this model is new.  The
/// existing Freezed models (ServiceModel, AreaModel, etc.) stay as-is.
class RequestModel {
  const RequestModel({
    required this.id,
    required this.customerId,
    required this.serviceId,
    required this.fullName,
    required this.mobile,
    required this.governorateId,
    required this.areaId,
    required this.address,
    required this.description,
    this.images = const [],
    this.audioUrl,
    this.status = 'pending',
    this.selectedTechnicianId,
    this.finalPrice,
    this.agreedPrice,
    this.customerPayableAmount,
    this.hasDiscount = false,
    this.adminNote,
    this.cancelReason,
    required this.createdAt,
    required this.updatedAt,
    this.offersCount = 0,
    this.service,
    this.governorate,
    this.area,
    this.customer,
    this.selectedTechnician,
    this.hasCoinDiscount = false,
  });

  final int id;
  final int customerId;
  final int serviceId;
  final String fullName;
  final String mobile;
  final int governorateId;
  final int areaId;
  final String address;
  final String description;
  final List<String> images;
  final String? audioUrl;
  final String status;
  final int? selectedTechnicianId;
  final String? finalPrice;
  final String? agreedPrice;
  final String? customerPayableAmount;
  final bool hasDiscount;
  final String? adminNote;
  final String? cancelReason;
  final String createdAt;
  final String updatedAt;

  /// Appended by the list endpoint only — not in the DB row itself.
  final int offersCount;

  /// The following are only populated by `GET /api/requests/:id`
  /// (the detail endpoint) — the list endpoint does not join them.
  final RequestServiceInfo? service;
  final RequestLocationInfo? governorate;
  final RequestLocationInfo? area;
  final RequestPersonInfo? customer;
  final RequestPersonInfo? selectedTechnician;
  final bool hasCoinDiscount;

  factory RequestModel.fromJson(Map<String, dynamic> json) {
    // images may arrive as a JSON array or null
    List<String> images = [];
    final rawImages = json['images'];
    if (rawImages is List) {
      images = rawImages.map((e) => e.toString()).toList();
    }

    return RequestModel(
      id: json['id'] as int,
      customerId: json['customerId'] as int,
      serviceId: json['serviceId'] as int,
      fullName: json['fullName'] as String,
      mobile: json['mobile'] as String,
      governorateId: json['governorateId'] as int,
      areaId: json['areaId'] as int,
      address: json['address'] as String,
      description: json['description'] as String,
      images: images,
      audioUrl: json['audioUrl'] as String?,
      status: json['status'] as String? ?? 'pending',
      selectedTechnicianId: json['selectedTechnicianId'] as int?,
      finalPrice: json['finalPrice']?.toString(),
      agreedPrice: json['agreedPrice']?.toString(),
      customerPayableAmount: json['customerPayableAmount']?.toString(),
      hasDiscount: json['hasDiscount'] as bool? ?? false,
      adminNote: json['adminNote'] as String?,
      cancelReason: json['cancelReason'] as String?,
      createdAt: json['createdAt']?.toString() ?? '',
      updatedAt: json['updatedAt']?.toString() ?? '',
      offersCount: json['offersCount'] as int? ?? 0,
      service: json['service'] is Map
          ? RequestServiceInfo.fromJson(json['service'] as Map<String, dynamic>)
          : null,
      governorate: json['governorate'] is Map
          ? RequestLocationInfo.fromJson(json['governorate'] as Map<String, dynamic>)
          : null,
      area: json['area'] is Map
          ? RequestLocationInfo.fromJson(json['area'] as Map<String, dynamic>)
          : null,
      customer: json['customer'] is Map
          ? RequestPersonInfo.fromJson(json['customer'] as Map<String, dynamic>)
          : null,
      selectedTechnician: json['selectedTechnician'] is Map
          ? RequestPersonInfo.fromJson(json['selectedTechnician'] as Map<String, dynamic>)
          : null,
      hasCoinDiscount: json['hasCoinDiscount'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'customerId': customerId,
        'serviceId': serviceId,
        'fullName': fullName,
        'mobile': mobile,
        'governorateId': governorateId,
        'areaId': areaId,
        'address': address,
        'description': description,
        'images': images,
        'audioUrl': audioUrl,
        'status': status,
        'selectedTechnicianId': selectedTechnicianId,
        'finalPrice': finalPrice,
        'agreedPrice': agreedPrice,
        'customerPayableAmount': customerPayableAmount,
        'hasDiscount': hasDiscount,
        'adminNote': adminNote,
        'cancelReason': cancelReason,
        'createdAt': createdAt,
        'updatedAt': updatedAt,
        'offersCount': offersCount,
      };
}

/// Minimal service info nested in the request-detail response
/// (`GET /api/requests/:id`) — mirrors `servicesTable` columns actually
/// selected server-side (`SELECT * FROM services`).
class RequestServiceInfo {
  const RequestServiceInfo({required this.id, required this.name, required this.nameAr, this.icon});

  final int id;
  final String nameAr;
  final String name;
  final String? icon;

  factory RequestServiceInfo.fromJson(Map<String, dynamic> json) => RequestServiceInfo(
        id: json['id'] as int,
        name: json['name'] as String? ?? '',
        nameAr: json['nameAr'] as String? ?? json['name'] as String? ?? '',
        icon: json['icon'] as String?,
      );
}

/// Governorate/area info nested in the request-detail response.
class RequestLocationInfo {
  const RequestLocationInfo({required this.id, required this.nameAr, required this.name});

  final int id;
  final String nameAr;
  final String name;

  factory RequestLocationInfo.fromJson(Map<String, dynamic> json) => RequestLocationInfo(
        id: json['id'] as int,
        name: json['name'] as String? ?? '',
        nameAr: json['nameAr'] as String? ?? json['name'] as String? ?? '',
      );
}

/// Customer/technician info nested in the request-detail response. `mobile`
/// is intentionally nullable — the backend strips it from the payload when
/// the viewer isn't authorized to see it yet (see `requests.ts` phone
/// visibility gate).
class RequestPersonInfo {
  const RequestPersonInfo({required this.id, required this.fullName, this.mobile, this.profileImage});

  final int id;
  final String fullName;
  final String? mobile;
  final String? profileImage;

  factory RequestPersonInfo.fromJson(Map<String, dynamic> json) => RequestPersonInfo(
        id: json['id'] as int,
        fullName: json['fullName'] as String? ?? '',
        mobile: json['mobile'] as String?,
        profileImage: json['profileImage'] as String?,
      );
}

/// Every backend status a customer's own request can be in, in the order
/// they occur in a normal (non-cancelled) lifecycle. Drives both the filter
/// chips and the timeline widget — never invent a status not in this list.
enum RequestStatus {
  pending,
  offersReceived,
  technicianSelected,
  inProgress,
  priceChangeRequested,
  waitingApproval,
  completed,
  cancelledByCustomer,
  cancelledByTechnician,
  cancelledByAdmin,
  disputed;

  static const _wireValues = {
    RequestStatus.pending: 'pending',
    RequestStatus.offersReceived: 'offers_received',
    RequestStatus.technicianSelected: 'technician_selected',
    RequestStatus.inProgress: 'in_progress',
    RequestStatus.priceChangeRequested: 'price_change_requested',
    RequestStatus.waitingApproval: 'waiting_approval',
    RequestStatus.completed: 'completed',
    RequestStatus.cancelledByCustomer: 'cancelled_by_customer',
    RequestStatus.cancelledByTechnician: 'cancelled_by_technician',
    RequestStatus.cancelledByAdmin: 'cancelled_by_admin',
    RequestStatus.disputed: 'disputed',
  };

  String get wireValue => _wireValues[this]!;

  static RequestStatus? fromWire(String value) {
    for (final entry in _wireValues.entries) {
      if (entry.value == value) return entry.key;
    }
    return null;
  }
}

/// The set of backend statuses that mean "cancelled", regardless of actor.
/// Used to group all three cancellation reasons under one filter tab.
const cancelledStatuses = {
  'cancelled_by_customer',
  'cancelled_by_technician',
  'cancelled_by_admin',
};

/// Arabic display label for each backend status value.
extension RequestStatusLabel on String {
  String get statusLabelAr => switch (this) {
        'pending' => 'قيد الانتظار',
        'offers_received' => 'وصلت عروض',
        'technician_selected' => 'تم اختيار فني',
        'in_progress' => 'قيد التنفيذ',
        'price_change_requested' => 'تعديل السعر',
        'waiting_approval' => 'بانتظار الموافقة',
        'completed' => 'مكتمل',
        'cancelled_by_customer' => 'ملغي',
        'cancelled_by_technician' => 'ملغي بواسطة الفني',
        'cancelled_by_admin' => 'ملغي بواسطة الإدارة',
        'disputed' => 'متنازع عليه',
        _ => this,
      };

  /// Color-coded semantic meaning for status badges.
  ({int r, int g, int b}) get statusColorRgb => switch (this) {
        'pending' => (r: 233, g: 183, b: 58),         // gold
        'offers_received' => (r: 60, g: 167, b: 221),  // blue
        'technician_selected' => (r: 34, g: 195, b: 93), // green
        'in_progress' => (r: 34, g: 195, b: 93),
        'completed' => (r: 34, g: 195, b: 93),
        'waiting_approval' => (r: 175, g: 87, b: 219), // purple
        'price_change_requested' => (r: 233, g: 149, b: 58), // orange
        _ => (r: 220, g: 40, b: 40),                   // red
      };

  bool get isCancelled => cancelledStatuses.contains(this);
}

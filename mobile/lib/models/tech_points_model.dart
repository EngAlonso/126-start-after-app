/// Mirrors `GET /api/points/balance` — technician commission points.
/// Different from the customer loyalty wallet (which lives at /loyalty/wallet
/// and is customer-only). Technicians use the points system at /points/*.
class TechPointsModel {
  const TechPointsModel({
    required this.balance,
    required this.reserved,
    required this.available,
  });

  /// Total points ever credited (from `pointsBalance` column).
  final int balance;

  /// Points currently locked against pending offers.
  final int reserved;

  /// balance − reserved — usable for new offers.
  final int available;

  factory TechPointsModel.fromJson(Map<String, dynamic> json) {
    int asInt(dynamic v) => v == null ? 0 : (v as num).toInt();
    return TechPointsModel(
      balance: asInt(json['balance']),
      reserved: asInt(json['reserved']),
      available: asInt(json['available']),
    );
  }
}

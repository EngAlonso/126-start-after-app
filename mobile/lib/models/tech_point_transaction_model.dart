/// Mirrors a row from `GET /api/points/transactions` — a technician's
/// commission-points ledger entry.
///
/// This is a distinct system from the customer loyalty coins ledger
/// ([CoinTransactionModel] / `GET /api/loyalty/transactions`) — the two have
/// separate backend type enums and are never interchangeable. See the
/// `point_transaction_type` Postgres enum for the authoritative type list:
/// credit, debit, commission, release.
class TechPointTransactionModel {
  const TechPointTransactionModel({
    required this.id,
    required this.amount,
    required this.type,
    required this.description,
    required this.createdAt,
    this.balanceAfter,
    this.requestId,
    this.performedBy,
  });

  final int id;
  final int amount;

  /// One of: credit, debit, commission, release.
  final String type;
  final String description;
  final DateTime createdAt;
  final int? balanceAfter;
  final int? requestId;

  /// Free-text actor label for admin-performed adjustments (e.g. "Super
  /// Admin"); null for system-generated entries (commission/release/offer
  /// debit), which instead carry [requestId].
  final String? performedBy;

  /// `credit` (admin top-up) and `release` (reserved points returned) add to
  /// the technician's usable balance; `debit` (new reservation) and
  /// `commission` (charged on completion) remove from it.
  bool get isCredit => type == 'credit' || type == 'release';

  String get typeLabel => switch (type) {
        'credit' => 'إضافة نقاط',
        'debit' => 'حجز نقاط',
        'commission' => 'عمولة',
        'release' => 'استرداد نقاط',
        _ => type,
      };

  factory TechPointTransactionModel.fromJson(Map<String, dynamic> json) {
    return TechPointTransactionModel(
      id: json['id'] as int,
      amount: (json['amount'] as num).toInt().abs(),
      type: json['type'] as String,
      description: json['description'] as String? ?? '',
      createdAt: DateTime.parse(json['createdAt'] as String),
      balanceAfter: (json['balanceAfter'] as num?)?.toInt(),
      requestId: json['requestId'] as int?,
      performedBy: json['performedBy'] as String?,
    );
  }
}

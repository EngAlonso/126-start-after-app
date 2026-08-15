/// Mirrors a row from `GET /api/loyalty/transactions`.
///
/// Transaction types returned by the backend:
///   earn_available   — coins became spendable after the maturation period.
///   earn_pending     — coins earned but not yet matured.
///   redeem           — coins reserved / spent on a request.
///   expiry           — coins that expired before being used.
///   referral_bonus   — reward for referring a new customer.
///   manual_credit    — admin adjustment (positive).
///   manual_debit     — admin adjustment (negative).
///   campaign         — coins from a loyalty campaign.
class CoinTransactionModel {
  const CoinTransactionModel({
    required this.id,
    required this.amount,
    required this.type,
    required this.createdAt,
    this.description,
    this.sourceType,
    this.sourceId,
    this.balanceAfter,
    this.expiresAt,
    this.cancelled = false,
  });

  final int id;
  final int amount;

  /// Raw backend type string — see class-level doc for valid values.
  final String type;
  final DateTime createdAt;
  final String? description;
  final String? sourceType;
  final int? sourceId;
  final int? balanceAfter;
  final DateTime? expiresAt;
  final bool cancelled;

  /// Whether this transaction adds coins to the wallet.
  bool get isCredit => switch (type) {
        'earn_available' ||
        'earn_pending' ||
        'referral_bonus' ||
        'manual_credit' ||
        'campaign' =>
          true,
        _ => false,
      };

  /// Arabic display label for the transaction type.
  String get typeLabel => switch (type) {
        'earn_available' => 'نقاط مكتسبة',
        'earn_pending' => 'نقاط قيد الانتظار',
        'redeem' => 'استخدام نقاط',
        'expiry' => 'انتهاء صلاحية',
        'referral_bonus' => 'مكافأة إحالة',
        'manual_credit' => 'إضافة يدوية',
        'manual_debit' => 'خصم يدوي',
        'campaign' => 'مكافأة حملة',
        _ => type,
      };

  factory CoinTransactionModel.fromJson(Map<String, dynamic> json) {
    return CoinTransactionModel(
      id: json['id'] as int,
      amount: (json['amount'] as num).toInt().abs(),
      type: json['type'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      description: json['description'] as String?,
      sourceType: json['sourceType'] as String?,
      sourceId: json['sourceId'] as int?,
      balanceAfter: (json['balanceAfter'] as num?)?.toInt(),
      expiresAt: json['expiresAt'] != null
          ? DateTime.tryParse(json['expiresAt'] as String)
          : null,
      cancelled: json['cancelled'] as bool? ?? false,
    );
  }
}

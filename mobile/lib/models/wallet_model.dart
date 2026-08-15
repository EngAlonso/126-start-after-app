/// Mirrors `GET /api/loyalty/wallet` response shape.
///
/// [availableCoins]  — spendable balance (net of reservations).
/// [pendingCoins]    — earned but not yet matured.
/// [reservedCoins]   — locked for an active request redemption.
/// [lifetimeEarned]  — total coins ever earned (historical).
/// [lifetimeUsed]    — total coins ever spent (historical).
/// [approximateDiscountValue] — EGP value of available coins (backend calc).
/// [coinName]        — Arabic coin name (e.g. "نقطة").
/// [coinNameEn]      — English coin name (e.g. "point").
/// [coinRedeemX]     — redemption formula numerator (X coins = Y EGP).
/// [coinRedeemY]     — redemption formula denominator.
/// [nextExpiration]  — next batch to expire, null if none.
class WalletModel {
  const WalletModel({
    required this.availableCoins,
    required this.pendingCoins,
    required this.reservedCoins,
    required this.lifetimeEarned,
    required this.lifetimeUsed,
    required this.approximateDiscountValue,
    required this.coinName,
    required this.coinNameEn,
    required this.coinRedeemX,
    required this.coinRedeemY,
    this.nextExpiration,
  });

  final int availableCoins;
  final int pendingCoins;
  final int reservedCoins;
  final int lifetimeEarned;
  final int lifetimeUsed;
  final double approximateDiscountValue;
  final String coinName;
  final String coinNameEn;
  final int coinRedeemX;
  final int coinRedeemY;
  final WalletExpiration? nextExpiration;

  int get totalCoins => availableCoins + pendingCoins + reservedCoins;

  factory WalletModel.fromJson(Map<String, dynamic> json) {
    return WalletModel(
      availableCoins: (json['availableCoins'] as num?)?.toInt() ?? 0,
      pendingCoins: (json['pendingCoins'] as num?)?.toInt() ?? 0,
      reservedCoins: (json['reservedCoins'] as num?)?.toInt() ?? 0,
      lifetimeEarned: (json['lifetimeEarned'] as num?)?.toInt() ?? 0,
      lifetimeUsed: (json['lifetimeUsed'] as num?)?.toInt() ?? 0,
      approximateDiscountValue:
          (json['approximateDiscountValue'] as num?)?.toDouble() ?? 0.0,
      coinName: json['coinName'] as String? ?? 'نقطة',
      coinNameEn: json['coinNameEn'] as String? ?? 'point',
      coinRedeemX: (json['coinRedeemX'] as num?)?.toInt() ?? 1,
      coinRedeemY: (json['coinRedeemY'] as num?)?.toInt() ?? 1,
      nextExpiration: json['nextExpiration'] is Map
          ? WalletExpiration.fromJson(
              json['nextExpiration'] as Map<String, dynamic>)
          : null,
    );
  }
}

/// The next-to-expire coin batch — shown as a warning in the wallet UI.
class WalletExpiration {
  const WalletExpiration({required this.amount, required this.expiresAt});

  final int amount;
  final DateTime expiresAt;

  factory WalletExpiration.fromJson(Map<String, dynamic> json) {
    return WalletExpiration(
      amount: (json['amount'] as num?)?.toInt() ?? 0,
      expiresAt: DateTime.parse(json['expiresAt'] as String),
    );
  }
}

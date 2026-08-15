/// Mirrors `GET /api/loyalty/referral-code` response shape.
class ReferralModel {
  const ReferralModel({
    this.referralCode,
    this.referralLink,
    required this.statistics,
    this.rewardHistory = const [],
  });

  final String? referralCode;
  final String? referralLink;
  final ReferralStatistics statistics;
  final List<ReferralHistoryItem> rewardHistory;

  factory ReferralModel.fromJson(Map<String, dynamic> json) {
    return ReferralModel(
      referralCode: json['referralCode'] as String?,
      referralLink: json['referralLink'] as String?,
      statistics: ReferralStatistics.fromJson(
          json['statistics'] as Map<String, dynamic>),
      rewardHistory: (json['rewardHistory'] as List<dynamic>? ?? [])
          .map((e) =>
              ReferralHistoryItem.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

/// Referral aggregate counters.
class ReferralStatistics {
  const ReferralStatistics({
    required this.pending,
    required this.completed,
    required this.rejected,
    required this.total,
    required this.totalRewardsEarned,
  });

  final int pending;
  final int completed;
  final int rejected;
  final int total;
  final int totalRewardsEarned;

  factory ReferralStatistics.fromJson(Map<String, dynamic> json) {
    return ReferralStatistics(
      pending: (json['pending'] as num?)?.toInt() ?? 0,
      completed: (json['completed'] as num?)?.toInt() ?? 0,
      rejected: (json['rejected'] as num?)?.toInt() ?? 0,
      total: (json['total'] as num?)?.toInt() ?? 0,
      totalRewardsEarned: (json['totalRewardsEarned'] as num?)?.toInt() ?? 0,
    );
  }
}

/// One entry in the referral history list — a person the user referred.
class ReferralHistoryItem {
  const ReferralHistoryItem({
    required this.id,
    required this.refereeName,
    required this.status,
    required this.referrerRewarded,
    required this.createdAt,
    this.rewardedAt,
  });

  final int id;
  final String refereeName;

  /// "pending" | "completed" | "fraud_flagged"
  final String status;
  final bool referrerRewarded;
  final DateTime createdAt;
  final DateTime? rewardedAt;

  String get statusLabel => switch (status) {
        'completed' => 'مكتملة',
        'fraud_flagged' => 'مرفوضة',
        _ => 'قيد الانتظار',
      };

  factory ReferralHistoryItem.fromJson(Map<String, dynamic> json) {
    return ReferralHistoryItem(
      id: json['id'] as int,
      refereeName: json['refereeName'] as String? ?? 'مستخدم',
      status: json['status'] as String? ?? 'pending',
      referrerRewarded: json['referrerRewarded'] as bool? ?? false,
      createdAt: DateTime.parse(json['createdAt'] as String),
      rewardedAt: json['rewardedAt'] != null
          ? DateTime.tryParse(json['rewardedAt'] as String)
          : null,
    );
  }
}

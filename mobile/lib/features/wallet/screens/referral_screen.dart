import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';
import '../../wallet/providers/wallet_provider.dart';
import '../widgets/referral_tile.dart';
import '../widgets/wallet_shared.dart';

/// Full-page referral screen — reached from the My Page dashboard card or
/// from the deep-link /referral route.
///
/// Sections:
///   1. Referral code card  (copy + share)
///   2. Stats grid          (total / completed / pending / coins earned)
///   3. How It Works steps  (3-step visual)
///   4. Invited friends     (reward history list)
class ReferralScreen extends ConsumerWidget {
  const ReferralScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark        = Theme.of(context).brightness == Brightness.dark;
    final referralAsync = ref.watch(referralProvider);
    final walletAsync   = ref.watch(walletProvider);

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground,
      appBar: AppBar(
        backgroundColor:      isDark ? AppColors.darkBackground : AppColors.lightBackground,
        surfaceTintColor:     Colors.transparent,
        elevation:            0,
        scrolledUnderElevation: 0,
        title: const Text(
          'دعوة الأصدقاء',
          style: TextStyle(fontWeight: FontWeight.w700),
        ),
        centerTitle: true,
      ),
      body: referralAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: AppColors.gold),
        ),
        error: (e, _) => _ErrorBody(
          onRetry: () => ref.invalidate(referralProvider),
        ),
        data: (referral) {
          final coinName = walletAsync.asData?.value?.coinName ?? 'نقطة';

          return RefreshIndicator(
            color: AppColors.gold,
            onRefresh: () async {
              ref.invalidate(referralProvider);
              ref.invalidate(walletProvider);
            },
            child: CustomScrollView(
              physics: const BouncingScrollPhysics(
                  parent: AlwaysScrollableScrollPhysics()),
              slivers: [
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
                  sliver: SliverList(
                    delegate: SliverChildListDelegate([
                      // ── Promo banner ─────────────────────────────────
                      _PromoBanner(coinName: coinName, isDark: isDark),
                      const SizedBox(height: 24),

                      // ── Referral code card ────────────────────────────
                      _ReferralCodeCard(
                        code: referral.referralCode ?? '------',
                        link: referral.referralLink ?? '',
                        isDark: isDark,
                      ),
                      const SizedBox(height: 24),

                      // ── Stats grid ────────────────────────────────────
                      _StatsGrid(
                        stats:     referral.statistics,
                        coinName:  coinName,
                        isDark:    isDark,
                      ),
                      const SizedBox(height: 28),

                      // ── How it works ──────────────────────────────────
                      _HowReferralWorks(isDark: isDark),
                      const SizedBox(height: 28),

                      // ── Invited friends history ───────────────────────
                      if (referral.rewardHistory.isNotEmpty) ...[
                        const _SectionTitle('الأصدقاء المدعوون'),
                        const SizedBox(height: 12),
                        ...referral.rewardHistory
                            .map((item) => ReferralTile(item: item)),
                      ] else
                        _EmptyHistory(),
                    ]),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}

// ── Promo banner ───────────────────────────────────────────────────────────────

class _PromoBanner extends StatelessWidget {
  const _PromoBanner({required this.coinName, required this.isDark});
  final String coinName;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      width:   double.infinity,
      padding: const EdgeInsets.all(AppDesign.spaceLG),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF3B82F6), Color(0xFF1D4ED8)],
          begin:  Alignment.topRight,
          end:    Alignment.bottomLeft,
        ),
        borderRadius: BorderRadius.circular(AppDesign.radiusXL),
        boxShadow: [
          BoxShadow(
            color:      const Color(0xFF3B82F6).withValues(alpha: 0.30),
            blurRadius: 20,
            offset:     const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        children: [
          const Icon(Icons.card_giftcard_rounded, color: Colors.white, size: 44),
          const SizedBox(height: 12),
          const Text(
            'ادعُ أصدقاءك وافتحوا الخدمات معاً',
            style: TextStyle(
              color: Colors.white, fontSize: 18, fontWeight: FontWeight.w800, height: 1.3,
            ),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'تحصل على $coinName مجاني عن كل صديق يُكمل طلبه الأول عبر فنشها',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.85),
              fontSize: 13,
              height: 1.5,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ── Referral code card ─────────────────────────────────────────────────────────

class _ReferralCodeCard extends StatelessWidget {
  const _ReferralCodeCard({
    required this.code,
    required this.link,
    required this.isDark,
  });
  final String code;
  final String link;
  final bool isDark;

  Future<void> _share() async {
    final text = link.isNotEmpty
        ? 'انضم إلى فنشها عبر رمز الدعوة الخاص بي: $code\n$link'
        : 'انضم إلى فنشها عبر رمز الدعوة الخاص بي: $code';
    await Share.share(text);
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:     const EdgeInsets.all(AppDesign.spaceLG),
      decoration: BoxDecoration(
        color:        isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(AppDesign.radiusXL),
        border:       Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
        boxShadow:   AppDesign.cardShadow(isDark: isDark),
      ),
      child: Column(
        children: [
          Text(
            'رمز الدعوة الخاص بك',
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: isDark
                  ? AppColors.darkMutedForeground
                  : AppColors.lightMutedForeground,
            ),
          ),
          const SizedBox(height: 14),

          // Big code display
          Container(
            padding:     const EdgeInsets.symmetric(horizontal: 28, vertical: 16),
            decoration: BoxDecoration(
              color:        AppColors.gold.withValues(alpha: isDark ? 0.15 : 0.10),
              borderRadius: BorderRadius.circular(AppDesign.radiusMD),
              border:       Border.all(
                color: AppColors.gold.withValues(alpha: 0.35),
                style: BorderStyle.solid,
              ),
            ),
            child: Text(
              code,
              style: const TextStyle(
                color:      AppColors.gold,
                fontSize:   28,
                fontWeight: FontWeight.w900,
                letterSpacing: 4,
              ),
            ),
          ),
          const SizedBox(height: 16),

          // Action buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.gold),
                    foregroundColor: AppColors.gold,
                    padding: const EdgeInsets.symmetric(vertical: 12),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppDesign.radiusMD),
                    ),
                  ),
                  icon:  const Icon(Icons.copy_rounded, size: 16),
                  label: const Text(
                    'نسخ الرمز',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  onPressed: () async {
                    await Clipboard.setData(ClipboardData(text: code));
                    if (!context.mounted) return;
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content:         Text('تم نسخ رمز الدعوة'),
                        behavior:        SnackBarBehavior.floating,
                        backgroundColor: AppColors.gold,
                        duration:        Duration(seconds: 2),
                      ),
                    );
                  },
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.gold,
                    foregroundColor: Colors.white,
                    padding:         const EdgeInsets.symmetric(vertical: 12),
                    elevation:       0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppDesign.radiusMD),
                    ),
                  ),
                  icon:  const Icon(Icons.share_rounded, size: 16),
                  label: const Text(
                    'مشاركة',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                  onPressed: _share,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Stats grid ─────────────────────────────────────────────────────────────────

class _StatsGrid extends StatelessWidget {
  const _StatsGrid({
    required this.stats,
    required this.coinName,
    required this.isDark,
  });
  final dynamic stats;
  final String coinName;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final items = [
      (label: 'إجمالي الدعوات',  value: '${stats.total}',             icon: Icons.people_rounded,          color: const Color(0xFF3B82F6)),
      (label: 'مكتملة',          value: '${stats.completed}',         icon: Icons.check_circle_rounded,    color: const Color(0xFF22C55E)),
      (label: 'قيد الانتظار',   value: '${stats.pending}',           icon: Icons.hourglass_top_rounded,   color: const Color(0xFFF59E0B)),
      (label: 'إجمالي المكافآت', value: '${stats.totalRewardsEarned} $coinName', icon: Icons.stars_rounded, color: AppColors.gold),
    ];

    return GridView.count(
      crossAxisCount:     2,
      crossAxisSpacing:   12,
      mainAxisSpacing:    12,
      shrinkWrap:         true,
      physics:            const NeverScrollableScrollPhysics(),
      childAspectRatio:   1.55,
      children: items.map((item) => _StatCard(
        label: item.label,
        value: item.value,
        icon:  item.icon,
        color: item.color,
        isDark: isDark,
      )).toList(),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
    required this.isDark,
  });
  final String label;
  final String value;
  final IconData icon;
  final Color color;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding:     const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color:        isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(AppDesign.radiusMD),
        border:       Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment:  MainAxisAlignment.spaceBetween,
        children: [
          Icon(icon, color: color, size: 20),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                value,
                style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              Text(
                label,
                style: TextStyle(
                  fontSize: 11,
                  color: isDark
                      ? AppColors.darkMutedForeground
                      : AppColors.lightMutedForeground,
                ),
                maxLines: 1,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── How Referral Works ─────────────────────────────────────────────────────────

class _HowReferralWorks extends StatelessWidget {
  const _HowReferralWorks({required this.isDark});
  final bool isDark;

  static const _steps = [
    (
      number:  '١',
      icon:    Icons.share_rounded,
      title:   'شارك رمزك',
      subtitle: 'أرسل رمز الدعوة الخاص بك لأصدقائك عبر واتساب أو أي وسيلة تواصل',
      color:   Color(0xFF3B82F6),
    ),
    (
      number:  '٢',
      icon:    Icons.person_add_rounded,
      title:   'ينضمون إلى فنشها',
      subtitle: 'يقوم صديقك بالتسجيل في التطبيق باستخدام رمز الدعوة الخاص بك',
      color:   AppColors.gold,
    ),
    (
      number:  '٣',
      icon:    Icons.stars_rounded,
      title:   'تحصل على مكافأتك',
      subtitle: 'بمجرد إتمام صديقك لأول طلب خدمة تُضاف النقاط إلى محفظتك فوراً',
      color:   Color(0xFF22C55E),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const _SectionTitle('كيف تعمل الإحالة؟'),
        const SizedBox(height: 16),
        Container(
          padding:     const EdgeInsets.all(AppDesign.spaceLG),
          decoration: BoxDecoration(
            color:        isDark ? AppColors.darkCard : AppColors.lightCard,
            borderRadius: BorderRadius.circular(AppDesign.radiusXL),
            border:       Border.all(
              color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
            ),
          ),
          child: Column(
            children: List.generate(_steps.length, (i) {
              final step   = _steps[i];
              final isLast = i == _steps.length - 1;
              return Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Number badge + connector
                  SizedBox(
                    width: 36,
                    child: Column(
                      children: [
                        Container(
                          width:  36,
                          height: 36,
                          decoration: BoxDecoration(
                            color:  step.color.withValues(alpha: 0.12),
                            shape:  BoxShape.circle,
                            border: Border.all(
                              color: step.color.withValues(alpha: 0.35),
                              width: 1.5,
                            ),
                          ),
                          child: Center(
                            child: Text(
                              step.number,
                              style: TextStyle(
                                color:      step.color,
                                fontSize:   15,
                                fontWeight: FontWeight.w900,
                              ),
                            ),
                          ),
                        ),
                        if (!isLast)
                          Container(
                            width:  2,
                            height: 36,
                            margin: const EdgeInsets.symmetric(vertical: 4),
                            color:  step.color.withValues(alpha: 0.25),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Padding(
                      padding: EdgeInsets.only(bottom: isLast ? 0 : 20, top: 4),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Icon(step.icon, color: step.color, size: 16),
                              const SizedBox(width: 8),
                              Text(
                                step.title,
                                style: const TextStyle(
                                  fontSize: 14, fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Text(
                            step.subtitle,
                            style: TextStyle(
                              fontSize: 12,
                              color:    isDark
                                  ? AppColors.darkMutedForeground
                                  : AppColors.lightMutedForeground,
                              height: 1.5,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              );
            }),
          ),
        ),
      ],
    );
  }
}

// ── Shared helpers ─────────────────────────────────────────────────────────────

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
    );
  }
}

class _EmptyHistory extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding:     const EdgeInsets.all(AppDesign.spaceXL),
      decoration: BoxDecoration(
        color:        Theme.of(context).colorScheme.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(AppDesign.radiusLG),
      ),
      child: Column(
        children: [
          const Icon(Icons.people_outline_rounded, size: 44, color: AppColors.gold),
          const SizedBox(height: 12),
          const Text(
            'لا توجد إحالات بعد',
            style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            'شارك رمزك مع أصدقائك وابدأ في تجميع المكافآت',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: Theme.of(context).colorScheme.onSurfaceVariant,
            ),
          ),
        ],
      ),
    );
  }
}

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.wifi_off_rounded, size: 48, color: AppColors.gold),
          const SizedBox(height: 12),
          const Text('تعذر تحميل بيانات الإحالة'),
          const SizedBox(height: 8),
          TextButton(onPressed: onRetry, child: const Text('إعادة المحاولة')),
        ],
      ),
    );
  }
}

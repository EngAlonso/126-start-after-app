import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../features/auth/providers/auth_providers.dart';
import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';
import '../../wallet/providers/loyalty_config_provider.dart';
import '../../wallet/providers/wallet_provider.dart';
import '../widgets/hero_banner_carousel.dart';

/// Customer dashboard tab — "My Page".
///
/// Sections:
///   • Personalised greeting
///   • Promotional banner carousel (existing Banner Management System)
///   • Wallet summary card → opens Wallet screen
///   • Referral card → opens Referral screen (reward from backend)
class MyPageTab extends ConsumerWidget {
  const MyPageTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    // Derive user name from auth state (no extra network call)
    final authState = ref.watch(authControllerProvider).value;
    final userName  = authState is Authenticated ? authState.user.fullName : 'عزيزي';

    // Wallet data for both cards
    final walletAsync        = ref.watch(walletProvider);
    // Still watch referralProvider so the referral screen's data is warm
    // even though we no longer derive the per-referral reward from it here.
    ref.watch(referralProvider);
    final loyaltyConfigAsync = ref.watch(loyaltyConfigProvider);

    return RefreshIndicator(
      color:       AppColors.gold,
      strokeWidth: 2.5,
      onRefresh: () async {
        ref.invalidate(walletProvider);
        ref.invalidate(referralProvider);
      },
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          // ── Greeting ──────────────────────────────────────────────────
          SliverToBoxAdapter(
            child: Container(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin:  Alignment.topCenter,
                  end:    Alignment.bottomCenter,
                  colors: isDark
                      ? [const Color(0xFF1F1700), AppColors.darkBackground]
                      : [const Color(0xFFFEF3D5), AppColors.lightBackground],
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '${_greeting()} 👋',
                    style: TextStyle(
                      fontSize: 13,
                      color:    Theme.of(context).colorScheme.onSurfaceVariant,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    userName,
                    maxLines:  1,
                    overflow:  TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize:   22,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'ماذا تحتاج اليوم؟',
                    style: TextStyle(
                      fontSize: 13,
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            ),
          ),

          // ── Promotional Banner ────────────────────────────────────────
          const SliverPadding(
            padding: EdgeInsets.fromLTRB(20, 0, 20, 0),
            sliver:  SliverToBoxAdapter(child: HeroBannerCarousel()),
          ),

          // ── Wallet & Referral cards ────────────────────────────────────
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
            sliver: SliverToBoxAdapter(
              child: Row(
                children: [
                  // Wallet card
                  Expanded(
                    child: walletAsync.when(
                      loading: () => _LoadingCard(),
                      error:   (_, __) => _WalletCard.empty(onTap: () => context.push(RoutePaths.wallet)),
                      data: (wallet) => _WalletCard(
                        coins:    wallet.availableCoins,
                        coinName: wallet.coinName,
                        egpValue: wallet.approximateDiscountValue,
                        onTap:    () => context.push(RoutePaths.wallet),
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Referral card
                  Expanded(
                    child: walletAsync.when(
                      loading: () => _LoadingCard(),
                      error:   (_, __) => _ReferralCard.empty(onTap: () => context.push(RoutePaths.referral)),
                      data: (wallet) {
                        // Per-referral reward comes from the admin loyalty config
                        // (referralReferrerCoins) — the authoritative source.
                        final configData = loyaltyConfigAsync.asData?.value;
                        final perReferralReward = configData != null
                            ? (configData['referralReferrerCoins'] as num?)?.toInt()
                            : null;

                        return _ReferralCard(
                          coinName:          wallet.coinName,
                          perReferralReward: perReferralReward,
                          onTap:             () => context.push(RoutePaths.referral),
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  static String _greeting() {
    final hour = DateTime.now().hour;
    if (hour < 12) return 'صباح الخير';
    if (hour < 17) return 'مساء الخير';
    return 'مساء النور';
  }
}

// ── Wallet card ────────────────────────────────────────────────────────────────

class _WalletCard extends StatelessWidget {
  const _WalletCard({
    required this.coins,
    required this.coinName,
    required this.egpValue,
    required this.onTap,
  });

  const _WalletCard.empty({required this.onTap})
      : coins    = 0,
        coinName = 'نقطة',
        egpValue = 0;

  final int    coins;
  final String coinName;
  final double egpValue;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _DashCard(
      onTap:      onTap,
      gradient:   const [Color(0xFFFFD700), Color(0xFFCF8F00)],
      shadowColor: AppColors.gold,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.stars_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 6),
              const Expanded(
                child: Text(
                  'محفظتي',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white, size: 12),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            '$coins',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w900,
              height: 1,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            coinName,
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.80),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color:        Colors.white.withValues(alpha: 0.20),
              borderRadius: BorderRadius.circular(AppDesign.radiusFull),
            ),
            child: Text(
              '≈ ${egpValue.toStringAsFixed(1)} ج.م',
              style: const TextStyle(
                color:      Colors.white,
                fontSize:   11,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Referral card ──────────────────────────────────────────────────────────────

class _ReferralCard extends StatelessWidget {
  const _ReferralCard({
    required this.coinName,
    required this.perReferralReward,
    required this.onTap,
  });

  const _ReferralCard.empty({required this.onTap})
      : coinName          = 'نقطة',
        perReferralReward = null;

  final String coinName;
  final int?   perReferralReward;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _DashCard(
      onTap:       onTap,
      gradient:    const [Color(0xFF3B82F6), Color(0xFF1D4ED8)],
      shadowColor: const Color(0xFF3B82F6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.card_giftcard_rounded, color: Colors.white, size: 20),
              const SizedBox(width: 6),
              const Expanded(
                child: Text(
                  'ادعُ صديقاً',
                  style: TextStyle(color: Colors.white, fontSize: 13, fontWeight: FontWeight.w600),
                ),
              ),
              const Icon(Icons.arrow_forward_ios_rounded, color: Colors.white, size: 12),
            ],
          ),
          const SizedBox(height: 14),
          // Dynamic reward from backend
          perReferralReward != null
              ? Text(
                  '$perReferralReward',
                  style: const TextStyle(
                    color: Colors.white, fontSize: 28, fontWeight: FontWeight.w900, height: 1,
                  ),
                )
              : const Icon(Icons.stars_rounded, color: Colors.white, size: 28),
          const SizedBox(height: 2),
          Text(
            perReferralReward != null ? coinName : 'اربح $coinName',
            style: TextStyle(
              color: Colors.white.withValues(alpha: 0.80),
              fontSize: 12,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
            decoration: BoxDecoration(
              color:        Colors.white.withValues(alpha: 0.20),
              borderRadius: BorderRadius.circular(AppDesign.radiusFull),
            ),
            child: const Text(
              'لكل إحالة ناجحة',
              style: TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Shared card container ──────────────────────────────────────────────────────

class _DashCard extends StatefulWidget {
  const _DashCard({
    required this.child,
    required this.onTap,
    required this.gradient,
    required this.shadowColor,
  });

  final Widget child;
  final VoidCallback onTap;
  final List<Color> gradient;
  final Color shadowColor;

  @override
  State<_DashCard> createState() => _DashCardState();
}

class _DashCardState extends State<_DashCard> {
  bool _pressed = false;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap:       widget.onTap,
      onTapDown:   (_) => setState(() => _pressed = true),
      onTapUp:     (_) => setState(() => _pressed = false),
      onTapCancel: () => setState(() => _pressed = false),
      child: AnimatedScale(
        scale:    _pressed ? 0.96 : 1.0,
        duration: const Duration(milliseconds: 80),
        child: Container(
          width:   double.infinity,
          padding: const EdgeInsets.all(AppDesign.spaceMD),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: widget.gradient,
              begin:  Alignment.topRight,
              end:    Alignment.bottomLeft,
            ),
            borderRadius: BorderRadius.circular(AppDesign.radiusLG),
            boxShadow: [
              BoxShadow(
                color:      widget.shadowColor.withValues(alpha: 0.30),
                blurRadius: 18,
                offset:     const Offset(0, 6),
              ),
            ],
          ),
          child: widget.child,
        ),
      ),
    );
  }
}

class _LoadingCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      height:      160,
      decoration: BoxDecoration(
        color:        Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AppDesign.radiusLG),
      ),
      child: const Center(
        child: SizedBox(
          width: 22, height: 22,
          child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.gold),
        ),
      ),
    );
  }
}

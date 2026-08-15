import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';

import '../../../models/referral_model.dart';
import '../../../theme/app_colors.dart';
import '../providers/wallet_provider.dart';
import '../widgets/balance_card.dart';
import '../widgets/referral_tile.dart';
import '../widgets/transaction_tile.dart';
import '../widgets/wallet_shared.dart';

/// Phase 9: Full wallet screen with tabs for overview, transactions, referrals.
///
/// Anchored by [CustomerHomeScreen] when the wallet bottom-nav item is tapped.
class WalletScreen extends ConsumerStatefulWidget {
  const WalletScreen({super.key});

  @override
  ConsumerState<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends ConsumerState<WalletScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.lightBackground,
      body: NestedScrollView(
        headerSliverBuilder: (context, innerBoxIsScrolled) => [
          // ── App bar ──────────────────────────────────────────────────
          SliverAppBar(
            pinned: true,
            floating: true,
            backgroundColor:
                isDark ? AppColors.darkBackground : AppColors.lightBackground,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            leading: BackButton(
              color: isDark ? AppColors.darkForeground : AppColors.lightForeground,
            ),
            title: Text(
              'المحفظة',
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            centerTitle: true,
            actions: [
              IconButton(
                icon: Icon(
                  Icons.refresh_rounded,
                  color: isDark
                      ? AppColors.darkMutedForeground
                      : AppColors.lightMutedForeground,
                ),
                tooltip: 'تحديث',
                onPressed: () {
                  ref.invalidate(walletProvider);
                  ref.invalidate(transactionsProvider);
                  ref.invalidate(referralProvider);
                },
              ),
            ],
            // Balance card in sliver
            bottom: PreferredSize(
              preferredSize: const Size.fromHeight(0),
              child: const SizedBox.shrink(),
            ),
          ),

          // ── Balance card ─────────────────────────────────────────────
          SliverToBoxAdapter(child: _BalanceSection()),

          // ── Tab bar ──────────────────────────────────────────────────
          SliverPersistentHeader(
            pinned: true,
            delegate: WalletTabBarDelegate(
              tabBar: TabBar(
                controller: _tabController,
                labelColor: AppColors.gold,
                unselectedLabelColor: isDark
                    ? AppColors.darkMutedForeground
                    : AppColors.lightMutedForeground,
                indicatorColor: AppColors.gold,
                indicatorWeight: 2.5,
                labelStyle: const TextStyle(
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
                tabs: const [
                  Tab(text: 'نظرة عامة'),
                  Tab(text: 'المعاملات'),
                  Tab(text: 'الإحالات'),
                ],
              ),
              isDark: isDark,
            ),
          ),
        ],
        body: TabBarView(
          controller: _tabController,
          children: [
            _OverviewTab(),
            _TransactionsTab(),
            _ReferralTab(),
          ],
        ),
      ),
    );
  }
}

// ─── Balance section (header) ─────────────────────────────────────────────────

class _BalanceSection extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final walletAsync = ref.watch(walletProvider);

    return walletAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: _BalanceSkeleton(),
      ),
      error: (e, _) => Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 20),
        child: WalletErrorCard(
          message: e.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(walletProvider),
        ),
      ),
      data: (wallet) => Padding(
        padding: const EdgeInsets.only(bottom: 8),
        child: BalanceCard(wallet: wallet),
      ),
    );
  }
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

class _OverviewTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final walletAsync = ref.watch(walletProvider);
    final textTheme = Theme.of(context).textTheme;

    return walletAsync.when(
      loading: () => const Center(child: CircularProgressIndicator(color: AppColors.gold)),
      error: (e, _) => Center(
        child: WalletErrorCard(
          message: e.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(walletProvider),
        ),
      ),
      data: (wallet) => ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        children: [
          // Redemption formula explanation
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                color: AppColors.gold.withValues(alpha: 0.22),
              ),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline_rounded,
                    color: AppColors.gold, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'كل ${wallet.coinRedeemX} ${wallet.coinName} = جنيه خصم من فاتورتك',
                    style: textTheme.bodyMedium?.copyWith(
                      color: AppColors.gold,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 20),

          // 2x2 metric grid
          Text(
            'تفاصيل الرصيد',
            style: textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: isDark
                  ? AppColors.darkMutedForeground
                  : AppColors.lightMutedForeground,
            ),
          ),
          const SizedBox(height: 12),

          Row(
            children: [
              Expanded(
                child: MetricCard(
                  icon: Icons.stars_rounded,
                  label: 'النقاط المتاحة',
                  value: '${wallet.availableCoins}',
                  subtitle:
                      '≈ ${wallet.approximateDiscountValue.toStringAsFixed(2)} ج.م',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: MetricCard(
                  icon: Icons.hourglass_top_rounded,
                  label: 'قيد الانتظار',
                  value: '${wallet.pendingCoins}',
                  subtitle: 'تنضج قريباً',
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: MetricCard(
                  icon: Icons.lock_outline_rounded,
                  label: 'محجوزة',
                  value: '${wallet.reservedCoins}',
                  subtitle: 'لطلبات نشطة',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: MetricCard(
                  icon: Icons.emoji_events_outlined,
                  label: 'مكتسبة مجمل',
                  value: '${wallet.lifetimeEarned}',
                  subtitle: 'منذ التسجيل',
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // How to earn section
          Text(
            'كيف تكسب النقاط؟',
            style: textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: isDark
                  ? AppColors.darkMutedForeground
                  : AppColors.lightMutedForeground,
            ),
          ),
          const SizedBox(height: 12),

          _HowToEarnCard(
            icon: Icons.home_repair_service_rounded,
            title: 'أكمل طلباتك',
            subtitle:
                'احصل على نقاط بعد اكتمال كل طلب خدمة وتأكيد الدفع.',
          ),
          const SizedBox(height: 10),
          _HowToEarnCard(
            icon: Icons.group_add_rounded,
            title: 'ادعُ أصدقاءك',
            subtitle:
                'اربح نقاط مكافأة لكل صديق يسجل عبر رابط الإحالة الخاص بك.',
          ),
          const SizedBox(height: 10),
          _HowToEarnCard(
            icon: Icons.campaign_rounded,
            title: 'حملات المكافآت',
            subtitle:
                'استفد من حملات المكافآت الدورية التي تطلقها المنصة.',
          ),
        ],
      ),
    );
  }
}

class _HowToEarnCard extends StatelessWidget {
  const _HowToEarnCard({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textTheme = Theme.of(context).textTheme;

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder,
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: AppColors.gold, size: 20),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title,
                    style: textTheme.bodyMedium
                        ?.copyWith(fontWeight: FontWeight.w700)),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: textTheme.bodySmall?.copyWith(
                    color: isDark
                        ? AppColors.darkMutedForeground
                        : AppColors.lightMutedForeground,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Transactions tab ─────────────────────────────────────────────────────────

class _TransactionsTab extends ConsumerStatefulWidget {
  @override
  ConsumerState<_TransactionsTab> createState() => _TransactionsTabState();
}

class _TransactionsTabState extends ConsumerState<_TransactionsTab> {
  final _scrollController = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollController.removeListener(_onScroll);
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >=
        _scrollController.position.maxScrollExtent - 200) {
      ref.read(transactionsProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final txAsync = ref.watch(transactionsProvider);

    return txAsync.when(
      loading: () =>
          const Center(child: CircularProgressIndicator(color: AppColors.gold)),
      error: (e, _) => Center(
        child: WalletErrorCard(
          message: e.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(transactionsProvider),
        ),
      ),
      data: (txState) {
        if (txState.items.isEmpty) {
          return const WalletEmptyState(
            icon: Icons.receipt_long_rounded,
            title: 'لا توجد معاملات بعد',
            subtitle: 'ستظهر هنا سجلات نقاطك بمجرد البدء باستخدام المنصة.',
          );
        }

        return RefreshIndicator(
          color: AppColors.gold,
          backgroundColor: isDark ? AppColors.darkCard : AppColors.lightCard,
          strokeWidth: 2.5,
          onRefresh: () => ref.read(transactionsProvider.notifier).refresh(),
          child: ListView.builder(
            controller: _scrollController,
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
            itemCount: txState.items.length + (txState.isLoadingMore ? 1 : 0),
            itemBuilder: (context, index) {
              if (index == txState.items.length) {
                return const Padding(
                  padding: EdgeInsets.symmetric(vertical: 16),
                  child: Center(
                    child: CircularProgressIndicator(
                      color: AppColors.gold,
                      strokeWidth: 2,
                    ),
                  ),
                );
              }
              final tx = txState.items[index];
              return TransactionTile(
                icon: _iconForCoinType(tx.type),
                typeLabel: tx.typeLabel,
                amount: tx.amount,
                isCredit: tx.isCredit,
                createdAt: tx.createdAt,
                description: tx.description,
                balanceAfter: tx.balanceAfter,
                cancelled: tx.cancelled,
                expiresAt: tx.expiresAt,
                isLast: index == txState.items.length - 1,
              );
            },
          ),
        );
      },
    );
  }
}

// ─── Referral tab ─────────────────────────────────────────────────────────────

class _ReferralTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final referralAsync = ref.watch(referralProvider);
    final textTheme = Theme.of(context).textTheme;

    return referralAsync.when(
      loading: () =>
          const Center(child: CircularProgressIndicator(color: AppColors.gold)),
      error: (e, _) => Center(
        child: WalletErrorCard(
          message: e.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(referralProvider),
        ),
      ),
      data: (referral) => RefreshIndicator(
        color: AppColors.gold,
        backgroundColor: isDark ? AppColors.darkCard : AppColors.lightCard,
        strokeWidth: 2.5,
        onRefresh: () => ref.read(referralProvider.notifier).refresh(),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
          children: [
            // ── Referral code card ──────────────────────────────────
            if (referral.referralCode != null)
              _ReferralCodeCard(referral: referral)
            else
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isDark ? AppColors.darkCard : AppColors.lightCard,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isDark
                        ? AppColors.darkCardBorder
                        : AppColors.lightCardBorder,
                  ),
                ),
                child: Text(
                  'تعذّر تحميل رمز الإحالة. يُرجى المحاولة لاحقاً.',
                  style: textTheme.bodyMedium?.copyWith(
                    color: isDark
                        ? AppColors.darkMutedForeground
                        : AppColors.lightMutedForeground,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),

            const SizedBox(height: 20),

            // ── Stats row ───────────────────────────────────────────
            Text(
              'إحصائيات الإحالة',
              style: textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w800,
                color: isDark
                    ? AppColors.darkMutedForeground
                    : AppColors.lightMutedForeground,
              ),
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: MetricCard(
                    icon: Icons.people_outline_rounded,
                    label: 'إجمالي الإحالات',
                    value: '${referral.statistics.total}',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: MetricCard(
                    icon: Icons.check_circle_outline_rounded,
                    label: 'مكتملة',
                    value: '${referral.statistics.completed}',
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: MetricCard(
                    icon: Icons.hourglass_empty_rounded,
                    label: 'قيد الانتظار',
                    value: '${referral.statistics.pending}',
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: MetricCard(
                    icon: Icons.stars_rounded,
                    label: 'نقاط مكتسبة',
                    value: '${referral.statistics.totalRewardsEarned}',
                  ),
                ),
              ],
            ),

            const SizedBox(height: 24),

            // ── History list ────────────────────────────────────────
            if (referral.rewardHistory.isNotEmpty) ...[
              Text(
                'سجل الإحالات',
                style: textTheme.titleSmall?.copyWith(
                  fontWeight: FontWeight.w800,
                  color: isDark
                      ? AppColors.darkMutedForeground
                      : AppColors.lightMutedForeground,
                ),
              ),
              const SizedBox(height: 12),
              ...referral.rewardHistory
                  .map((item) => ReferralTile(item: item)),
            ] else
              WalletEmptyState(
                icon: Icons.group_add_rounded,
                title: 'لا توجد إحالات بعد',
                subtitle:
                    'شارك رمز الإحالة الخاص بك وابدأ في كسب المكافآت.',
              ),
          ],
        ),
      ),
    );
  }
}

// ─── Referral code card ───────────────────────────────────────────────────────

class _ReferralCodeCard extends StatelessWidget {
  const _ReferralCodeCard({required this.referral});

  final ReferralModel referral;

  void _copyCode(BuildContext context) {
    Clipboard.setData(ClipboardData(text: referral.referralCode ?? ''));
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: const Text('تم نسخ رمز الإحالة'),
        behavior: SnackBarBehavior.floating,
        backgroundColor: AppColors.gold,
        duration: const Duration(seconds: 2),
      ),
    );
  }

  Future<void> _shareLink(BuildContext context) async {
    final link = referral.referralLink;
    if (link == null) return;
    await Share.share(
      'انضم إلى فنشها واحصل على خصومات! استخدم رمز الإحالة الخاص بي: ${referral.referralCode}\n$link',
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textTheme = Theme.of(context).textTheme;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topRight,
          end: Alignment.bottomLeft,
          colors: isDark
              ? [
                  AppColors.darkCard,
                  AppColors.darkSecondary,
                ]
              : [
                  AppColors.lightSidebar,
                  AppColors.lightSecondary,
                ],
        ),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: AppColors.gold.withValues(alpha: 0.30),
        ),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
            child: Column(
              children: [
                const Icon(Icons.card_giftcard_rounded,
                    color: AppColors.gold, size: 32),
                const SizedBox(height: 10),
                Text(
                  'رمز الإحالة الخاص بك',
                  style: textTheme.bodyLarge?.copyWith(
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  'شارك هذا الرمز مع أصدقائك واكسب نقاطاً عند تسجيلهم',
                  style: textTheme.bodySmall?.copyWith(
                    color: isDark
                        ? AppColors.darkMutedForeground
                        : AppColors.lightMutedForeground,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),

                // Code display
                GestureDetector(
                  onTap: () => _copyCode(context),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 24, vertical: 14),
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.darkBackground : Colors.white,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                          color: AppColors.gold.withValues(alpha: 0.40)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          referral.referralCode as String,
                          style: textTheme.headlineSmall?.copyWith(
                            fontWeight: FontWeight.w900,
                            color: AppColors.gold,
                            letterSpacing: 4,
                          ),
                        ),
                        const SizedBox(width: 12),
                        Icon(
                          Icons.copy_rounded,
                          color: AppColors.gold.withValues(alpha: 0.70),
                          size: 18,
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Share button
          if (referral.referralLink != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
              child: SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: () => _shareLink(context),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.gold,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(14),
                    ),
                  ),
                  icon: const Icon(Icons.share_rounded, size: 18),
                  label: const Text(
                    'مشاركة رابط الإحالة',
                    style: TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

// ─── Icon resolution (loyalty coin transaction types) ──────────────────────────

/// Loyalty-coin type set is disjoint from the technician points type set
/// (see `TechPointTransactionModel`), so each domain resolves its own icon
/// rather than baking a combined switch into the shared [TransactionTile].
IconData _iconForCoinType(String type) => switch (type) {
      'earn_available' => Icons.stars_rounded,
      'earn_pending' => Icons.hourglass_top_rounded,
      'redeem' => Icons.shopping_cart_checkout_rounded,
      'expiry' => Icons.timer_off_rounded,
      'referral_bonus' => Icons.group_add_rounded,
      'manual_credit' => Icons.add_circle_outline_rounded,
      'manual_debit' => Icons.remove_circle_outline_rounded,
      'campaign' => Icons.campaign_rounded,
      _ => Icons.swap_horiz_rounded,
    };

// ─── Balance skeleton (loading placeholder) ────────────────────────────────────

class _BalanceSkeleton extends StatelessWidget {
  const _BalanceSkeleton();

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      height: 190,
      decoration: BoxDecoration(
        color: isDark
            ? AppColors.darkCard
            : AppColors.lightCard,
        borderRadius: BorderRadius.circular(24),
      ),
      child: const Center(
        child: CircularProgressIndicator(color: AppColors.gold, strokeWidth: 2),
      ),
    );
  }
}

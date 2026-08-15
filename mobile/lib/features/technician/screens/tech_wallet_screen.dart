import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../theme/app_colors.dart';
import '../../wallet/widgets/balance_card.dart';
import '../../wallet/widgets/transaction_tile.dart';
import '../../wallet/widgets/wallet_shared.dart';
import '../providers/tech_providers.dart';
import '../widgets/points_balance_card.dart';

/// Phase 11D: Technician wallet — commission points balance + transaction
/// history. Structurally mirrors [WalletScreen] (customer loyalty coins),
/// reusing its tab bar / empty / error chrome ([WalletTabBarDelegate],
/// [WalletEmptyState], [WalletErrorCard]) and its generic [MetricCard] /
/// [TransactionTile] widgets — but reads from the technician points system
/// (`/api/points/*`), which is a separate backend from customer loyalty and
/// has no referral concept, so there is no third tab here.
///
/// Anchored by [TechnicianHomeScreen] via the wallet bottom-nav item and the
/// dashboard's [PointsBalanceCard] tap target.
class TechWalletScreen extends ConsumerStatefulWidget {
  const TechWalletScreen({super.key});

  @override
  ConsumerState<TechWalletScreen> createState() => _TechWalletScreenState();
}

class _TechWalletScreenState extends ConsumerState<TechWalletScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
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
          SliverAppBar(
            pinned: true,
            floating: true,
            backgroundColor:
                isDark ? AppColors.darkBackground : AppColors.lightBackground,
            surfaceTintColor: Colors.transparent,
            elevation: 0,
            leading: BackButton(
              color:
                  isDark ? AppColors.darkForeground : AppColors.lightForeground,
            ),
            title: Text(
              'محفظة النقاط',
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
                  ref.invalidate(techPointsProvider);
                  ref.invalidate(techTransactionsProvider);
                },
              ),
            ],
          ),

          // ── Balance card ─────────────────────────────────────────────
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.fromLTRB(20, 4, 20, 8),
              child: PointsBalanceCard(),
            ),
          ),

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
                ],
              ),
              isDark: isDark,
            ),
          ),
        ],
        body: TabBarView(
          controller: _tabController,
          children: const [
            _OverviewTab(),
            _TransactionsTab(),
          ],
        ),
      ),
    );
  }
}

// ─── Overview tab ─────────────────────────────────────────────────────────────

class _OverviewTab extends ConsumerWidget {
  const _OverviewTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final pointsAsync = ref.watch(techPointsProvider);
    final textTheme = Theme.of(context).textTheme;

    return pointsAsync.when(
      loading: () =>
          const Center(child: CircularProgressIndicator(color: AppColors.gold)),
      error: (e, _) => Center(
        child: WalletErrorCard(
          message: e.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(techPointsProvider),
        ),
      ),
      data: (pts) => ListView(
        padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.gold.withValues(alpha: 0.22)),
            ),
            child: Row(
              children: [
                const Icon(Icons.info_outline_rounded,
                    color: AppColors.gold, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'يتم حجز نقاط مقابل عمولة كل عرض تقدّمه، وتُخصم نهائياً عند اكتمال الطلب. النقاط المحجوزة تُسترد تلقائياً إذا لم يُقبل العرض.',
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
                  icon: Icons.account_balance_wallet_rounded,
                  label: 'الرصيد الكلي',
                  value: '${pts.balance}',
                  subtitle: 'إجمالي نقاطك',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: MetricCard(
                  icon: Icons.lock_outline_rounded,
                  label: 'محجوز',
                  value: '${pts.reserved}',
                  subtitle: 'لعروض نشطة',
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          MetricCard(
            icon: Icons.stars_rounded,
            label: 'المتاح للاستخدام',
            value: '${pts.available}',
            subtitle: 'الرصيد الكلي − المحجوز',
          ),

          const SizedBox(height: 20),

          Text(
            'كيف تعمل النقاط؟',
            style: textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w800,
              color: isDark
                  ? AppColors.darkMutedForeground
                  : AppColors.lightMutedForeground,
            ),
          ),
          const SizedBox(height: 12),

          const _HowPointsWorkCard(
            icon: Icons.local_offer_rounded,
            title: 'تقديم عرض',
            subtitle: 'يتم حجز نقاط تعادل عمولة الخدمة عند تقديم عرضك.',
          ),
          const SizedBox(height: 10),
          const _HowPointsWorkCard(
            icon: Icons.check_circle_outline_rounded,
            title: 'اكتمال الطلب',
            subtitle: 'تُخصم النقاط المحجوزة نهائياً كعمولة بعد إتمام العمل.',
          ),
          const SizedBox(height: 10),
          const _HowPointsWorkCard(
            icon: Icons.replay_circle_filled_rounded,
            title: 'استرداد تلقائي',
            subtitle:
                'إذا لم يُقبل عرضك أو أُلغي الطلب، تُعاد النقاط المحجوزة لرصيدك المتاح.',
          ),
        ],
      ),
    );
  }
}

class _HowPointsWorkCard extends StatelessWidget {
  const _HowPointsWorkCard({
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
  const _TransactionsTab();

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
      ref.read(techTransactionsProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final txAsync = ref.watch(techTransactionsProvider);

    return txAsync.when(
      loading: () =>
          const Center(child: CircularProgressIndicator(color: AppColors.gold)),
      error: (e, _) => Center(
        child: WalletErrorCard(
          message: e.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(techTransactionsProvider),
        ),
      ),
      data: (txState) {
        if (txState.items.isEmpty) {
          return const WalletEmptyState(
            icon: Icons.receipt_long_rounded,
            title: 'لا توجد معاملات بعد',
            subtitle: 'ستظهر هنا سجلات نقاطك بمجرد تقديم عروض أو إتمام طلبات.',
          );
        }

        return RefreshIndicator(
          color: AppColors.gold,
          backgroundColor: isDark ? AppColors.darkCard : AppColors.lightCard,
          strokeWidth: 2.5,
          onRefresh: () => ref.read(techTransactionsProvider.notifier).refresh(),
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
                icon: _iconForPointType(tx.type),
                typeLabel: tx.typeLabel,
                amount: tx.amount,
                isCredit: tx.isCredit,
                createdAt: tx.createdAt,
                description: tx.description,
                balanceAfter: tx.balanceAfter,
                isLast: index == txState.items.length - 1,
              );
            },
          ),
        );
      },
    );
  }
}

/// Technician point-transaction type set is disjoint from the customer
/// loyalty-coin type set (see `_iconForCoinType` in wallet_screen.dart), so
/// each domain resolves its own icon for the shared [TransactionTile].
IconData _iconForPointType(String type) => switch (type) {
      'credit' => Icons.add_circle_outline_rounded,
      'debit' => Icons.lock_outline_rounded,
      'commission' => Icons.receipt_long_rounded,
      'release' => Icons.replay_circle_filled_rounded,
      _ => Icons.swap_horiz_rounded,
    };

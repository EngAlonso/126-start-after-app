import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../theme/app_colors.dart';
import '../../wallet/widgets/balance_card.dart';
import '../../wallet/widgets/transaction_tile.dart';
import '../../wallet/widgets/wallet_shared.dart';
import '../providers/tech_providers.dart';
import '../widgets/points_balance_card.dart';

/// Technician point-transaction type → icon (mirrors [tech_wallet_screen.dart]).
IconData _iconForPointType(String type) => switch (type) {
      'credit'     => Icons.add_circle_outline_rounded,
      'debit'      => Icons.lock_outline_rounded,
      'commission' => Icons.receipt_long_rounded,
      'release'    => Icons.replay_circle_filled_rounded,
      _            => Icons.swap_horiz_rounded,
    };

/// Technician wallet content embedded as a tab in the main shell.
///
/// Mirrors [TechWalletScreen] content but has no own [Scaffold] or [AppBar]
/// — those are provided by the shell. Internally uses a [DefaultTabController]
/// with two tabs: نظرة عامة (overview) and المعاملات (transactions).
class TechWalletTab extends ConsumerStatefulWidget {
  const TechWalletTab({super.key});

  @override
  ConsumerState<TechWalletTab> createState() => _TechWalletTabState();
}

class _TechWalletTabState extends ConsumerState<TechWalletTab>
    with SingleTickerProviderStateMixin {
  late final TabController _tabCtrl;

  @override
  void initState() {
    super.initState();
    _tabCtrl = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return NestedScrollView(
      headerSliverBuilder: (_, __) => [
        // ── Balance card ─────────────────────────────────────────────────
        const SliverToBoxAdapter(
          child: Padding(
            padding: EdgeInsets.fromLTRB(20, 20, 20, 8),
            child: PointsBalanceCard(), // no onTap — already on wallet tab
          ),
        ),

        // ── Tab bar ──────────────────────────────────────────────────────
        SliverPersistentHeader(
          pinned: true,
          delegate: WalletTabBarDelegate(
            tabBar: TabBar(
              controller: _tabCtrl,
              labelColor: AppColors.gold,
              unselectedLabelColor: isDark
                  ? AppColors.darkMutedForeground
                  : AppColors.lightMutedForeground,
              indicatorColor:  AppColors.gold,
              indicatorWeight: 2.5,
              labelStyle:      const TextStyle(
                  fontWeight: FontWeight.w700, fontSize: 13),
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
        controller: _tabCtrl,
        children: const [
          _OverviewTab(),
          _TransactionsTab(),
        ],
      ),
    );
  }
}

// ── Overview tab ─────────────────────────────────────────────────────────────

class _OverviewTab extends ConsumerWidget {
  const _OverviewTab();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark    = Theme.of(context).brightness == Brightness.dark;
    final textTheme = Theme.of(context).textTheme;
    final pointsAsync = ref.watch(techPointsProvider);

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
          // Low-balance warning
          if (pts.available < 200) ...[
            Container(
              padding: const EdgeInsets.all(14),
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color:        AppColors.destructive.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(14),
                border: Border.all(
                    color: AppColors.destructive.withValues(alpha: 0.35)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.warning_amber_rounded,
                      color: AppColors.destructive, size: 22),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'رصيدك أقل من 200 نقطة! يرجى شحن نقاطك للاستمرار في تقديم العروض.',
                      style: textTheme.bodySmall?.copyWith(
                          color: AppColors.destructive,
                          fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
          ],

          // How points work
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color:        AppColors.gold.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(
                  color: AppColors.gold.withValues(alpha: 0.22)),
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
                      color:      AppColors.gold,
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
                  icon:  Icons.account_balance_wallet_rounded,
                  label: 'الرصيد الكلي',
                  value: '${pts.balance}',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: MetricCard(
                  icon:  Icons.lock_clock_rounded,
                  label: 'المحجوز',
                  value: '${pts.reserved}',
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: MetricCard(
                  icon:  Icons.stars_rounded,
                  label: 'المتاح',
                  value: '${pts.available}',
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

// ── Transactions tab ──────────────────────────────────────────────────────────

class _TransactionsTab extends ConsumerStatefulWidget {
  const _TransactionsTab();

  @override
  ConsumerState<_TransactionsTab> createState() => _TransactionsTabState();
}

class _TransactionsTabState extends ConsumerState<_TransactionsTab> {
  final _scrollCtrl = ScrollController();

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_onScroll);
    _scrollCtrl.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollCtrl.position.pixels >=
        _scrollCtrl.position.maxScrollExtent - 200) {
      ref.read(techTransactionsProvider.notifier).loadMore();
    }
  }

  @override
  Widget build(BuildContext context, ) {
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
      data: (state) {
        if (state.items.isEmpty) {
          return const Center(
            child: WalletEmptyState(
              icon:     Icons.receipt_long_rounded,
              title:    'لا توجد معاملات بعد',
              subtitle: 'ستظهر هنا سجلات نقاطك بعد تقديم العروض',
            ),
          );
        }

        return ListView.builder(
          controller: _scrollCtrl,
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
          itemCount: state.items.length + (state.isLoadingMore ? 1 : 0),
          itemBuilder: (context, index) {
            if (index == state.items.length) {
              return const Padding(
                padding: EdgeInsets.all(20),
                child: Center(
                  child: CircularProgressIndicator(
                      color: AppColors.gold, strokeWidth: 2.5),
                ),
              );
            }
            final tx = state.items[index];
            return TransactionTile(
              icon:        _iconForPointType(tx.type),
              typeLabel:   tx.typeLabel,
              amount:      tx.amount,
              isCredit:    tx.isCredit,
              createdAt:   tx.createdAt,
              description: tx.description,
              balanceAfter: tx.balanceAfter,
              isLast:      index == state.items.length - 1,
            );
          },
        );
      },
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../features/auth/providers/auth_providers.dart';
import '../../../models/user_model.dart';
import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';
import '../../auth/providers/catalog_providers.dart';
import '../providers/tech_job_providers.dart';
import '../providers/tech_providers.dart';
import '../widgets/points_balance_card.dart';
import '../widgets/tech_request_card.dart';

/// Technician "My Page" tab — the core technician dashboard.
///
/// Sections (top → bottom):
///   1. Greeting header (avatar, name, status chip, low-points warning)
///   2. Three colorful summary cards: Points • Active Jobs • My Ratings
///   3. Available requests snapshot (latest 5 from [techLatestRequestsProvider])
///   4. Recent finished requests (completed + cancelled, from [techRecentFinishedProvider])
class TechMyPageTab extends ConsumerWidget {
  const TechMyPageTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final UserModel? user = switch (authState.asData?.value) {
      Authenticated(:final user) => user,
      _ => null,
    };
    final pointsAsync = ref.watch(techPointsProvider);
    final lowBalance  = pointsAsync.asData?.value.available != null &&
        pointsAsync.asData!.value.available < 200;

    return CustomScrollView(
      physics: const BouncingScrollPhysics(),
      slivers: [
        // ── Greeting ─────────────────────────────────────────────────────
        SliverToBoxAdapter(child: _GreetingHeader(user: user)),

        // ── Low-points warning ────────────────────────────────────────────
        if (lowBalance)
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
            sliver: SliverToBoxAdapter(
              child: _LowPointsWarning(
                available: pointsAsync.asData!.value.available,
                onTap: () => context.push(RoutePaths.technicianWallet),
              ),
            ),
          ),

        // ── Summary cards ─────────────────────────────────────────────────
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
          sliver: SliverToBoxAdapter(
            child: _SummaryCards(user: user),
          ),
        ),

        // ── Available requests section header ─────────────────────────────
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
          sliver: SliverToBoxAdapter(
            child: _SectionHeader(
              title: 'الطلبات المتاحة',
              actionLabel: 'عرض الكل',
              onActionTap: () => context.push(RoutePaths.technicianRequests),
            ),
          ),
        ),

        // ── Available requests list ────────────────────────────────────────
        const _LatestRequestsSliver(),

        // ── Recent finished section header ────────────────────────────────
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 28, 20, 0),
          sliver: SliverToBoxAdapter(
            child: _SectionHeader(
              title: 'الطلبات المنتهية',
              actionLabel: 'عرض الكل',
              onActionTap: () => context.push(RoutePaths.technicianMyJobs),
            ),
          ),
        ),

        // ── Recent finished list ──────────────────────────────────────────
        const _RecentFinishedSliver(),

        const SliverToBoxAdapter(child: SizedBox(height: 32)),
      ],
    );
  }
}

// ── Greeting header ───────────────────────────────────────────────────────────

class _GreetingHeader extends StatelessWidget {
  const _GreetingHeader({required this.user});
  final UserModel? user;

  @override
  Widget build(BuildContext context) {
    final isDark    = Theme.of(context).brightness == Brightness.dark;
    final textTheme = Theme.of(context).textTheme;

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end:   Alignment.bottomCenter,
          colors: isDark
              ? [const Color(0xFF1F1700), AppColors.darkBackground]
              : [const Color(0xFFFEF3D5), AppColors.lightBackground],
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
          child: Row(
            children: [
              _TechAvatar(user: user),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'أهلاً،',
                      style: textTheme.bodySmall?.copyWith(
                        color: isDark
                            ? AppColors.darkMutedForeground
                            : AppColors.lightMutedForeground,
                      ),
                    ),
                    Text(
                      user?.fullName ?? '...',
                      style: textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    _StatusChip(user: user),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TechAvatar extends StatelessWidget {
  const _TechAvatar({required this.user});
  final UserModel? user;

  @override
  Widget build(BuildContext context) {
    final imageUrl = user?.profileImage;
    return Container(
      width: 56, height: 56,
      decoration: BoxDecoration(
        shape:  BoxShape.circle,
        border: Border.all(color: AppColors.gold, width: 2.5),
        color:  AppColors.gold.withValues(alpha: 0.12),
      ),
      child: ClipOval(
        child: imageUrl?.isNotEmpty == true
            ? Image.network(imageUrl!, fit: BoxFit.cover,
                errorBuilder: (_, __, ___) =>
                    const Icon(Icons.person_rounded, color: AppColors.gold, size: 28))
            : const Icon(Icons.person_rounded, color: AppColors.gold, size: 28),
      ),
    );
  }
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.user});
  final UserModel? user;

  @override
  Widget build(BuildContext context) {
    final status = user?.status ?? 'approved';
    final (label, color) = switch (status) {
      'approved' => ('فني معتمد', AppColors.chartGreen),
      'pending'  => ('قيد المراجعة', AppColors.gold),
      _          => ('فني', AppColors.gold),
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color:        color.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(AppDesign.radiusSM),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: [
        Icon(Icons.verified_rounded, size: 11, color: color),
        const SizedBox(width: 3),
        Text(label,
            style: TextStyle(
                fontSize: 11, color: color, fontWeight: FontWeight.w700)),
      ]),
    );
  }
}

// ── Low-points warning ────────────────────────────────────────────────────────

class _LowPointsWarning extends StatelessWidget {
  const _LowPointsWarning({required this.available, required this.onTap});
  final int available;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        margin:  const EdgeInsets.only(top: 12),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color:        AppColors.destructive.withValues(alpha: 0.10),
          borderRadius: BorderRadius.circular(AppDesign.radiusMD),
          border: Border.all(color: AppColors.destructive.withValues(alpha: 0.35)),
        ),
        child: Row(
          children: [
            const Icon(Icons.warning_amber_rounded,
                color: AppColors.destructive, size: 22),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'رصيد النقاط منخفض!',
                    style: TextStyle(
                      color:      AppColors.destructive,
                      fontWeight: FontWeight.w800,
                      fontSize:   13.5,
                    ),
                  ),
                  Text(
                    'رصيدك الحالي $available نقطة. يرجى شحن نقاطك للاستمرار في تقديم العروض.',
                    style: TextStyle(
                      color:    AppColors.destructive.withValues(alpha: 0.80),
                      fontSize: 12,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_left_rounded,
                color: AppColors.destructive, size: 20),
          ],
        ),
      ),
    );
  }
}

// ── Summary cards ─────────────────────────────────────────────────────────────

class _SummaryCards extends ConsumerWidget {
  const _SummaryCards({required this.user});
  final UserModel? user;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final pointsAsync  = ref.watch(techPointsProvider);
    final jobsAsync    = ref.watch(techMyJobsProvider);
    final userId       = user?.id;
    final profileAsync = userId != null
        ? ref.watch(technicianFullProfileProvider(userId))
        : null;

    return Row(
      children: [
        // Card 1: Points
        Expanded(
          child: _SummaryCard(
            gradient: const LinearGradient(
              colors: [Color(0xFFE9B73A), Color(0xFFD4922A)],
              begin: Alignment.topRight, end: Alignment.bottomLeft,
            ),
            icon:     Icons.stars_rounded,
            title:    'نقاطي',
            subtitle: pointsAsync.when(
              loading: () => '...',
              error:   (_, __) => '--',
              data: (pts) => '${pts.available}',
            ),
            footnote: pointsAsync.when(
              loading: () => '',
              error:   (_, __) => '',
              data: (pts) => pts.available < 200 ? '⚠ منخفض' : 'متاح',
            ),
            footnoteColor: pointsAsync.asData?.value.available != null &&
                    pointsAsync.asData!.value.available < 200
                ? Colors.redAccent.shade100
                : Colors.white70,
            onTap: () => context.push(RoutePaths.technicianWallet),
          ),
        ),
        const SizedBox(width: 10),

        // Card 2: Active Jobs
        Expanded(
          child: _SummaryCard(
            gradient: const LinearGradient(
              colors: [Color(0xFF3CA7DD), Color(0xFF1A6FA5)],
              begin: Alignment.topRight, end: Alignment.bottomLeft,
            ),
            icon:  Icons.work_rounded,
            title: 'المهام النشطة',
            subtitle: jobsAsync.when(
              loading: () => '...',
              error:   (_, __) => '--',
              data: (state) {
                if (state.tab != TechMyJobsTab.ongoing) return '--';
                return '${state.items.length}';
              },
            ),
            footnote:  'جارية',
            onTap: () => context.push(RoutePaths.technicianMyJobs),
          ),
        ),
        const SizedBox(width: 10),

        // Card 3: My Ratings
        Expanded(
          child: _SummaryCard(
            gradient: const LinearGradient(
              colors: [Color(0xFFAF57DB), Color(0xFF7B2FA3)],
              begin: Alignment.topRight, end: Alignment.bottomLeft,
            ),
            icon:  Icons.star_rounded,
            title: 'تقييماتي',
            subtitle: profileAsync?.when(
                  loading: () => '...',
                  error:   (_, __) => '--',
                  data:    (p)  => p.averageRating.toStringAsFixed(1),
                ) ??
                '--',
            footnote: profileAsync?.asData != null
                ? '${profileAsync!.asData!.value.reviewCount} تقييم'
                : '',
            onTap: () => context.push(RoutePaths.profile),
          ),
        ),
      ],
    );
  }
}

class _SummaryCard extends StatefulWidget {
  const _SummaryCard({
    required this.gradient,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.footnote,
    this.footnoteColor = Colors.white70,
    this.onTap,
  });

  final Gradient  gradient;
  final IconData  icon;
  final String    title;
  final String    subtitle;
  final String    footnote;
  final Color     footnoteColor;
  final VoidCallback? onTap;

  @override
  State<_SummaryCard> createState() => _SummaryCardState();
}

class _SummaryCardState extends State<_SummaryCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl;
  late final Animation<double>   _scale;

  @override
  void initState() {
    super.initState();
    _ctrl  = AnimationController(vsync: this, duration: const Duration(milliseconds: 100),
        lowerBound: 0.93, upperBound: 1.0, value: 1.0);
    _scale = _ctrl;
  }

  @override
  void dispose() { _ctrl.dispose(); super.dispose(); }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap:       () { _ctrl.forward(); widget.onTap?.call(); },
      onTapDown:   (_) => _ctrl.reverse(),
      onTapCancel: ()  => _ctrl.forward(),
      child: ScaleTransition(
        scale: _scale,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            gradient:     widget.gradient,
            borderRadius: BorderRadius.circular(AppDesign.radiusLG),
            boxShadow: [
              BoxShadow(
                color:      Colors.black.withValues(alpha: 0.18),
                blurRadius: 12,
                offset:     const Offset(0, 5),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(widget.icon, color: Colors.white, size: 22),
              const SizedBox(height: 10),
              Text(
                widget.subtitle,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 22,
                  fontWeight: FontWeight.w900,
                  height: 1.0,
                ),
              ),
              const SizedBox(height: 3),
              Text(
                widget.title,
                style: const TextStyle(
                  color: Colors.white70,
                  fontSize: 11,
                  fontWeight: FontWeight.w500,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
              if (widget.footnote.isNotEmpty) ...[
                const SizedBox(height: 4),
                Text(
                  widget.footnote,
                  style: TextStyle(
                    color:      widget.footnoteColor,
                    fontSize:   10,
                    fontWeight: FontWeight.w600,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

// ── Section header ────────────────────────────────────────────────────────────

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, this.actionLabel, this.onActionTap});
  final String  title;
  final String? actionLabel;
  final VoidCallback? onActionTap;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(title,
            style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
        if (actionLabel != null)
          TextButton(
            onPressed: onActionTap,
            child: Text(
              actionLabel!,
              style: const TextStyle(
                  color: AppColors.gold, fontWeight: FontWeight.w700),
            ),
          ),
      ],
    );
  }
}

// ── Latest available requests ─────────────────────────────────────────────────

class _LatestRequestsSliver extends ConsumerWidget {
  const _LatestRequestsSliver();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark       = Theme.of(context).brightness == Brightness.dark;
    final requestsAsync = ref.watch(techLatestRequestsProvider);
    final servicesAsync = ref.watch(servicesProvider);
    final areasAsync   = ref.watch(areasProvider);
    final govAsync     = ref.watch(governoratesProvider);

    return requestsAsync.when(
      loading: () => const SliverToBoxAdapter(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: CircularProgressIndicator(color: AppColors.gold),
          ),
        ),
      ),
      error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
      data: (requests) {
        if (requests.isEmpty) {
          return SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: _EmptyCard(
                icon:    Icons.search_off_rounded,
                message: 'لا توجد طلبات متاحة حالياً',
                hint:    'ستظهر هنا الطلبات الجديدة المطابقة لتخصصاتك',
                isDark:  isDark,
              ),
            ),
          );
        }
        return SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, i) {
                final req = requests[i];
                final svc = servicesAsync.asData?.value
                    .where((s) => s.id == req.serviceId).firstOrNull;
                final area = areasAsync.asData?.value
                    .where((a) => a.id == req.areaId).firstOrNull;
                final gov = govAsync.asData?.value
                    .where((g) => g.id == req.governorateId).firstOrNull;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: TechRequestCard(
                    request:         req,
                    serviceName:     svc?.nameAr ?? '...',
                    areaName:        area?.nameAr ?? '...',
                    governorateName: gov?.nameAr ?? '...',
                    onTap: () => context.push(
                        RoutePaths.technicianRequestDetail(req.id)),
                  ),
                );
              },
              childCount: requests.length,
            ),
          ),
        );
      },
    );
  }
}

// ── Recent finished requests ──────────────────────────────────────────────────

class _RecentFinishedSliver extends ConsumerWidget {
  const _RecentFinishedSliver();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark        = Theme.of(context).brightness == Brightness.dark;
    final finishedAsync = ref.watch(techRecentFinishedProvider);
    final servicesAsync = ref.watch(servicesProvider);
    final areasAsync    = ref.watch(areasProvider);
    final govAsync      = ref.watch(governoratesProvider);

    return finishedAsync.when(
      loading: () => const SliverToBoxAdapter(
        child: Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: CircularProgressIndicator(color: AppColors.gold),
          ),
        ),
      ),
      error: (_, __) => const SliverToBoxAdapter(child: SizedBox.shrink()),
      data: (requests) {
        if (requests.isEmpty) {
          return SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
              child: _EmptyCard(
                icon:    Icons.history_rounded,
                message: 'لا توجد طلبات منتهية حديثاً',
                hint:    'ستظهر هنا الطلبات المكتملة والملغاة',
                isDark:  isDark,
              ),
            ),
          );
        }
        return SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 0),
          sliver: SliverList(
            delegate: SliverChildBuilderDelegate(
              (context, i) {
                final req = requests[i];
                final svc = servicesAsync.asData?.value
                    .where((s) => s.id == req.serviceId).firstOrNull;
                final area = areasAsync.asData?.value
                    .where((a) => a.id == req.areaId).firstOrNull;
                final gov = govAsync.asData?.value
                    .where((g) => g.id == req.governorateId).firstOrNull;
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: TechRequestCard(
                    request:         req,
                    serviceName:     svc?.nameAr ?? '...',
                    areaName:        area?.nameAr ?? '...',
                    governorateName: gov?.nameAr ?? '...',
                    onTap: () => context.push(
                        RoutePaths.technicianJobDetail(req.id)),
                  ),
                );
              },
              childCount: requests.length,
            ),
          ),
        );
      },
    );
  }
}

// ── Empty state card ──────────────────────────────────────────────────────────

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({
    required this.icon,
    required this.message,
    required this.hint,
    required this.isDark,
  });

  final IconData icon;
  final String   message;
  final String   hint;
  final bool     isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color:        isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(AppDesign.radiusMD),
        border: Border.all(
            color: isDark ? AppColors.darkBorder : AppColors.lightBorder),
      ),
      child: Column(
        children: [
          Icon(icon, color: AppColors.gold, size: 44),
          const SizedBox(height: 10),
          Text(
            message,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: isDark
                  ? AppColors.darkMutedForeground
                  : AppColors.lightMutedForeground,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            hint,
            style: TextStyle(
              fontSize: 12.5,
              color: isDark
                  ? AppColors.darkMutedForeground
                  : AppColors.lightMutedForeground,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// Convenience extension (mirrors Dart 3 iterable extension)
extension on Iterable<dynamic> {
  dynamic get firstOrNull {
    final it = iterator;
    return it.moveNext() ? it.current : null;
  }
}

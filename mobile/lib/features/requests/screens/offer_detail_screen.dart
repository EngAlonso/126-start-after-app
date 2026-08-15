import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../core/config/env.dart';
import '../../../models/offer_model.dart';
import '../../../theme/app_colors.dart';
import '../providers/offers_provider.dart';
import '../providers/request_detail_provider.dart';
import '../widgets/offer_status_badge.dart';

/// Full detail view for a single offer — every field the backend returns,
/// plus the technician's public "completed jobs" count fetched from
/// `GET /technicians/:id/public-profile` (the offers-list endpoint doesn't
/// include it). Falls back to the offer passed via `extra` from the list
/// so the screen renders instantly, then keeps it in sync with the live
/// offers list once that finishes loading.
class OfferDetailScreen extends ConsumerWidget {
  const OfferDetailScreen({super.key, required this.requestId, required this.offerId, this.initialOffer});

  final int requestId;
  final int offerId;
  final OfferModel? initialOffer;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final asyncOffers = ref.watch(offersProvider(requestId));
    final offer = asyncOffers.value?.firstWhere(
          (o) => o.id == offerId,
          orElse: () => initialOffer ?? asyncOffers.value!.first,
        ) ??
        initialOffer;

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        title: const Text('تفاصيل العرض', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
        leading: IconButton(icon: const Icon(Icons.arrow_forward), onPressed: () => context.pop()),
      ),
      body: offer == null
          ? asyncOffers.isLoading
              ? const Center(child: CircularProgressIndicator(color: AppColors.gold))
              : const Center(child: Text('تعذر تحميل تفاصيل العرض'))
          : _OfferDetailBody(offer: offer, requestId: requestId),
    );
  }
}

class _OfferDetailBody extends ConsumerWidget {
  const _OfferDetailBody({required this.offer, required this.requestId});

  final OfferModel offer;
  final int requestId;

  bool get _canSelect => offer.isPending;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final tech = offer.technician;
    final selectionState = ref.watch(offerSelectionProvider);
    final asyncProfile = tech != null ? ref.watch(technicianPublicProfileProvider(tech.id)) : null;

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        // ── Technician / offer source header ────────────────────────────
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkCard : AppColors.lightCard,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
          ),
          child: Column(
            children: [
              Row(
                children: [
                  _Avatar(tech: tech),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          offer.isAdminOffer ? 'عرض من الإدارة' : (tech?.fullName ?? 'فني'),
                          style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800),
                        ),
                        if (!offer.isAdminOffer && (tech?.averageRating ?? 0) > 0) ...[
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Icon(Icons.star_rounded, size: 16, color: AppColors.gold),
                              const SizedBox(width: 3),
                              Text(tech!.averageRating.toStringAsFixed(1), style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w700)),
                              const SizedBox(width: 4),
                              Text('(${tech.reviewCount} تقييم)', style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                            ],
                          ),
                        ],
                        if (!offer.isAdminOffer && tech?.mobile != null && tech!.mobile!.isNotEmpty) ...[
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Icon(Icons.phone_rounded, size: 13, color: Theme.of(context).colorScheme.onSurfaceVariant),
                              const SizedBox(width: 4),
                              Text(tech.mobile!, style: TextStyle(fontSize: 12.5, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                            ],
                          ),
                        ],
                      ],
                    ),
                  ),
                  OfferStatusBadge(status: offer.status),
                ],
              ),
              if (asyncProfile != null) ...[
                const SizedBox(height: 14),
                asyncProfile.when(
                  loading: () => const _StatsShimmer(),
                  error: (e, _) => const SizedBox.shrink(),
                  data: (profile) => _StatsRow(profile: profile),
                ),
              ],
            ],
          ),
        ),

        const SizedBox(height: 18),
        const _SectionTitle('السعر المعروض'),
        const SizedBox(height: 8),
        _Card(
          child: Column(
            children: [
              _DetailRow(label: 'أجرة الخدمة', value: '${offer.price.toStringAsFixed(0)} جنيه'),
              if (offer.spareParts > 0) ...[
                const Divider(height: 20),
                _DetailRow(label: 'قطع الغيار', value: '${offer.spareParts.toStringAsFixed(0)} جنيه'),
              ],
              const Divider(height: 20),
              _DetailRow(label: 'الإجمالي', value: '${offer.totalPrice.toStringAsFixed(0)} جنيه', isTotal: true),
            ],
          ),
        ),

        if (offer.notes != null && offer.notes!.isNotEmpty) ...[
          const SizedBox(height: 18),
          const _SectionTitle('ملاحظات الفني'),
          const SizedBox(height: 8),
          _Card(child: Text(offer.notes!, style: const TextStyle(fontSize: 14, height: 1.5))),
        ],

        const SizedBox(height: 18),
        const _SectionTitle('معلومات إضافية'),
        const SizedBox(height: 8),
        _Card(
          child: Column(
            children: [
              _DetailRow(label: 'حالة العرض', value: offer.status.offerStatusLabelAr),
              const Divider(height: 20),
              _DetailRow(label: 'تاريخ التقديم', value: _formatDate(offer.createdAt)),
              if (offer.updatedAt != offer.createdAt) ...[
                const Divider(height: 20),
                _DetailRow(label: 'آخر تحديث', value: _formatDate(offer.updatedAt)),
              ],
            ],
          ),
        ),

        if (selectionState.errorMessage != null) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(color: AppColors.destructive.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(12)),
            child: Row(
              children: [
                const Icon(Icons.error_outline, color: AppColors.destructive, size: 18),
                const SizedBox(width: 8),
                Expanded(child: Text(selectionState.errorMessage!, style: const TextStyle(color: AppColors.destructive, fontSize: 12.5))),
              ],
            ),
          ),
        ],

        if (_canSelect) ...[
          const SizedBox(height: 22),
          SizedBox(
            width: double.infinity,
            height: 50,
            child: ElevatedButton(
              onPressed: selectionState.isSubmitting ? null : () => _confirmSelect(context, ref),
              child: selectionState.isSubmitting
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(strokeWidth: 2.4, color: Colors.white))
                  : const Text('اختيار هذا الفني', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
            ),
          ),
        ],
      ],
    );
  }

  Future<void> _confirmSelect(BuildContext context, WidgetRef ref) async {
    final techName = offer.isAdminOffer ? 'عرض الإدارة' : (offer.technician?.fullName ?? 'الفني');
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('اختيار هذا الفني؟'),
        content: Text('سيتم اختيار "$techName" بسعر ${offer.totalPrice.toStringAsFixed(0)} جنيه، وسيتم رفض العروض الأخرى تلقائياً.'),
        actions: [
          TextButton(onPressed: () => context.pop(false), child: const Text('تراجع')),
          TextButton(
            onPressed: () => context.pop(true),
            child: const Text('تأكيد الاختيار', style: TextStyle(color: AppColors.chartGreen, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) return;

    final ok = await ref.read(offerSelectionProvider.notifier).select(requestId: requestId, offerId: offer.id);
    if (!context.mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تم اختيار الفني بنجاح'), backgroundColor: AppColors.chartGreen),
      );
      ref.invalidate(requestDetailProvider(requestId));
      context.pop();
    }
  }

  static String _formatDate(String iso) {
    final parsed = DateTime.tryParse(iso);
    if (parsed == null) return iso;
    return DateFormat('d MMM yyyy، h:mm a', 'ar').format(parsed.toLocal());
  }
}

class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.profile});
  final TechnicianPublicProfile profile;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark ? AppColors.darkMuted : AppColors.lightMuted,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Expanded(
            child: _StatCell(icon: Icons.task_alt_rounded, label: 'مهام مكتملة', value: '${profile.completedJobs}'),
          ),
          Expanded(
            child: _StatCell(icon: Icons.star_rounded, label: 'التقييم', value: profile.averageRating.toStringAsFixed(1)),
          ),
          Expanded(
            child: _StatCell(icon: Icons.reviews_rounded, label: 'المراجعات', value: '${profile.reviewCount}'),
          ),
        ],
      ),
    );
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell({required this.icon, required this.label, required this.value});
  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Icon(icon, size: 18, color: AppColors.gold),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w800)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(fontSize: 10.5, color: Theme.of(context).colorScheme.onSurfaceVariant)),
      ],
    );
  }
}

class _StatsShimmer extends StatelessWidget {
  const _StatsShimmer();

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 62,
      decoration: BoxDecoration(
        color: Theme.of(context).brightness == Brightness.dark ? AppColors.darkMuted : AppColors.lightMuted,
        borderRadius: BorderRadius.circular(14),
      ),
    );
  }
}

class _Avatar extends StatelessWidget {
  const _Avatar({required this.tech});
  final OfferTechnicianInfo? tech;

  @override
  Widget build(BuildContext context) {
    if (tech == null) {
      return CircleAvatar(
        radius: 28,
        backgroundColor: Colors.purple.withValues(alpha: 0.12),
        child: const Text('إد', style: TextStyle(color: Colors.purple, fontWeight: FontWeight.w800)),
      );
    }
    final image = tech!.profileImage;
    return CircleAvatar(
      radius: 28,
      backgroundColor: AppColors.gold.withValues(alpha: 0.15),
      backgroundImage: (image != null && image.isNotEmpty) ? NetworkImage(Env.mediaUrl(image)) : null,
      child: (image == null || image.isEmpty)
          ? Text(
              tech!.fullName.isNotEmpty ? tech!.fullName.substring(0, 1) : '?',
              style: const TextStyle(color: AppColors.gold, fontWeight: FontWeight.w800, fontSize: 18),
            )
          : null,
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(text, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700));
}

class _Card extends StatelessWidget {
  const _Card({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
      ),
      child: child,
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value, this.isTotal = false});
  final String label;
  final String value;
  final bool isTotal;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurfaceVariant, fontWeight: FontWeight.w600)),
        Text(
          value,
          style: TextStyle(fontSize: isTotal ? 16 : 14, fontWeight: isTotal ? FontWeight.w800 : FontWeight.w600, color: isTotal ? AppColors.gold : null),
        ),
      ],
    );
  }
}

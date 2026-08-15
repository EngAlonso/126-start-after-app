import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../../theme/app_colors.dart';
import '../../requests/providers/offers_provider.dart';
import '../../requests/providers/request_detail_provider.dart';
import '../../requests/widgets/attachment_gallery.dart';
import '../../requests/widgets/request_status_badge.dart';
import '../providers/tech_providers.dart';
import '../widgets/offer_sheet.dart';
import '../../../models/offer_model.dart';
import '../../../models/request_model.dart';

class TechRequestDetailScreen extends ConsumerWidget {
  const TechRequestDetailScreen({super.key, required this.requestId});
  final int requestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requestAsync = ref.watch(requestDetailProvider(requestId));

    // Each state returns its own Scaffold (never nested) so the AppBar is
    // always at the top level and back navigation works correctly.
    return requestAsync.when(
      loading: () => Scaffold(
        appBar: AppBar(title: const Text('تفاصيل الطلب')),
        body: const Center(
            child: CircularProgressIndicator(color: AppColors.gold)),
      ),
      error: (e, _) => Scaffold(
        appBar: AppBar(title: const Text('تفاصيل الطلب')),
        body: _ErrorBody(
          message: e.toString().replaceFirst('Exception: ', ''),
          onRetry: () => ref.invalidate(requestDetailProvider(requestId)),
        ),
      ),
      data: (request) => _DetailBody(request: request),
    );
  }
}

// ─── Main detail body ─────────────────────────────────────────────────────────

class _DetailBody extends ConsumerWidget {
  const _DetailBody({required this.request});
  final RequestModel request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final offersAsync = ref.watch(offersProvider(request.id));
    final myOffer = ref.watch(myOfferForRequestProvider(request.id));

    // A technician can submit an offer when the request is still discoverable.
    final canSubmit =
        (request.status == 'pending' || request.status == 'offers_received') &&
            myOffer == null;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          request.service?.nameAr ?? 'تفاصيل الطلب',
          style: const TextStyle(fontWeight: FontWeight.w800),
        ),
        actions: [
          Padding(
            padding: const EdgeInsets.only(left: 16),
            child: RequestStatusBadge(status: request.status),
          ),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.gold,
        onRefresh: () async {
          ref.invalidate(requestDetailProvider(request.id));
          ref.invalidate(offersProvider(request.id));
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 120),
          children: [
            const SizedBox(height: 16),

            // ── Request meta card ─────────────────────────────────────
            _MetaCard(request: request, isDark: isDark),

            const SizedBox(height: 16),

            // ── Description ───────────────────────────────────────────
            _SectionCard(
              isDark: isDark,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  _SectionTitle('وصف الطلب'),
                  const SizedBox(height: 10),
                  Text(
                    request.description,
                    style: Theme.of(context)
                        .textTheme
                        .bodyMedium
                        ?.copyWith(height: 1.6),
                  ),
                ],
              ),
            ),

            // ── Images ────────────────────────────────────────────────
            if (request.images.isNotEmpty) ...[
              const SizedBox(height: 16),
              _SectionCard(
                isDark: isDark,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _SectionTitle('الصور (${request.images.length})'),
                    const SizedBox(height: 12),
                    RequestImageGallery(images: request.images),
                  ],
                ),
              ),
            ],

            // ── Voice note ────────────────────────────────────────────
            if (request.audioUrl != null) ...[
              const SizedBox(height: 16),
              _SectionCard(
                isDark: isDark,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    _SectionTitle('التسجيل الصوتي'),
                    const SizedBox(height: 12),
                    VoiceNotePlayer(url: request.audioUrl!),
                  ],
                ),
              ),
            ],

            // ── Address ───────────────────────────────────────────────
            if (request.address.isNotEmpty) ...[
              const SizedBox(height: 16),
              _SectionCard(
                isDark: isDark,
                child: _InfoRow(
                  icon: Icons.location_on_rounded,
                  label: 'العنوان',
                  value: request.address,
                ),
              ),
            ],

            // ── My offer section ──────────────────────────────────────
            const SizedBox(height: 16),
            _MyOfferSection(
              request: request,
              myOffer: myOffer,
              offersLoading: offersAsync.isLoading,
              isDark: isDark,
            ),

            const SizedBox(height: 16),
          ],
        ),
      ),

      // ── Floating submit offer button ───────────────────────────────
      bottomNavigationBar: canSubmit
          ? _SubmitOfferBar(request: request)
          : null,
    );
  }
}

// ─── Meta card ────────────────────────────────────────────────────────────────

class _MetaCard extends StatelessWidget {
  const _MetaCard({required this.request, required this.isDark});
  final RequestModel request;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return _SectionCard(
      isDark: isDark,
      child: Column(
        children: [
          // Service
          if (request.service != null)
            _InfoRow(
              icon: Icons.handyman_rounded,
              label: 'الخدمة',
              value: request.service!.nameAr,
            ),

          // Location
          _InfoRow(
            icon: Icons.location_on_rounded,
            label: 'المنطقة',
            value: [
              request.governorate?.nameAr,
              request.area?.nameAr,
            ].whereType<String>().join(' • '),
          ),

          // Price
          if (request.agreedPrice != null || request.finalPrice != null)
            _InfoRow(
              icon: Icons.payments_rounded,
              label: 'السعر المتفق عليه',
              value: '${request.agreedPrice ?? request.finalPrice} ج.م',
              valueColor: AppColors.gold,
            ),

          // Offers count
          _InfoRow(
            icon: Icons.local_offer_rounded,
            label: 'عدد العروض',
            value: '${request.offersCount}',
          ),

          // Date
          _InfoRow(
            icon: Icons.access_time_rounded,
            label: 'تاريخ الطلب',
            value: _formatDate(request.createdAt),
            isLast: true,
          ),
        ],
      ),
    );
  }

  static String _formatDate(String iso) {
    final parsed = DateTime.tryParse(iso);
    if (parsed == null) return iso;
    return DateFormat('d MMMM y، h:mm a', 'ar').format(parsed.toLocal());
  }
}

// ─── My Offer section ─────────────────────────────────────────────────────────

class _MyOfferSection extends ConsumerWidget {
  const _MyOfferSection({
    required this.request,
    required this.myOffer,
    required this.offersLoading,
    required this.isDark,
  });

  final RequestModel request;
  final OfferModel? myOffer;
  final bool offersLoading;
  final bool isDark;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (offersLoading && myOffer == null) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: CircularProgressIndicator(color: AppColors.gold, strokeWidth: 2),
        ),
      );
    }

    if (myOffer == null) return const SizedBox.shrink();

    // Has submitted offer — show its details.
    final canEdit = myOffer!.status == 'pending';

    return _SectionCard(
      isDark: isDark,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              _SectionTitle('عرضي المقدم'),
              const Spacer(),
              _OfferStatusBadge(status: myOffer!.status),
            ],
          ),
          const SizedBox(height: 14),

          // Price
          _InfoRow(
            icon: Icons.payments_rounded,
            label: 'سعر الخدمة',
            value: '${myOffer!.price.toStringAsFixed(myOffer!.price == myOffer!.price.toInt() ? 0 : 2)} ج.م',
            valueColor: AppColors.gold,
          ),

          // Spare parts
          if (myOffer!.spareParts > 0)
            _InfoRow(
              icon: Icons.settings_rounded,
              label: 'قطع الغيار',
              value: '${myOffer!.spareParts.toStringAsFixed(0)} ج.م',
            ),

          // Total
          _InfoRow(
            icon: Icons.calculate_rounded,
            label: 'الإجمالي',
            value: '${myOffer!.totalPrice.toStringAsFixed(myOffer!.totalPrice == myOffer!.totalPrice.toInt() ? 0 : 2)} ج.م',
            valueColor: AppColors.gold,
          ),

          // Reserved points
          _InfoRow(
            icon: Icons.stars_rounded,
            label: 'النقاط المحجوزة',
            value: '${myOffer!.reservedPoints}',
          ),

          // Notes
          if ((myOffer!.notes ?? '').isNotEmpty)
            _InfoRow(
              icon: Icons.notes_rounded,
              label: 'الملاحظات',
              value: myOffer!.notes!,
              isLast: !canEdit,
            ),

          // Edit button
          if (canEdit) ...[
            const Divider(height: 24),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton.icon(
                style: OutlinedButton.styleFrom(
                  foregroundColor: AppColors.gold,
                  side: const BorderSide(color: AppColors.gold),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                icon: const Icon(Icons.edit_rounded, size: 18),
                label: const Text('تعديل العرض',
                    style: TextStyle(fontWeight: FontWeight.w700)),
                onPressed: () => showOfferSheet(
                  context: context,
                  requestId: request.id,
                  existingOffer: myOffer,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _OfferStatusBadge extends StatelessWidget {
  const _OfferStatusBadge({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final rgb = status.offerStatusColorRgb;
    final color = Color.fromARGB(255, rgb.r, rgb.g, rgb.b);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.offerStatusLabelAr,
        style: TextStyle(
            fontSize: 11.5, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}

// ─── Submit offer bottom bar ──────────────────────────────────────────────────

class _SubmitOfferBar extends StatelessWidget {
  const _SubmitOfferBar({required this.request});
  final RequestModel request;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
        child: SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.gold,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 16),
              shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14)),
            ),
            icon: const Icon(Icons.local_offer_rounded),
            label: const Text(
              'تقديم عرض',
              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
            ),
            onPressed: () => showOfferSheet(
              context: context,
              requestId: request.id,
            ),
          ),
        ),
      ),
    );
  }
}

// ─── Shared card / row helpers ────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  const _SectionCard({required this.isDark, required this.child});
  final bool isDark;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
            color: isDark ? AppColors.darkBorder : AppColors.lightBorder),
      ),
      child: child,
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) => Text(
        text,
        style:
            const TextStyle(fontSize: 14, fontWeight: FontWeight.w800),
      );
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
    this.isLast = false,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 10),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 18, color: AppColors.gold),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    label,
                    style: TextStyle(
                      fontSize: 11.5,
                      color: isDark
                          ? AppColors.darkMutedForeground
                          : AppColors.lightMutedForeground,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    value,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: valueColor,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        if (!isLast)
          Divider(
            height: 1,
            color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
          ),
      ],
    );
  }
}

// ─── Error body ───────────────────────────────────────────────────────────────

class _ErrorBody extends StatelessWidget {
  const _ErrorBody({required this.message, required this.onRetry});
  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline_rounded,
                color: AppColors.gold, size: 48),
            const SizedBox(height: 16),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            ElevatedButton.icon(
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('إعادة المحاولة'),
              style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.gold,
                  foregroundColor: Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../models/offer_model.dart';
import '../../../models/request_model.dart';
import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../requests/providers/offers_provider.dart';
import '../../requests/providers/request_detail_provider.dart';
import '../../requests/widgets/attachment_gallery.dart';
import '../../requests/widgets/request_status_badge.dart';
import '../../requests/widgets/request_timeline.dart';
import '../providers/tech_job_providers.dart';

/// Phase 11B — Technician job detail screen.
///
/// Loaded via `/technician/jobs/:id`. Shows all backend-exposed fields for an
/// assigned request: meta, customer info (phone visible once assigned), accepted
/// offer, description, images, voice note, and the status timeline.
///
/// Action bar at the bottom surfaces only the actions the backend supports for
/// the current `status`:
/// - `technician_selected` → cancel
/// - `in_progress`         → request completion + cancel + price adjustment
/// - `price_change_requested` / `waiting_approval` → informational banner
/// - completed / cancelled → nothing
class TechJobDetailScreen extends ConsumerWidget {
  const TechJobDetailScreen({super.key, required this.requestId});

  final int requestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requestAsync = ref.watch(requestDetailProvider(requestId));

    return requestAsync.when(
      loading: () => Scaffold(
        appBar: AppBar(title: const Text('تفاصيل المهمة')),
        body: const Center(
          child: CircularProgressIndicator(color: AppColors.gold),
        ),
      ),
      error: (e, _) => Scaffold(
        appBar: AppBar(title: const Text('تفاصيل المهمة')),
        body: Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error_outline_rounded,
                  size: 48, color: AppColors.destructive),
              const SizedBox(height: 12),
              Text(
                e.toString().replaceFirst('Exception: ', ''),
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 14),
              ),
              const SizedBox(height: 16),
              FilledButton.icon(
                onPressed: () => ref.invalidate(requestDetailProvider(requestId)),
                icon: const Icon(Icons.refresh_rounded),
                label: const Text('إعادة المحاولة'),
                style: FilledButton.styleFrom(backgroundColor: AppColors.gold),
              ),
            ],
          ),
        ),
      ),
      data: (request) => _DetailScaffold(request: request),
    );
  }
}

// ── Main scaffold (wraps RefreshIndicator + action bar) ───────────────────────

class _DetailScaffold extends ConsumerWidget {
  const _DetailScaffold({required this.request});

  final RequestModel request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final offersAsync = ref.watch(offersProvider(request.id));

    // The technician's accepted offer is the one with status == 'selected'.
    final OfferModel? myOffer = offersAsync.asData?.value
        .where((o) => o.status == 'selected')
        .firstOrNull;

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.lightBackground,
      appBar: AppBar(
        backgroundColor:
            isDark ? AppColors.darkBackground : AppColors.lightBackground,
        title: Text(
          request.service?.nameAr ?? 'تفاصيل المهمة',
          style: const TextStyle(fontWeight: FontWeight.w700),
        ),
        centerTitle: true,
        actions: [
          // Open chat for this request
          IconButton(
            icon: const Icon(Icons.chat_bubble_outline_rounded),
            tooltip: 'المحادثة',
            onPressed: () => context.push(
              RoutePaths.chat(request.id),
              extra: {
                'serviceName': request.service?.nameAr,
                'status': request.status,
                'otherName': request.customer?.fullName,
                'otherImage': request.customer?.profileImage,
              },
            ),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(40),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 10),
            child: RequestStatusBadge(status: request.status),
          ),
        ),
      ),
      body: RefreshIndicator(
        color: AppColors.gold,
        onRefresh: () async {
          ref.invalidate(requestDetailProvider(request.id));
          ref.invalidate(offersProvider(request.id));
        },
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
          children: [
            // 1. Status timeline
            _SectionCard(
              title: 'مراحل الطلب',
              child: RequestTimeline(status: request.status),
            ),
            const SizedBox(height: 14),

            // 2. Job meta
            _JobMetaCard(request: request),
            const SizedBox(height: 14),

            // 3. Accepted offer (my offer)
            if (myOffer != null) ...[
              _MyOfferCard(offer: myOffer),
              const SizedBox(height: 14),
            ],

            // 4. Customer info
            if (request.customer != null) ...[
              _CustomerCard(customer: request.customer!),
              const SizedBox(height: 14),
            ],

            // 5. Description
            if (request.description.isNotEmpty) ...[
              _SectionCard(
                title: 'وصف المشكلة',
                child: Text(
                  request.description,
                  style: const TextStyle(fontSize: 14, height: 1.6),
                ),
              ),
              const SizedBox(height: 14),
            ],

            // 6. Images
            if (request.images.isNotEmpty) ...[
              _SectionCard(
                title: 'الصور المرفقة',
                child: RequestImageGallery(images: request.images),
              ),
              const SizedBox(height: 14),
            ],

            // 7. Voice note
            if (request.audioUrl != null) ...[
              _SectionCard(
                title: 'الرسالة الصوتية',
                child: VoiceNotePlayer(url: request.audioUrl!),
              ),
              const SizedBox(height: 14),
            ],

            // 8. Address
            _SectionCard(
              title: 'عنوان الخدمة',
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (request.governorate != null || request.area != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 6),
                      child: Text(
                        [
                          request.governorate?.nameAr,
                          request.area?.nameAr,
                        ].whereType<String>().join('، '),
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  Text(
                    request.address,
                    style: const TextStyle(fontSize: 14, height: 1.5),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 14),

            // 9. Admin note (if any)
            if (request.adminNote != null && request.adminNote!.isNotEmpty) ...[
              _SectionCard(
                title: 'ملاحظة الإدارة',
                titleColor: AppColors.gold,
                child: Text(
                  request.adminNote!,
                  style: const TextStyle(fontSize: 14, height: 1.6),
                ),
              ),
              const SizedBox(height: 14),
            ],

            // 10. Cancel reason (if cancelled)
            if (request.status.isCancelled &&
                request.cancelReason != null &&
                request.cancelReason!.isNotEmpty) ...[
              _SectionCard(
                title: 'سبب الإلغاء',
                titleColor: AppColors.destructive,
                child: Text(
                  request.cancelReason!,
                  style: const TextStyle(fontSize: 14, height: 1.6),
                ),
              ),
              const SizedBox(height: 14),
            ],
          ],
        ),
      ),
      bottomNavigationBar: _ActionBar(request: request),
    );
  }
}

// ── Job meta card ─────────────────────────────────────────────────────────────

class _JobMetaCard extends StatelessWidget {
  const _JobMetaCard({required this.request});

  final RequestModel request;

  @override
  Widget build(BuildContext context) {
    final date = DateTime.tryParse(request.createdAt);
    final dateStr = date != null
        ? DateFormat('d MMMM yyyy، h:mm a', 'ar').format(date.toLocal())
        : request.createdAt;

    return _SectionCard(
      title: 'معلومات الطلب',
      child: Column(
        children: [
          _MetaRow(icon: Icons.build_rounded,
              label: request.service?.nameAr ?? '—'),
          _MetaRow(
            icon: Icons.location_on_rounded,
            label: [
              request.governorate?.nameAr,
              request.area?.nameAr,
            ].whereType<String>().join('، '),
          ),
          _MetaRow(icon: Icons.calendar_today_rounded, label: dateStr),
          if (request.agreedPrice != null)
            _MetaRow(
              icon: Icons.payments_rounded,
              label: 'السعر المتفق عليه: ${request.agreedPrice} ج.م',
            ),
          if (request.finalPrice != null && request.agreedPrice == null)
            _MetaRow(
              icon: Icons.payments_rounded,
              label: 'السعر: ${request.finalPrice} ج.م',
            ),
          if (request.offersCount > 0)
            _MetaRow(
              icon: Icons.local_offer_rounded,
              label: 'عدد العروض: ${request.offersCount}',
            ),
        ],
      ),
    );
  }
}

// ── My offer card ─────────────────────────────────────────────────────────────

class _MyOfferCard extends StatelessWidget {
  const _MyOfferCard({required this.offer});

  final OfferModel offer;

  @override
  Widget build(BuildContext context) {
    final date = DateTime.tryParse(offer.createdAt);
    final dateStr = date != null
        ? DateFormat('d MMMM yyyy', 'ar').format(date.toLocal())
        : offer.createdAt;

    return _SectionCard(
      title: 'عرضي المقبول',
      titleColor: AppColors.gold,
      child: Column(
        children: [
          _MetaRow(
            icon: Icons.attach_money_rounded,
            label: 'تعمال: ${offer.price.toStringAsFixed(0)} ج.م',
          ),
          if (offer.spareParts > 0)
            _MetaRow(
              icon: Icons.construction_rounded,
              label: 'قطع غيار: ${offer.spareParts.toStringAsFixed(0)} ج.م',
            ),
          _MetaRow(
            icon: Icons.calculate_rounded,
            label: 'الإجمالي: ${offer.totalPrice.toStringAsFixed(0)} ج.م',
            bold: true,
          ),
          if (offer.notes != null && offer.notes!.isNotEmpty)
            _MetaRow(icon: Icons.notes_rounded, label: offer.notes!),
          _MetaRow(icon: Icons.calendar_today_rounded, label: dateStr),
        ],
      ),
    );
  }
}

// ── Customer card ─────────────────────────────────────────────────────────────

class _CustomerCard extends StatelessWidget {
  const _CustomerCard({required this.customer});

  final RequestPersonInfo customer;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return _SectionCard(
      title: 'معلومات العميل',
      child: Row(
        children: [
          CircleAvatar(
            radius: 24,
            backgroundColor: AppColors.gold.withValues(alpha: 0.15),
            backgroundImage: customer.profileImage != null
                ? NetworkImage(customer.profileImage!)
                : null,
            child: customer.profileImage == null
                ? const Icon(Icons.person_rounded, color: AppColors.gold)
                : null,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  customer.fullName,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 15,
                  ),
                ),
                if (customer.mobile != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    customer.mobile!,
                    style: TextStyle(
                      fontSize: 13.5,
                      color: isDark
                          ? AppColors.darkMutedForeground
                          : AppColors.lightMutedForeground,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

// ── Action bar ────────────────────────────────────────────────────────────────

/// Surfaces the backend-supported actions for the current request status.
/// autoDispose ensures fresh state each time this screen is opened.
class _ActionBar extends ConsumerWidget {
  const _ActionBar({required this.request});

  final RequestModel request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final actionState = ref.watch(techJobActionProvider);
    final status = request.status;

    // Completed / cancelled → no action bar.
    if (status == 'completed' || status.isCancelled) return const SizedBox.shrink();

    // Waiting states → informational banner only.
    if (status == 'price_change_requested' || status == 'waiting_approval') {
      final (label, icon) = status == 'price_change_requested'
          ? ('بانتظار رد العميل على تعديل السعر', Icons.price_change_rounded)
          : ('بانتظار تأكيد العميل لإنهاء الخدمة', Icons.hourglass_bottom_rounded);
      return SafeArea(
        child: Container(
          margin: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: AppColors.gold.withValues(alpha: 0.12),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: AppColors.gold.withValues(alpha: 0.4)),
          ),
          child: Row(
            children: [
              Icon(icon, color: AppColors.gold, size: 20),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  label,
                  style: const TextStyle(
                    fontSize: 13.5,
                    fontWeight: FontWeight.w600,
                    color: AppColors.gold,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    // Active job statuses with real actions.
    return SafeArea(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (actionState.errorMessage != null)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  actionState.errorMessage!,
                  style: const TextStyle(
                    color: AppColors.destructive,
                    fontSize: 12.5,
                  ),
                  textAlign: TextAlign.center,
                ),
              ),

            // "Request Completion" — only available while in_progress.
            if (status == 'in_progress')
              SizedBox(
                width: double.infinity,
                child: FilledButton.icon(
                  onPressed: actionState.isSubmitting
                      ? null
                      : () => _onRequestCompletion(context, ref),
                  icon: actionState.isSubmitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(
                              strokeWidth: 2, color: Colors.white),
                        )
                      : const Icon(Icons.check_circle_rounded),
                  label: const Text('طلب إنهاء الخدمة',
                      style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.gold,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                ),
              ),

            if (status == 'in_progress') const SizedBox(height: 8),

            Row(
              children: [
                // "Price Adjustment" — only while in_progress.
                if (status == 'in_progress')
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: actionState.isSubmitting
                          ? null
                          : () => _onPriceAdjustment(context, ref),
                      icon: const Icon(Icons.price_change_rounded, size: 18),
                      label: const Text('تعديل السعر'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.gold,
                        side: const BorderSide(color: AppColors.gold),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ),

                if (status == 'in_progress') const SizedBox(width: 8),

                // "Cancel" — always available for active statuses.
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: actionState.isSubmitting
                        ? null
                        : () => _onCancel(context, ref),
                    icon: const Icon(Icons.cancel_rounded, size: 18),
                    label: const Text('إلغاء الطلب'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.destructive,
                      side: const BorderSide(color: AppColors.destructive),
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  // ── Dialogs / sheets ────────────────────────────────────────────────────────

  Future<void> _onRequestCompletion(BuildContext context, WidgetRef ref) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('تأكيد إنهاء الخدمة'),
        content: const Text(
          'هل أنهيت العمل؟ سيُرسل إشعار للعميل للتأكيد.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('إلغاء'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            style: FilledButton.styleFrom(backgroundColor: AppColors.gold),
            child: const Text('نعم، أنهيت العمل'),
          ),
        ],
      ),
    );
    if (confirm != true || !context.mounted) return;
    await ref
        .read(techJobActionProvider.notifier)
        .requestCompletion(request.id);
  }

  Future<void> _onCancel(BuildContext context, WidgetRef ref) async {
    final reasonCtrl = TextEditingController();
    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _CancelSheet(controller: reasonCtrl),
    );
    if (confirmed != true || !context.mounted) return;
    final reason = reasonCtrl.text.trim();
    if (reason.isEmpty) return;
    await ref
        .read(techJobActionProvider.notifier)
        .cancel(request.id, reason: reason);
  }

  Future<void> _onPriceAdjustment(BuildContext context, WidgetRef ref) async {
    final result = await showModalBottomSheet<_PriceAdjustResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _PriceAdjustSheet(currentRequest: request),
    );
    if (result == null || !context.mounted) return;
    await ref.read(techJobActionProvider.notifier).proposePriceAdjustment(
          request.id,
          newPrice: result.newPrice,
          newSpareParts: result.newSpareParts,
          newDescription: result.newDescription,
        );
  }
}

// ── Cancel sheet ──────────────────────────────────────────────────────────────

class _CancelSheet extends StatelessWidget {
  const _CancelSheet({required this.controller});

  final TextEditingController controller;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkCard : AppColors.lightCard,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Handle
            Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 20),
              decoration: BoxDecoration(
                color: isDark
                    ? AppColors.darkMutedForeground
                    : AppColors.lightMutedForeground,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const Text(
              'سبب الإلغاء',
              style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: controller,
              maxLines: 4,
              decoration: InputDecoration(
                hintText: 'اكتب سبب إلغاء الطلب...',
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: FilledButton(
                onPressed: () {
                  if (controller.text.trim().isEmpty) return;
                  Navigator.pop(context, true);
                },
                style: FilledButton.styleFrom(
                    backgroundColor: AppColors.destructive,
                    padding: const EdgeInsets.symmetric(vertical: 14)),
                child: const Text('تأكيد الإلغاء',
                    style: TextStyle(
                        fontSize: 15, fontWeight: FontWeight.w700)),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Price adjustment sheet ────────────────────────────────────────────────────

class _PriceAdjustResult {
  const _PriceAdjustResult({
    required this.newPrice,
    this.newSpareParts = 0,
    this.newDescription,
  });

  final double newPrice;
  final double newSpareParts;
  final String? newDescription;
}

class _PriceAdjustSheet extends StatefulWidget {
  const _PriceAdjustSheet({required this.currentRequest});

  final RequestModel currentRequest;

  @override
  State<_PriceAdjustSheet> createState() => _PriceAdjustSheetState();
}

class _PriceAdjustSheetState extends State<_PriceAdjustSheet> {
  final _formKey = GlobalKey<FormState>();
  final _priceCtrl = TextEditingController();
  final _sparePartsCtrl = TextEditingController();
  final _descCtrl = TextEditingController();

  @override
  void dispose() {
    _priceCtrl.dispose();
    _sparePartsCtrl.dispose();
    _descCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
        decoration: BoxDecoration(
          color: isDark ? AppColors.darkCard : AppColors.lightCard,
          borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        ),
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 24),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  margin: const EdgeInsets.only(bottom: 20),
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.darkMutedForeground
                        : AppColors.lightMutedForeground,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const Center(
                child: Text(
                  'تعديل السعر',
                  style: TextStyle(fontSize: 17, fontWeight: FontWeight.w700),
                ),
              ),
              const SizedBox(height: 16),

              // New price
              TextFormField(
                controller: _priceCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'السعر الجديد (ج.م)',
                  suffixText: 'ج.م',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
                validator: (v) {
                  if (v == null || v.isEmpty) return 'السعر مطلوب';
                  final d = double.tryParse(v);
                  if (d == null || d <= 0) return 'أدخل سعرًا صحيحًا';
                  return null;
                },
              ),
              const SizedBox(height: 12),

              // Spare parts (optional)
              TextFormField(
                controller: _sparePartsCtrl,
                keyboardType: TextInputType.number,
                decoration: InputDecoration(
                  labelText: 'قطع الغيار (اختياري)',
                  suffixText: 'ج.م',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 12),

              // Note (optional)
              TextFormField(
                controller: _descCtrl,
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: 'سبب التعديل (اختياري)',
                  border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 16),

              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: () {
                    if (!_formKey.currentState!.validate()) return;
                    Navigator.pop(
                      context,
                      _PriceAdjustResult(
                        newPrice: double.parse(_priceCtrl.text.trim()),
                        newSpareParts:
                            double.tryParse(_sparePartsCtrl.text.trim()) ?? 0,
                        newDescription: _descCtrl.text.trim().isEmpty
                            ? null
                            : _descCtrl.text.trim(),
                      ),
                    );
                  },
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.gold,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                  ),
                  child: const Text(
                    'إرسال طلب تعديل السعر',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ── Shared section card ───────────────────────────────────────────────────────

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.child,
    this.titleColor,
  });

  final String title;
  final Widget child;
  final Color? titleColor;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Container(
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
        ),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: titleColor ??
                  (isDark
                      ? AppColors.darkMutedForeground
                      : AppColors.lightMutedForeground),
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

// ── Meta row ──────────────────────────────────────────────────────────────────

class _MetaRow extends StatelessWidget {
  const _MetaRow({required this.icon, required this.label, this.bold = false});

  final IconData icon;
  final String label;
  final bool bold;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            icon,
            size: 16,
            color: isDark
                ? AppColors.darkMutedForeground
                : AppColors.lightMutedForeground,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              label,
              style: TextStyle(
                fontSize: 14,
                fontWeight: bold ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../../models/request_model.dart';
import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/common/app_button.dart';
import '../providers/request_detail_provider.dart';
import '../widgets/attachment_gallery.dart';
import '../widgets/request_status_badge.dart';
import '../widgets/request_timeline.dart';

/// Phase 5 — full detail view for one request: every backend field, a real
/// status timeline, image/audio attachments, and the only two customer
/// actions the backend actually supports (cancel, confirm/reject
/// completion). No offers/chat/wallet UI — those are later phases.
class RequestDetailScreen extends ConsumerWidget {
  const RequestDetailScreen({super.key, required this.requestId});

  final int requestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final asyncRequest = ref.watch(requestDetailProvider(requestId));
    final actionState = ref.watch(requestActionProvider);

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        title: Text('طلب #$requestId', style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
        leading: IconButton(
          icon: const Icon(Icons.arrow_forward),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh_rounded),
            tooltip: 'تحديث',
            onPressed: () => ref.invalidate(requestDetailProvider(requestId)),
          ),
        ],
      ),
      body: asyncRequest.when(
        loading: () => const Center(child: CircularProgressIndicator(color: AppColors.gold)),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.wifi_off_rounded, size: 48, color: AppColors.gold),
              const SizedBox(height: 12),
              const Text('تعذر تحميل تفاصيل الطلب', style: TextStyle(fontSize: 16)),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () => ref.invalidate(requestDetailProvider(requestId)),
                child: const Text('إعادة المحاولة'),
              ),
            ],
          ),
        ),
        data: (request) => _RequestDetailBody(
          request: request,
          isSubmitting: actionState.isSubmitting,
          errorMessage: actionState.errorMessage,
        ),
      ),
    );
  }
}

class _RequestDetailBody extends ConsumerWidget {
  const _RequestDetailBody({
    required this.request,
    required this.isSubmitting,
    required this.errorMessage,
  });

  final RequestModel request;
  final bool isSubmitting;
  final String? errorMessage;

  bool get _canCancel => const {'pending', 'offers_received'}.contains(request.status);
  bool get _canRespondToCompletion => request.status == 'waiting_approval';

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final serviceName = request.service?.nameAr ?? 'خدمة #${request.serviceId}';

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 32),
      children: [
        // ── Header card ──────────────────────────────────────────────────
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: isDark ? AppColors.darkCard : AppColors.lightCard,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(serviceName, style: const TextStyle(fontSize: 17, fontWeight: FontWeight.w800)),
                  ),
                  RequestStatusBadge(status: request.status),
                ],
              ),
              const SizedBox(height: 8),
              _InfoRow(icon: Icons.calendar_today_outlined, text: _formatDate(request.createdAt)),
              if (request.updatedAt != request.createdAt) ...[
                const SizedBox(height: 4),
                _InfoRow(icon: Icons.update_rounded, text: 'آخر تحديث: ${_formatDate(request.updatedAt)}'),
              ],
              if (request.offersCount > 0) ...[
                const SizedBox(height: 4),
                _InfoRow(
                  icon: Icons.local_offer_outlined,
                  text: '${request.offersCount} عرض من الفنيين',
                  color: AppColors.gold,
                ),
              ],
              if (request.offersCount > 0 || request.selectedTechnician != null) ...[
                const SizedBox(height: 14),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: () => context.push(RoutePaths.requestOffers(request.id)),
                    icon: const Icon(Icons.local_offer_rounded, size: 18),
                    label: Text(
                      request.selectedTechnician != null ? 'عرض الفني المختار' : 'عرض العروض المقدمة',
                    ),
                  ),
                ),
              ],
              // Phase 7 — Chat button: visible once a technician is selected.
              if (request.selectedTechnician != null) ...[
                const SizedBox(height: 8),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton.icon(
                    style: FilledButton.styleFrom(
                      backgroundColor: AppColors.gold,
                      foregroundColor: Colors.white,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    onPressed: () => context.push(
                      RoutePaths.chat(request.id),
                      extra: {
                        'serviceName': serviceName,
                        'status': request.status,
                        'otherName': request.selectedTechnician!.fullName,
                        'otherImage': request.selectedTechnician!.profileImage,
                      },
                    ),
                    icon: const Icon(Icons.chat_bubble_outline_rounded, size: 18),
                    label: const Text('فتح المحادثة'),
                  ),
                ),
              ],
            ],
          ),
        ),

        const SizedBox(height: 18),
        _SectionTitle('حالة الطلب'),
        const SizedBox(height: 8),
        _Card(child: RequestTimeline(status: request.status)),

        const SizedBox(height: 18),
        _SectionTitle('تفاصيل الطلب'),
        const SizedBox(height: 8),
        _Card(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _DetailRow(label: 'الوصف', value: request.description),
              const Divider(height: 20),
              _DetailRow(
                label: 'العنوان',
                value: request.address,
              ),
              const Divider(height: 20),
              _DetailRow(
                label: 'المنطقة',
                value: [
                  request.governorate?.nameAr,
                  request.area?.nameAr,
                ].where((e) => e != null && e.isNotEmpty).join(' - '),
              ),
              if (request.agreedPrice != null) ...[
                const Divider(height: 20),
                _DetailRow(label: 'السعر المتفق عليه', value: '${request.agreedPrice} جنيه'),
              ],
              if (request.customerPayableAmount != null) ...[
                const Divider(height: 20),
                _DetailRow(label: 'المبلغ المستحق', value: '${request.customerPayableAmount} جنيه'),
              ],
              if (request.cancelReason != null && request.cancelReason!.isNotEmpty) ...[
                const Divider(height: 20),
                _DetailRow(label: 'سبب الإلغاء', value: request.cancelReason!),
              ],
              if (request.adminNote != null && request.adminNote!.isNotEmpty) ...[
                const Divider(height: 20),
                _DetailRow(label: 'ملاحظة الإدارة', value: request.adminNote!),
              ],
            ],
          ),
        ),

        if (request.images.isNotEmpty || request.audioUrl != null) ...[
          const SizedBox(height: 18),
          _SectionTitle('المرفقات'),
          const SizedBox(height: 8),
          _Card(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (request.images.isNotEmpty) RequestImageGallery(images: request.images),
                if (request.images.isNotEmpty && request.audioUrl != null) const SizedBox(height: 12),
                if (request.audioUrl != null) VoiceNotePlayer(url: request.audioUrl!),
              ],
            ),
          ),
        ],

        if (request.customer != null) ...[
          const SizedBox(height: 18),
          _SectionTitle('بيانات العميل'),
          const SizedBox(height: 8),
          _PersonCard(person: request.customer!, fallbackName: request.fullName, fallbackMobile: request.mobile),
        ],

        if (request.selectedTechnician != null) ...[
          const SizedBox(height: 18),
          _SectionTitle('الفني المختار'),
          const SizedBox(height: 8),
          _PersonCard(person: request.selectedTechnician!),
        ],

        if (errorMessage != null) ...[
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.destructive.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              children: [
                const Icon(Icons.error_outline, color: AppColors.destructive, size: 18),
                const SizedBox(width: 8),
                Expanded(child: Text(errorMessage!, style: const TextStyle(color: AppColors.destructive, fontSize: 12.5))),
              ],
            ),
          ),
        ],

        if (_canRespondToCompletion) ...[
          const SizedBox(height: 22),
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: AppColors.gold.withValues(alpha: 0.3)),
            ),
            child: const Row(
              children: [
                Icon(Icons.info_outline_rounded, color: AppColors.gold, size: 20),
                SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'أعلن الفني إتمام تنفيذ الطلب. هل تم تنفيذ الخدمة بنجاح؟',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: AppButton(
                  label: 'نعم، تم التنفيذ',
                  isLoading: isSubmitting,
                  onPressed: isSubmitting ? null : () => _confirmComplete(context, ref),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: AppSecondaryButton(
                  label: 'لا، لم يتم',
                  onPressed: isSubmitting ? null : () => _confirmRejectCompletion(context, ref),
                ),
              ),
            ],
          ),
        ] else if (_canCancel) ...[
          const SizedBox(height: 22),
          AppSecondaryButton(
            label: 'إلغاء الطلب',
            onPressed: isSubmitting ? null : () => _confirmCancel(context, ref),
          ),
        ],
      ],
    );
  }

  Future<void> _confirmComplete(BuildContext context, WidgetRef ref) async {
    final ok = await ref.read(requestActionProvider.notifier).complete(request.id);
    if (!context.mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تم تأكيد الإنجاز، شكراً لك!'), backgroundColor: AppColors.gold),
      );
    }
  }

  Future<void> _confirmRejectCompletion(BuildContext context, WidgetRef ref) async {
    final confirmed = await _showReasonDialog(
      context,
      title: 'لم يتم التنفيذ؟',
      message: 'سيتم إلغاء الطلب وتنبيه فريق الدعم. تواصل معنا إذا احتجت مساعدة إضافية.',
      defaultReason: 'لم يتم التنفيذ بشكل صحيح',
    );
    if (confirmed == null || !context.mounted) return;
    final ok = await ref.read(requestActionProvider.notifier).cancel(request.id, reason: confirmed);
    if (!context.mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تم إلغاء تأكيد الإنجاز')),
      );
    }
  }

  Future<void> _confirmCancel(BuildContext context, WidgetRef ref) async {
    final confirmed = await _showReasonDialog(
      context,
      title: 'إلغاء الطلب؟',
      message: 'لن تتمكن من التراجع بعد إلغاء الطلب.',
      defaultReason: 'إلغاء من قبل العميل',
    );
    if (confirmed == null || !context.mounted) return;
    final ok = await ref.read(requestActionProvider.notifier).cancel(request.id, reason: confirmed);
    if (!context.mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('تم إلغاء الطلب')));
    }
  }

  Future<String?> _showReasonDialog(
    BuildContext context, {
    required String title,
    required String message,
    required String defaultReason,
  }) {
    return showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(onPressed: () => context.pop(), child: const Text('تراجع')),
          TextButton(
            onPressed: () => context.pop(defaultReason),
            child: const Text('تأكيد', style: TextStyle(color: AppColors.destructive, fontWeight: FontWeight.w700)),
          ),
        ],
      ),
    );
  }

  static String _formatDate(String iso) {
    final parsed = DateTime.tryParse(iso);
    if (parsed == null) return iso;
    return DateFormat('d MMM yyyy، h:mm a', 'ar').format(parsed.toLocal());
  }
}

// ─── Small presentational helpers ─────────────────────────────────────────────

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.text);
  final String text;

  @override
  Widget build(BuildContext context) =>
      Text(text, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700));
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

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.icon, required this.text, this.color});
  final IconData icon;
  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Icon(icon, size: 14, color: color ?? Theme.of(context).colorScheme.onSurfaceVariant),
        const SizedBox(width: 6),
        Text(
          text,
          style: TextStyle(
            fontSize: 12,
            fontWeight: color != null ? FontWeight.w700 : FontWeight.w500,
            color: color ?? Theme.of(context).colorScheme.onSurfaceVariant,
          ),
        ),
      ],
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    if (value.isEmpty) return const SizedBox.shrink();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(fontSize: 11.5, color: Theme.of(context).colorScheme.onSurfaceVariant, fontWeight: FontWeight.w600),
        ),
        const SizedBox(height: 4),
        Text(value, style: const TextStyle(fontSize: 14, height: 1.4)),
      ],
    );
  }
}

class _PersonCard extends StatelessWidget {
  const _PersonCard({required this.person, this.fallbackName, this.fallbackMobile});
  final RequestPersonInfo person;
  final String? fallbackName;
  final String? fallbackMobile;

  @override
  Widget build(BuildContext context) {
    final name = person.fullName.isNotEmpty ? person.fullName : (fallbackName ?? '');
    final mobile = person.mobile ?? fallbackMobile;

    return _Card(
      child: Row(
        children: [
          CircleAvatar(
            radius: 22,
            backgroundColor: AppColors.gold.withValues(alpha: 0.15),
            child: Text(
              name.isNotEmpty ? name.substring(0, 1) : '?',
              style: const TextStyle(color: AppColors.gold, fontWeight: FontWeight.w800, fontSize: 16),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700)),
                if (mobile != null) ...[
                  const SizedBox(height: 3),
                  Text(mobile, style: TextStyle(fontSize: 12.5, color: Theme.of(context).colorScheme.onSurfaceVariant)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

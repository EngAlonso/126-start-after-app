import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../models/offer_model.dart';
import '../../../models/request_model.dart';
import '../../../theme/app_colors.dart';
import '../../../routing/route_paths.dart';
import '../providers/offers_provider.dart';
import '../providers/request_detail_provider.dart';
import '../widgets/offer_card.dart';
import '../widgets/selected_technician_card.dart';

/// Phase 6 — full Offers screen for one request: premium offer cards with
/// best-price / top-rated highlights, "اختيار هذا الفني" confirm flow
/// backed by the real `select` endpoint, and a dedicated "تم اختيار فني"
/// state once the request has moved past `offers_received`. Pull-to-refresh
/// reloads both the request (for status/selected technician) and the offer
/// list together.
class OffersScreen extends ConsumerWidget {
  const OffersScreen({super.key, required this.requestId});

  final int requestId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final asyncRequest = ref.watch(requestDetailProvider(requestId));
    final asyncOffers = ref.watch(offersProvider(requestId));

    return Scaffold(
      backgroundColor: isDark ? AppColors.darkBackground : AppColors.lightBackground,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        title: const Text('عروض الفنيين', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18)),
        leading: IconButton(icon: const Icon(Icons.arrow_forward), onPressed: () => context.pop()),
      ),
      body: RefreshIndicator(
        color: AppColors.gold,
        onRefresh: () async {
          ref.invalidate(requestDetailProvider(requestId));
          ref.invalidate(offersProvider(requestId));
          await ref.read(offersProvider(requestId).future);
        },
        child: asyncRequest.when(
          loading: () => const _Loading(),
          error: (e, _) => _ErrorRetry(onRetry: () => ref.invalidate(requestDetailProvider(requestId))),
          data: (request) => asyncOffers.when(
            loading: () => const _Loading(),
            error: (e, _) => _ErrorRetry(onRetry: () => ref.invalidate(offersProvider(requestId))),
            data: (offers) => _OffersBody(request: request, offers: offers),
          ),
        ),
      ),
    );
  }
}

class _OffersBody extends ConsumerWidget {
  const _OffersBody({required this.request, required this.offers});

  final RequestModel request;
  final List<OfferModel> offers;

  bool get _hasSelectedTechnician => request.selectedTechnician != null;
  bool get _canSelect => const {'pending', 'offers_received'}.contains(request.status);

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final selectionState = ref.watch(offerSelectionProvider);
    final highlights = computeOfferHighlights(offers);

    if (offers.isEmpty && !_hasSelectedTechnician) {
      return const _EmptyState();
    }

    final pendingOffers = offers.where((o) => o.isPending).toList();
    final historyOffers = offers.where((o) => !o.isPending).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
      children: [
        if (_hasSelectedTechnician) ...[
          SelectedTechnicianCard(technician: request.selectedTechnician!, status: request.status),
          const SizedBox(height: 20),
        ] else if (offers.isEmpty) ...[
          const _EmptyState(),
        ],

        if (selectionState.errorMessage != null) ...[
          _ErrorBanner(message: selectionState.errorMessage!),
          const SizedBox(height: 14),
        ],

        if (pendingOffers.isNotEmpty && !_hasSelectedTechnician) ...[
          Text(
            'العروض المقدمة (${pendingOffers.length})',
            style: const TextStyle(fontSize: 14.5, fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 10),
          ...pendingOffers.map(
            (offer) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: OfferCard(
                offer: offer,
                highlights: highlights[offer.id] ?? const OfferHighlights(),
                onTap: () => context.push(RoutePaths.offerDetail(request.id, offer.id), extra: offer),
                onSelect: _canSelect
                    ? () => _confirmSelect(context, ref, offer)
                    : null,
                isSelecting: selectionState.isSubmitting,
              ),
            ),
          ),
        ],

        if (historyOffers.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(
            _hasSelectedTechnician ? 'عروض أخرى' : 'عروض سابقة',
            style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 10),
          ...historyOffers.map(
            (offer) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: OfferCard(
                offer: offer,
                onTap: () => context.push(RoutePaths.offerDetail(request.id, offer.id), extra: offer),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Future<void> _confirmSelect(BuildContext context, WidgetRef ref, OfferModel offer) async {
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

    final ok = await ref.read(offerSelectionProvider.notifier).select(requestId: request.id, offerId: offer.id);
    if (!context.mounted) return;
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('تم اختيار الفني بنجاح'), backgroundColor: AppColors.chartGreen),
      );
    }
  }
}

class _EmptyState extends StatelessWidget {
  const _EmptyState();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 60),
      child: Column(
        children: [
          Icon(Icons.local_offer_outlined, size: 56, color: Theme.of(context).colorScheme.onSurfaceVariant.withValues(alpha: 0.5)),
          const SizedBox(height: 14),
          const Text('لا توجد عروض حتى الآن', style: TextStyle(fontSize: 15, fontWeight: FontWeight.w700)),
          const SizedBox(height: 6),
          Text(
            'سيصلك إشعار فور تقديم أحد الفنيين عرضاً على طلبك',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 12.5, color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
        ],
      ),
    );
  }
}

class _Loading extends StatelessWidget {
  const _Loading();
  @override
  Widget build(BuildContext context) => const Center(child: CircularProgressIndicator(color: AppColors.gold));
}

class _ErrorRetry extends StatelessWidget {
  const _ErrorRetry({required this.onRetry});
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.wifi_off_rounded, size: 48, color: AppColors.gold),
          const SizedBox(height: 12),
          const Text('تعذر تحميل العروض', style: TextStyle(fontSize: 16)),
          const SizedBox(height: 8),
          TextButton(onPressed: onRetry, child: const Text('إعادة المحاولة')),
        ],
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.destructive.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: AppColors.destructive, size: 18),
          const SizedBox(width: 8),
          Expanded(child: Text(message, style: const TextStyle(color: AppColors.destructive, fontSize: 12.5))),
        ],
      ),
    );
  }
}

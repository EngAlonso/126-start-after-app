import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../models/offer_model.dart';
import '../../../theme/app_colors.dart';
import '../providers/tech_providers.dart';

/// Bottom sheet for submitting a new offer or editing an existing pending one.
///
/// Pass [existingOffer] to pre-fill the form and switch to edit mode (PATCH).
/// Callers close the sheet by listening to [TechOfferNotifier.state.isSuccess].
void showOfferSheet({
  required BuildContext context,
  required int requestId,
  OfferModel? existingOffer,
}) {
  showModalBottomSheet(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
    ),
    builder: (_) => _OfferSheet(
      requestId: requestId,
      existingOffer: existingOffer,
    ),
  );
}

class _OfferSheet extends ConsumerStatefulWidget {
  const _OfferSheet({required this.requestId, this.existingOffer});

  final int requestId;
  final OfferModel? existingOffer;

  @override
  ConsumerState<_OfferSheet> createState() => _OfferSheetState();
}

class _OfferSheetState extends ConsumerState<_OfferSheet> {
  final _formKey = GlobalKey<FormState>();
  late final TextEditingController _priceCtrl;
  late final TextEditingController _spareCtrl;
  late final TextEditingController _notesCtrl;

  bool get _isEdit => widget.existingOffer != null;

  @override
  void initState() {
    super.initState();
    final existing = widget.existingOffer;
    _priceCtrl =
        TextEditingController(text: existing != null ? _fmt(existing.price) : '');
    _spareCtrl = TextEditingController(
        text: existing != null && existing.spareParts > 0
            ? _fmt(existing.spareParts)
            : '');
    _notesCtrl =
        TextEditingController(text: existing?.notes ?? '');
  }

  @override
  void dispose() {
    _priceCtrl.dispose();
    _spareCtrl.dispose();
    _notesCtrl.dispose();
    super.dispose();
  }

  String _fmt(double v) =>
      v == v.toInt() ? v.toInt().toString() : v.toStringAsFixed(2);

  double get _price => double.tryParse(_priceCtrl.text.trim()) ?? 0;
  double get _spare => double.tryParse(_spareCtrl.text.trim()) ?? 0;
  double get _total => _price + _spare;

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    bool ok;
    if (_isEdit) {
      ok = await ref.read(techOfferProvider.notifier).update(
            requestId: widget.requestId,
            offerId: widget.existingOffer!.id,
            price: _price,
            spareParts: _spare,
            notes: _notesCtrl.text.trim().isNotEmpty
                ? _notesCtrl.text.trim()
                : null,
          );
    } else {
      ok = await ref.read(techOfferProvider.notifier).submit(
            requestId: widget.requestId,
            price: _price,
            spareParts: _spare,
            notes: _notesCtrl.text.trim().isNotEmpty
                ? _notesCtrl.text.trim()
                : null,
          );
    }

    if (ok && mounted) Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final offerState = ref.watch(techOfferProvider);
    final textTheme = Theme.of(context).textTheme;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 20, 24, 32),
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
                  decoration: BoxDecoration(
                    color: isDark
                        ? AppColors.darkInput
                        : AppColors.lightInput,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 20),

              // Title
              Text(
                _isEdit ? 'تعديل العرض' : 'تقديم عرض',
                style: textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: 4),
              Text(
                _isEdit
                    ? 'يمكنك تعديل السعر والملاحظات طالما العرض في الانتظار'
                    : 'سيتم حجز نقاط العمولة من رصيدك حتى يتم اختيار فني',
                style: textTheme.bodySmall?.copyWith(
                  color: isDark
                      ? AppColors.darkMutedForeground
                      : AppColors.lightMutedForeground,
                ),
              ),
              const SizedBox(height: 24),

              // Error
              if (offerState.errorMessage != null) ...[
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.destructive.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: AppColors.destructive.withValues(alpha: 0.4)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.error_outline_rounded,
                          color: AppColors.destructive, size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          offerState.errorMessage!,
                          style: const TextStyle(
                              color: AppColors.destructive, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // ── Price ─────────────────────────────────────────────────
              _Label('سعر الخدمة (جنيه) *'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _priceCtrl,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                onChanged: (_) => setState(() {}),
                validator: (v) {
                  final d = double.tryParse(v?.trim() ?? '');
                  if (d == null || d <= 0) return 'أدخل سعراً صحيحاً أكبر من صفر';
                  return null;
                },
                decoration: const InputDecoration(
                  labelText: 'سعر الخدمة',
                  prefixIcon:
                      Icon(Icons.payments_rounded, color: AppColors.gold),
                  suffixText: 'ج.م',
                ),
              ),
              const SizedBox(height: 16),

              // ── Spare parts ───────────────────────────────────────────
              _Label('قطع الغيار (اختياري)'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _spareCtrl,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                onChanged: (_) => setState(() {}),
                validator: (v) {
                  if (v == null || v.trim().isEmpty) return null;
                  final d = double.tryParse(v.trim());
                  if (d == null || d < 0) return 'أدخل قيمة صحيحة';
                  return null;
                },
                decoration: const InputDecoration(
                  labelText: 'تكلفة قطع الغيار',
                  prefixIcon:
                      Icon(Icons.settings_rounded, color: AppColors.gold),
                  suffixText: 'ج.م',
                ),
              ),
              const SizedBox(height: 16),

              // ── Total (computed) ──────────────────────────────────────
              if (_price > 0) ...[
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  decoration: BoxDecoration(
                    color: AppColors.gold.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                        color: AppColors.gold.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'الإجمالي المتوقع',
                        style: TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 13),
                      ),
                      Text(
                        '${_total.toStringAsFixed(_total == _total.toInt() ? 0 : 2)} ج.م',
                        style: const TextStyle(
                          color: AppColors.gold,
                          fontWeight: FontWeight.w800,
                          fontSize: 15,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
              ],

              // ── Notes ─────────────────────────────────────────────────
              _Label('ملاحظات (اختياري)'),
              const SizedBox(height: 8),
              TextFormField(
                controller: _notesCtrl,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'ملاحظاتك للعميل',
                  prefixIcon: Icon(Icons.notes_rounded, color: AppColors.gold),
                  alignLabelWithHint: true,
                ),
              ),
              const SizedBox(height: 28),

              // ── Submit ────────────────────────────────────────────────
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: offerState.isSubmitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.gold,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: offerState.isSubmitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                              color: Colors.white, strokeWidth: 2.5),
                        )
                      : Text(
                          _isEdit ? 'حفظ التعديلات' : 'تقديم العرض',
                          style: const TextStyle(
                              fontWeight: FontWeight.w700, fontSize: 16),
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

class _Label extends StatelessWidget {
  const _Label(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Text(
      text,
      style: TextStyle(
        fontSize: 12.5,
        fontWeight: FontWeight.w700,
        color: isDark
            ? AppColors.darkMutedForeground
            : AppColors.lightMutedForeground,
      ),
    );
  }
}

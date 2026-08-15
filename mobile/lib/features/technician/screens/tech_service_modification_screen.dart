import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../features/auth/providers/auth_providers.dart';
import '../../../models/user_model.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';
import '../providers/tech_providers.dart';
import '../services/tech_modification_service.dart';

/// Screen where a technician submits a service-modification request.
///
/// Technicians are NOT allowed to modify their registered services or coverage
/// areas directly. This screen lets them describe the change they want, which
/// is sent to an admin for review and approval.
class TechServiceModificationScreen extends ConsumerStatefulWidget {
  const TechServiceModificationScreen({super.key});

  @override
  ConsumerState<TechServiceModificationScreen> createState() =>
      _TechServiceModificationScreenState();
}

class _TechServiceModificationScreenState
    extends ConsumerState<TechServiceModificationScreen> {
  final _formKey   = GlobalKey<FormState>();
  final _detailsCtrl = TextEditingController();

  String _requestType = 'add_service';
  bool   _submitting  = false;
  String? _errorMessage;
  bool   _submitted   = false;

  @override
  void dispose() {
    _detailsCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _submitting = true; _errorMessage = null; });

    try {
      await ref.read(techModificationServiceProvider).submitRequest(
        requestType: _requestType,
        details:     _detailsCtrl.text.trim(),
      );
      if (mounted) setState(() { _submitting = false; _submitted = true; });
    } catch (e) {
      if (mounted) {
        setState(() {
          _submitting   = false;
          _errorMessage = e.toString().replaceFirst('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark    = Theme.of(context).brightness == Brightness.dark;
    final textTheme = Theme.of(context).textTheme;

    return Scaffold(
      appBar: AppBar(
        title: const Text('طلب تعديل الخدمات'),
        centerTitle: true,
      ),
      body: _submitted
          ? _SuccessBody(onDone: () => Navigator.of(context).pop())
          : _FormBody(
              isDark:        isDark,
              textTheme:     textTheme,
              formKey:       _formKey,
              requestType:   _requestType,
              detailsCtrl:   _detailsCtrl,
              submitting:    _submitting,
              errorMessage:  _errorMessage,
              onTypeChanged: (v) => setState(() => _requestType = v),
              onSubmit:      _submit,
            ),
    );
  }
}

// ── Form body ─────────────────────────────────────────────────────────────────

class _FormBody extends ConsumerWidget {
  const _FormBody({
    required this.isDark,
    required this.textTheme,
    required this.formKey,
    required this.requestType,
    required this.detailsCtrl,
    required this.submitting,
    required this.errorMessage,
    required this.onTypeChanged,
    required this.onSubmit,
  });

  final bool                       isDark;
  final TextTheme                  textTheme;
  final GlobalKey<FormState>       formKey;
  final String                     requestType;
  final TextEditingController      detailsCtrl;
  final bool                       submitting;
  final String?                    errorMessage;
  final ValueChanged<String>       onTypeChanged;
  final VoidCallback               onSubmit;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final authState = ref.watch(authControllerProvider);
    final UserModel? user = switch (authState.asData?.value) {
      Authenticated(:final user) => user,
      _ => null,
    };
    final profileAsync = user != null
        ? ref.watch(technicianFullProfileProvider(user.id))
        : null;

    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 40),
      child: Form(
        key: formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Current services (read-only) ─────────────────────────────
            _SectionLabel(
              'خدماتك الحالية المسجّلة',
              isDark: isDark,
            ),
            const SizedBox(height: 10),
            _CurrentServicesCard(
              profileAsync: profileAsync,
              isDark:       isDark,
            ),

            const SizedBox(height: 24),

            // ── Info banner ───────────────────────────────────────────────
            _InfoBanner(isDark: isDark),

            const SizedBox(height: 24),

            // ── Request type ──────────────────────────────────────────────
            _SectionLabel('نوع التعديل المطلوب', isDark: isDark),
            const SizedBox(height: 12),
            _TypeSelector(
              selected:  requestType,
              isDark:    isDark,
              onChanged: onTypeChanged,
            ),

            const SizedBox(height: 24),

            // ── Details ───────────────────────────────────────────────────
            _SectionLabel('تفاصيل الطلب', isDark: isDark),
            const SizedBox(height: 10),
            TextFormField(
              controller: detailsCtrl,
              minLines:   4,
              maxLines:   8,
              maxLength:  800,
              validator: (v) =>
                  (v == null || v.trim().isEmpty)
                      ? 'يرجى وصف التعديل المطلوب'
                      : (v.trim().length < 20
                          ? 'يرجى إدخال تفاصيل كافية (20 حرفاً على الأقل)'
                          : null),
              decoration: InputDecoration(
                hintText:
                    'مثال: أرغب في إضافة خدمة "تمديدات الغاز"، أعمل في محافظة الجيزة وأملك خبرة ٥ سنوات في هذا المجال.',
                hintStyle: TextStyle(fontSize: 12.5, color: isDark
                    ? AppColors.darkMutedForeground
                    : AppColors.lightMutedForeground),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppDesign.radiusMD),
                  borderSide: BorderSide(
                    color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
                  ),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppDesign.radiusMD),
                  borderSide: BorderSide(
                    color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
                  ),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppDesign.radiusMD),
                  borderSide:
                      const BorderSide(color: AppColors.gold, width: 1.5),
                ),
              ),
            ),

            // ── Error ─────────────────────────────────────────────────────
            if (errorMessage != null) ...[
              const SizedBox(height: 12),
              _ErrorBanner(message: errorMessage!),
            ],

            const SizedBox(height: 28),

            // ── Submit ────────────────────────────────────────────────────
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: submitting ? null : onSubmit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.gold,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppDesign.radiusMD),
                  ),
                ),
                child: submitting
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2.5),
                      )
                    : const Text(
                        'إرسال الطلب للمراجعة',
                        style: TextStyle(
                            fontWeight: FontWeight.w700, fontSize: 16),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Current services card ─────────────────────────────────────────────────────

class _CurrentServicesCard extends StatelessWidget {
  const _CurrentServicesCard({required this.profileAsync, required this.isDark});
  final AsyncValue<dynamic>? profileAsync;
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    final bg = isDark ? AppColors.darkCard : AppColors.lightCard;
    final border = isDark ? AppColors.darkBorder : AppColors.lightBorder;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppDesign.radiusMD),
        border: Border.all(color: border),
      ),
      child: profileAsync == null
          ? _loadingRow()
          : profileAsync!.when(
              loading: _loadingRow,
              error: (_, __) => const Text(
                'تعذر تحميل الخدمات الحالية',
                style: TextStyle(color: AppColors.destructive, fontSize: 13),
              ),
              data: (profile) {
                final services = profile.services as List;
                if (services.isEmpty) {
                  return const Text(
                    'لم يتم تسجيل خدمات بعد',
                    style: TextStyle(fontSize: 13),
                  );
                }
                return Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: services
                      .map((s) => _ServiceChip(name: s.nameAr as String))
                      .toList(),
                );
              },
            ),
    );
  }

  Widget _loadingRow() => const SizedBox(
        height: 24,
        child: Center(
          child: SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(
                color: AppColors.gold, strokeWidth: 1.5),
          ),
        ),
      );
}

class _ServiceChip extends StatelessWidget {
  const _ServiceChip({required this.name});
  final String name;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
      decoration: BoxDecoration(
        color: AppColors.gold.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppDesign.radiusFull),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.35)),
      ),
      child: Text(
        name,
        style: const TextStyle(
          color: AppColors.gold,
          fontSize: 12.5,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ── Info banner ───────────────────────────────────────────────────────────────

class _InfoBanner extends StatelessWidget {
  const _InfoBanner({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.gold.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppDesign.radiusMD),
        border: Border.all(color: AppColors.gold.withValues(alpha: 0.28)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline_rounded,
              color: AppColors.gold, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              'سيتم مراجعة طلبك من قِبل الإدارة. '
              'لا يمكن تغيير الخدمات أو مناطق التغطية مباشرةً — '
              'يمنح ذلك الإدارة صلاحية التحقق وضمان جودة الخدمة.',
              style: TextStyle(
                color: AppColors.gold,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
                height: 1.55,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Request type selector ─────────────────────────────────────────────────────

class _TypeSelector extends StatelessWidget {
  const _TypeSelector({
    required this.selected,
    required this.isDark,
    required this.onChanged,
  });

  final String              selected;
  final bool                isDark;
  final ValueChanged<String> onChanged;

  static const _types = [
    ('add_service',    'إضافة خدمة',          Icons.add_circle_outline_rounded),
    ('remove_service', 'حذف خدمة',            Icons.remove_circle_outline_rounded),
    ('change_areas',   'تغيير مناطق التغطية', Icons.location_on_outlined),
    ('other',          'طلب آخر',              Icons.help_outline_rounded),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      children: _types.map((rec) {
        final (value, label, icon) = rec;
        final isSelected = selected == value;
        return GestureDetector(
          onTap: () => onChanged(value),
          child: AnimatedContainer(
            duration: AppDesign.durationNormal,
            margin: const EdgeInsets.only(bottom: 10),
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: isSelected
                  ? AppColors.gold.withValues(alpha: isDark ? 0.18 : 0.10)
                  : (isDark ? AppColors.darkCard : AppColors.lightCard),
              borderRadius: BorderRadius.circular(AppDesign.radiusMD),
              border: Border.all(
                color: isSelected
                    ? AppColors.gold.withValues(alpha: 0.60)
                    : (isDark ? AppColors.darkBorder : AppColors.lightBorder),
                width: isSelected ? 1.5 : 1.0,
              ),
            ),
            child: Row(
              children: [
                Icon(
                  icon,
                  size: 22,
                  color: isSelected
                      ? AppColors.gold
                      : (isDark
                          ? AppColors.darkMutedForeground
                          : AppColors.lightMutedForeground),
                ),
                const SizedBox(width: 12),
                Text(
                  label,
                  style: TextStyle(
                    fontWeight:
                        isSelected ? FontWeight.w700 : FontWeight.w500,
                    color: isSelected ? AppColors.gold : null,
                    fontSize: 14,
                  ),
                ),
                const Spacer(),
                if (isSelected)
                  const Icon(Icons.check_circle_rounded,
                      color: AppColors.gold, size: 20),
              ],
            ),
          ),
        );
      }).toList(),
    );
  }
}

// ── Error banner ──────────────────────────────────────────────────────────────

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.destructive.withValues(alpha: 0.10),
        borderRadius: BorderRadius.circular(AppDesign.radiusMD),
        border: Border.all(
            color: AppColors.destructive.withValues(alpha: 0.35)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded,
              color: AppColors.destructive, size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                  color: AppColors.destructive, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Success body ──────────────────────────────────────────────────────────────

class _SuccessBody extends StatelessWidget {
  const _SuccessBody({required this.onDone});
  final VoidCallback onDone;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(40),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 80,
              height: 80,
              decoration: BoxDecoration(
                color: AppColors.chartGreen.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle_rounded,
                  color: AppColors.chartGreen, size: 46),
            ),
            const SizedBox(height: 20),
            const Text(
              'تم إرسال طلبك بنجاح!',
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 10),
            Text(
              'سيتم مراجعة طلبك من قِبل الإدارة والرد عليك في أقرب وقت ممكن.',
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 14,
                height: 1.6,
                color: Theme.of(context).colorScheme.onSurfaceVariant,
              ),
            ),
            const SizedBox(height: 32),
            ElevatedButton(
              onPressed: onDone,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.gold,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(
                    horizontal: 40, vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppDesign.radiusMD),
                ),
              ),
              child: const Text('حسناً',
                  style: TextStyle(fontWeight: FontWeight.w700)),
            ),
          ],
        ),
      ),
    );
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text, {required this.isDark});
  final String text;
  final bool   isDark;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 13.5,
        fontWeight: FontWeight.w700,
        color: isDark
            ? AppColors.darkMutedForeground
            : AppColors.lightMutedForeground,
        letterSpacing: 0.3,
      ),
    );
  }
}

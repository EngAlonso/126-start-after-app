import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../models/area_model.dart';
import '../../../models/governorate_model.dart';
import '../../../models/service_model.dart';
import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';
import '../../auth/providers/auth_providers.dart';
import '../../auth/providers/catalog_providers.dart';
import '../providers/create_request_provider.dart';

/// Multi-field form for submitting a new service request.
///
/// Accepts an optional [initialServiceId] (passed from the home screen's
/// service tile taps via the `?serviceId=` query parameter). When provided
/// the service dropdown is pre-selected on open.
class CreateRequestScreen extends ConsumerStatefulWidget {
  const CreateRequestScreen({super.key, this.initialServiceId});

  final int? initialServiceId;

  @override
  ConsumerState<CreateRequestScreen> createState() =>
      _CreateRequestScreenState();
}

class _CreateRequestScreenState extends ConsumerState<CreateRequestScreen> {
  final _formKey = GlobalKey<FormState>();

  // ── Controllers ────────────────────────────────────────────────────────────
  late final TextEditingController _fullNameCtrl;
  late final TextEditingController _mobileCtrl;
  final TextEditingController _addressCtrl     = TextEditingController();
  final TextEditingController _descriptionCtrl = TextEditingController();

  // ── Dropdown selections ────────────────────────────────────────────────────
  int? _selectedServiceId;
  int? _selectedGovernorateId;
  int? _selectedAreaId;

  @override
  void initState() {
    super.initState();
    _selectedServiceId = widget.initialServiceId;

    // Pre-fill name & mobile from the currently logged-in user.
    final authState = ref.read(authControllerProvider).asData?.value;
    final user = authState is Authenticated ? authState.user : null;
    _fullNameCtrl = TextEditingController(text: user?.fullName ?? '');
    _mobileCtrl   = TextEditingController(text: user?.mobile  ?? '');
  }

  @override
  void dispose() {
    _fullNameCtrl.dispose();
    _mobileCtrl.dispose();
    _addressCtrl.dispose();
    _descriptionCtrl.dispose();
    super.dispose();
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;

    final request = await ref.read(createRequestProvider.notifier).submit(
          serviceId:     _selectedServiceId!,
          fullName:      _fullNameCtrl.text.trim(),
          mobile:        _mobileCtrl.text.trim(),
          governorateId: _selectedGovernorateId!,
          areaId:        _selectedAreaId!,
          address:       _addressCtrl.text.trim(),
          description:   _descriptionCtrl.text.trim(),
        );

    if (!mounted) return;

    if (request != null) {
      ref.read(createRequestProvider.notifier).reset();
      context.go(RoutePaths.createRequestSuccess, extra: request.id);
    }
    // Error is shown via the state.errorMessage listener below.
  }

  // ── Build ──────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final isDark         = Theme.of(context).brightness == Brightness.dark;
    final submissionState = ref.watch(createRequestProvider);

    // Show error snackbar when submission fails.
    ref.listen(createRequestProvider, (prev, next) {
      if (next.errorMessage != null && prev?.errorMessage != next.errorMessage) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(next.errorMessage!),
            backgroundColor: AppColors.destructive,
          ),
        );
      }
    });

    final servicesAsync      = ref.watch(servicesProvider);
    final governoratesAsync  = ref.watch(governoratesProvider);
    final areasAsync         = ref.watch(areasProvider);

    // Filter areas to those that belong to the selected governorate.
    final filteredAreas = areasAsync.asData?.value
        .where((a) => a.governorateId == _selectedGovernorateId)
        .toList();

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.lightBackground,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.darkCard : AppColors.lightCard,
        elevation: 0,
        centerTitle: true,
        title: const Text(
          'طلب خدمة جديد',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
        ),
        leading: BackButton(
          onPressed: () => context.pop(),
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [

            // ── DEBUG LABEL — remove after confirmation ──
            Container(
              color: Colors.red,
              padding: const EdgeInsets.all(10),
              child: const Text(
                'DEBUG BUILD 123',
                textAlign: TextAlign.center,
                style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
              ),
            ),
            const SizedBox(height: 12),

            // ── Section: Service ──────────────────────────────────────────
            _SectionLabel(label: 'نوع الخدمة', isDark: isDark),
            const SizedBox(height: 8),
            servicesAsync.when(
              loading: () => const _LoadingDropdown(hint: 'جارٍ تحميل الخدمات...'),
              error:   (_, __) => const _ErrorDropdown(hint: 'تعذّر تحميل الخدمات'),
              data:    (services) => _AppDropdown<ServiceModel>(
                hint:     'اختر نوع الخدمة',
                items:    services,
                value:    services.where((s) => s.id == _selectedServiceId).firstOrNull,
                labelBuilder: (s) => s.nameAr,
                validator: (_) => _selectedServiceId == null ? 'الرجاء اختيار نوع الخدمة' : null,
                onChanged: (s) => setState(() {
                  _selectedServiceId = s?.id;
                }),
                isDark: isDark,
              ),
            ),

            const SizedBox(height: 20),

            // ── Section: Location ─────────────────────────────────────────
            _SectionLabel(label: 'الموقع', isDark: isDark),
            const SizedBox(height: 8),

            // Governorate
            governoratesAsync.when(
              loading: () => const _LoadingDropdown(hint: 'جارٍ تحميل المحافظات...'),
              error:   (_, __) => const _ErrorDropdown(hint: 'تعذّر تحميل المحافظات'),
              data:    (govs) => _AppDropdown<GovernorateModel>(
                hint:     'اختر المحافظة',
                items:    govs,
                value:    govs.where((g) => g.id == _selectedGovernorateId).firstOrNull,
                labelBuilder: (g) => g.nameAr,
                validator: (_) => _selectedGovernorateId == null ? 'الرجاء اختيار المحافظة' : null,
                onChanged: (g) => setState(() {
                  _selectedGovernorateId = g?.id;
                  _selectedAreaId        = null; // reset area on governorate change
                }),
                isDark: isDark,
              ),
            ),

            const SizedBox(height: 12),

            // Area (only enabled once a governorate is selected)
            if (_selectedGovernorateId != null && areasAsync.isLoading)
              const _LoadingDropdown(hint: 'جارٍ تحميل المناطق...')
            else if (_selectedGovernorateId != null)
              _AppDropdown<AreaModel>(
                hint:     'اختر المنطقة',
                items:    filteredAreas ?? [],
                value:    filteredAreas?.where((a) => a.id == _selectedAreaId).firstOrNull,
                labelBuilder: (a) => a.nameAr,
                validator: (_) => _selectedAreaId == null ? 'الرجاء اختيار المنطقة' : null,
                onChanged: (a) => setState(() => _selectedAreaId = a?.id),
                isDark: isDark,
              )
            else
              _AppDropdown<AreaModel>(
                hint:     'حدّد المحافظة أولاً',
                items:    const [],
                value:    null,
                labelBuilder: (a) => a.nameAr,
                onChanged: null,
                isDark: isDark,
              ),

            const SizedBox(height: 20),

            // ── Section: Personal details ─────────────────────────────────
            _SectionLabel(label: 'البيانات الشخصية', isDark: isDark),
            const SizedBox(height: 8),

            _AppTextField(
              controller: _fullNameCtrl,
              label:       'الاسم الكامل',
              hint:        'أدخل اسمك الكامل',
              isDark:      isDark,
              validator:   (v) => (v == null || v.trim().isEmpty)
                  ? 'الرجاء إدخال الاسم الكامل'
                  : null,
            ),
            const SizedBox(height: 12),
            _AppTextField(
              controller:   _mobileCtrl,
              label:        'رقم الهاتف',
              hint:         '01xxxxxxxxx',
              isDark:       isDark,
              keyboardType: TextInputType.phone,
              inputFormatters: [FilteringTextInputFormatter.digitsOnly],
              validator:    (v) => (v == null || v.trim().length < 10)
                  ? 'الرجاء إدخال رقم هاتف صحيح'
                  : null,
            ),

            const SizedBox(height: 20),

            // ── Section: Request details ──────────────────────────────────
            _SectionLabel(label: 'تفاصيل الطلب', isDark: isDark),
            const SizedBox(height: 8),

            _AppTextField(
              controller: _addressCtrl,
              label:      'العنوان التفصيلي',
              hint:       'الشارع، المبنى، الطابق...',
              isDark:     isDark,
              validator:  (v) => (v == null || v.trim().isEmpty)
                  ? 'الرجاء إدخال العنوان'
                  : null,
            ),
            const SizedBox(height: 12),
            _AppTextField(
              controller: _descriptionCtrl,
              label:      'وصف المشكلة',
              hint:       'صِف المشكلة بالتفصيل لمساعدة الفنيين على تقديم أفضل عرض...',
              isDark:     isDark,
              maxLines:   4,
              validator:  (v) => (v == null || v.trim().length < 10)
                  ? 'الرجاء كتابة وصف مفصّل (١٠ أحرف على الأقل)'
                  : null,
            ),

            const SizedBox(height: 32),

            // ── Submit button ─────────────────────────────────────────────
            SizedBox(
              height: 54,
              child: ElevatedButton(
                onPressed: submissionState.isSubmitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.gold,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor: AppColors.gold.withValues(alpha: 0.5),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppDesign.radiusLG),
                  ),
                  elevation: 0,
                ),
                child: submissionState.isSubmitting
                    ? const SizedBox(
                        width:  22,
                        height: 22,
                        child:  CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2.5,
                        ),
                      )
                    : const Text(
                        'إرسال الطلب',
                        style: TextStyle(
                          fontSize:   16,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ),

            const SizedBox(height: 32),
          ],
        ),
      ),
    );
  }
}

// ── Shared form widgets ───────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel({required this.label, required this.isDark});

  final String label;
  final bool   isDark;

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: TextStyle(
        fontSize:   13,
        fontWeight: FontWeight.w700,
        color:      isDark ? AppColors.darkMutedForeground : AppColors.lightMutedForeground,
      ),
    );
  }
}

class _AppTextField extends StatelessWidget {
  const _AppTextField({
    required this.controller,
    required this.label,
    required this.hint,
    required this.isDark,
    this.maxLines = 1,
    this.keyboardType,
    this.inputFormatters,
    this.validator,
  });

  final TextEditingController      controller;
  final String                     label;
  final String                     hint;
  final bool                       isDark;
  final int                        maxLines;
  final TextInputType?              keyboardType;
  final List<TextInputFormatter>?  inputFormatters;
  final FormFieldValidator<String>? validator;

  @override
  Widget build(BuildContext context) {
    final fillColor = isDark ? AppColors.darkCard : AppColors.lightCard;
    final borderColor = isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder;

    return TextFormField(
      controller:      controller,
      maxLines:        maxLines,
      keyboardType:    keyboardType,
      inputFormatters: inputFormatters,
      validator:       validator,
      textAlign:       TextAlign.right,
      decoration: InputDecoration(
        labelText:      label,
        hintText:       hint,
        filled:         true,
        fillColor:      fillColor,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppDesign.radiusMD),
          borderSide:   BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppDesign.radiusMD),
          borderSide:   BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppDesign.radiusMD),
          borderSide:   const BorderSide(color: AppColors.gold, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppDesign.radiusMD),
          borderSide:   const BorderSide(color: AppColors.destructive),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppDesign.radiusMD),
          borderSide:   const BorderSide(color: AppColors.destructive, width: 1.5),
        ),
      ),
    );
  }
}

class _AppDropdown<T> extends StatelessWidget {
  const _AppDropdown({
    required this.hint,
    required this.items,
    required this.value,
    required this.labelBuilder,
    required this.onChanged,
    required this.isDark,
    this.validator,
  });

  final String                       hint;
  final List<T>                      items;
  final T?                           value;
  final String Function(T)           labelBuilder;
  final ValueChanged<T?>?            onChanged;
  final FormFieldValidator<T>?       validator;
  final bool                         isDark;

  @override
  Widget build(BuildContext context) {
    final fillColor   = isDark ? AppColors.darkCard  : AppColors.lightCard;
    final borderColor = isDark ? AppColors.darkCardBorder : AppColors.lightCardBorder;

    return DropdownButtonFormField<T>(
      value:     value,
      validator: validator,
      isExpanded: true,
      decoration: InputDecoration(
        filled:    true,
        fillColor: fillColor,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppDesign.radiusMD),
          borderSide:   BorderSide(color: borderColor),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppDesign.radiusMD),
          borderSide:   BorderSide(color: borderColor),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppDesign.radiusMD),
          borderSide:   const BorderSide(color: AppColors.gold, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppDesign.radiusMD),
          borderSide:   const BorderSide(color: AppColors.destructive),
        ),
      ),
      hint: Text(hint, textAlign: TextAlign.right),
      items: items.map((item) {
        return DropdownMenuItem<T>(
          value: item,
          child: Text(labelBuilder(item), textAlign: TextAlign.right),
        );
      }).toList(),
      onChanged: onChanged,
    );
  }
}

class _LoadingDropdown extends StatelessWidget {
  const _LoadingDropdown({required this.hint});
  final String hint;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: InputDecorator(
        decoration: InputDecoration(
          filled:     true,
          fillColor:  Theme.of(context).cardColor,
          border:     OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppDesign.radiusMD),
          ),
          suffixIcon: const SizedBox(
            width: 20, height: 20,
            child: Center(
              child: SizedBox(
                width: 16, height: 16,
                child: CircularProgressIndicator(strokeWidth: 2),
              ),
            ),
          ),
        ),
        child: Text(hint, style: TextStyle(color: Theme.of(context).hintColor)),
      ),
    );
  }
}

class _ErrorDropdown extends StatelessWidget {
  const _ErrorDropdown({required this.hint});
  final String hint;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: InputDecorator(
        decoration: InputDecoration(
          filled:     true,
          fillColor:  Theme.of(context).cardColor,
          border:     OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppDesign.radiusMD),
          ),
        ),
        child: Text(hint,
            style: const TextStyle(color: AppColors.destructive)),
      ),
    );
  }
}

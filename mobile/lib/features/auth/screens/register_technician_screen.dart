import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../routing/route_paths.dart';
import '../../../services/upload_service.dart';
import '../../../theme/app_colors.dart';
import '../../../utils/validators.dart';
import '../../../widgets/common/app_button.dart';
import '../../../widgets/common/app_text_field.dart';
import '../../../widgets/common/area_selector.dart';
import '../../../widgets/common/auth_shell.dart';
import '../../../widgets/common/experience_selector.dart';
import '../../../widgets/common/image_upload_tile.dart';
import '../../../widgets/common/service_selector.dart';
import '../providers/auth_providers.dart';
import '../providers/catalog_providers.dart';

/// 4-step technician registration wizard, mirroring the web app's
/// `register-technician.tsx` flow: personal info → professional info
/// (services + years of experience + coverage areas) → documents → review.
/// Unlike customer registration, a successful submit does NOT log the
/// user in (see `TechnicianPendingScreen`), so this screen never touches
/// [AuthState] — it calls the repository directly and manages its own
/// loading/error state.
class RegisterTechnicianScreen extends ConsumerStatefulWidget {
  const RegisterTechnicianScreen({super.key});

  @override
  ConsumerState<RegisterTechnicianScreen> createState() => _RegisterTechnicianScreenState();
}

class _RegisterTechnicianScreenState extends ConsumerState<RegisterTechnicianScreen> {
  int _step = 0;
  static const _stepCount = 4;

  final _step1FormKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _mobileController = TextEditingController();
  final _nationalIdController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  final Set<int> _selectedServiceIds = {};
  int? _yearsOfExperience;
  final Set<int> _selectedAreaIds = {};

  String? _personalPhotoUrl;
  String? _nationalIdFrontUrl;
  String? _nationalIdBackUrl;

  bool _isSubmitting = false;
  String? _submitError;

  @override
  void dispose() {
    _fullNameController.dispose();
    _mobileController.dispose();
    _nationalIdController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  bool get _canProceedStep2 => _selectedServiceIds.isNotEmpty && _yearsOfExperience != null && _selectedAreaIds.isNotEmpty;

  bool get _canProceedStep3 => _nationalIdFrontUrl != null && _nationalIdBackUrl != null;

  void _goNext() {
    if (_step == 0 && !(_step1FormKey.currentState?.validate() ?? false)) return;
    if (_step == 1 && !_canProceedStep2) return;
    if (_step == 2 && !_canProceedStep3) return;
    if (_step < _stepCount - 1) setState(() => _step++);
  }

  void _goBack() {
    if (_step > 0) {
      setState(() => _step--);
    } else {
      Navigator.of(context).maybePop();
    }
  }

  Future<void> _submit() async {
    setState(() {
      _isSubmitting = true;
      _submitError = null;
    });
    try {
      await ref.read(authRepositoryProvider).registerTechnician(
            fullName: _fullNameController.text.trim(),
            mobile: _mobileController.text.trim(),
            password: _passwordController.text,
            nationalId: _nationalIdController.text.trim(),
            personalPhoto: _personalPhotoUrl,
            nationalIdFront: _nationalIdFrontUrl!,
            nationalIdBack: _nationalIdBackUrl!,
            serviceIds: _selectedServiceIds.toList(),
            areaIds: _selectedAreaIds.toList(),
            primaryAreaId: _selectedAreaIds.first,
            yearsOfExperience: _yearsOfExperience!,
          );
      if (!mounted) return;
      context.go(RoutePaths.registerTechnicianPending);
    } catch (_) {
      setState(() {
        _isSubmitting = false;
        _submitError = 'تعذر إرسال طلب التسجيل، تأكد من اتصالك بالإنترنت وحاول مرة أخرى';
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      showBackButton: false,
      maxWidth: 560,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _StepHeader(step: _step, stepCount: _stepCount, onBack: _goBack),
          const SizedBox(height: 24),
          switch (_step) {
            0 => _PersonalInfoStep(
                formKey: _step1FormKey,
                fullNameController: _fullNameController,
                mobileController: _mobileController,
                nationalIdController: _nationalIdController,
                passwordController: _passwordController,
                confirmPasswordController: _confirmPasswordController,
              ),
            1 => _ProfessionalInfoStep(
                selectedServiceIds: _selectedServiceIds,
                yearsOfExperience: _yearsOfExperience,
                selectedAreaIds: _selectedAreaIds,
                onServicesChanged: () => setState(() {}),
                onYearsChanged: (value) => setState(() => _yearsOfExperience = value),
                onAreasChanged: () => setState(() {}),
              ),
            2 => _DocumentsStep(
                onPersonalPhotoUploaded: (url) => setState(() => _personalPhotoUrl = url),
                onNationalIdFrontUploaded: (url) => setState(() => _nationalIdFrontUrl = url),
                onNationalIdBackUploaded: (url) => setState(() => _nationalIdBackUrl = url),
              ),
            _ => _ReviewStep(
                fullName: _fullNameController.text.trim(),
                mobile: _mobileController.text.trim(),
                serviceCount: _selectedServiceIds.length,
                areaCount: _selectedAreaIds.length,
                yearsOfExperience: _yearsOfExperience,
              ),
          },
          if (_submitError != null) ...[
            const SizedBox(height: 16),
            Text(
              _submitError!,
              textAlign: TextAlign.center,
              style: const TextStyle(color: AppColors.destructive, fontSize: 13),
            ),
          ],
          const SizedBox(height: 24),
          Row(
            children: [
              if (_step > 0)
                Expanded(
                  child: AppSecondaryButton(label: 'السابق', onPressed: _isSubmitting ? null : _goBack),
                ),
              if (_step > 0) const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: AppButton(
                  label: _step == _stepCount - 1 ? 'إرسال الطلب' : 'التالي',
                  isLoading: _isSubmitting,
                  onPressed: _step == _stepCount - 1 ? _submit : _goNext,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StepHeader extends StatelessWidget {
  const _StepHeader({required this.step, required this.stepCount, required this.onBack});

  final int step;
  final int stepCount;
  final VoidCallback onBack;

  static const _titles = ['البيانات الشخصية', 'الخدمات والمناطق', 'المستندات', 'مراجعة الطلب'];

  @override
  Widget build(BuildContext context) {
    final progress = (step + 1) / stepCount;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          children: [
            IconButton(icon: const Icon(Icons.arrow_forward), onPressed: onBack),
            Expanded(
              child: Text(
                _titles[step],
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold),
              ),
            ),
            const SizedBox(width: 48),
          ],
        ),
        const SizedBox(height: 8),
        ClipRRect(
          borderRadius: BorderRadius.circular(4),
          child: LinearProgressIndicator(
            value: progress,
            minHeight: 6,
            backgroundColor: Theme.of(context).colorScheme.surfaceContainerHighest,
            color: AppColors.gold,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          'الخطوة ${step + 1} من $stepCount',
          textAlign: TextAlign.center,
          style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
        ),
      ],
    );
  }
}

class _PersonalInfoStep extends StatelessWidget {
  const _PersonalInfoStep({
    required this.formKey,
    required this.fullNameController,
    required this.mobileController,
    required this.nationalIdController,
    required this.passwordController,
    required this.confirmPasswordController,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController fullNameController;
  final TextEditingController mobileController;
  final TextEditingController nationalIdController;
  final TextEditingController passwordController;
  final TextEditingController confirmPasswordController;

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      autovalidateMode: AutovalidateMode.onUserInteraction,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          AppTextField(
            label: 'الاسم الكامل',
            controller: fullNameController,
            prefixIcon: Icons.person_outline,
            textInputAction: TextInputAction.next,
            validator: Validators.fullName,
          ),
          const SizedBox(height: 14),
          AppTextField(
            label: 'رقم الهاتف',
            controller: mobileController,
            keyboardType: TextInputType.phone,
            prefixIcon: Icons.phone_outlined,
            textInputAction: TextInputAction.next,
            validator: Validators.mobile,
          ),
          const SizedBox(height: 14),
          AppTextField(
            label: 'الرقم القومي',
            controller: nationalIdController,
            keyboardType: TextInputType.number,
            maxLength: 14,
            prefixIcon: Icons.badge_outlined,
            textInputAction: TextInputAction.next,
            validator: Validators.nationalId,
          ),
          const SizedBox(height: 14),
          AppPasswordField(
            label: 'كلمة المرور',
            controller: passwordController,
            textInputAction: TextInputAction.next,
            validator: Validators.password,
          ),
          const SizedBox(height: 14),
          AppPasswordField(
            label: 'تأكيد كلمة المرور',
            controller: confirmPasswordController,
            textInputAction: TextInputAction.done,
            validator: Validators.confirmPassword(() => passwordController.text),
          ),
        ],
      ),
    );
  }
}

class _ProfessionalInfoStep extends ConsumerWidget {
  const _ProfessionalInfoStep({
    required this.selectedServiceIds,
    required this.yearsOfExperience,
    required this.selectedAreaIds,
    required this.onServicesChanged,
    required this.onYearsChanged,
    required this.onAreasChanged,
  });

  final Set<int> selectedServiceIds;
  final int? yearsOfExperience;
  final Set<int> selectedAreaIds;
  final VoidCallback onServicesChanged;
  final ValueChanged<int?> onYearsChanged;
  final VoidCallback onAreasChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final servicesAsync = ref.watch(servicesProvider);
    final governoratesAsync = ref.watch(governoratesProvider);
    final areasAsync = ref.watch(areasProvider);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text('الخدمات التي تقدمها', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        const SizedBox(height: 10),
        servicesAsync.when(
          data: (services) => ServiceSelector(
            services: services,
            selectedIds: selectedServiceIds,
            onToggle: (id) {
              selectedServiceIds.contains(id) ? selectedServiceIds.remove(id) : selectedServiceIds.add(id);
              onServicesChanged();
            },
          ),
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (_, __) => const _InlineError(message: 'تعذر تحميل قائمة الخدمات'),
        ),
        const SizedBox(height: 20),
        const Text('سنوات الخبرة', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        const SizedBox(height: 10),
        ExperienceSelector(
          selectedYears: yearsOfExperience,
          onChanged: onYearsChanged,
        ),
        const SizedBox(height: 20),
        const Text('مناطق التغطية', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14)),
        const SizedBox(height: 10),
        governoratesAsync.when(
          data: (governorates) => areasAsync.when(
            data: (areas) => AreaSelector(
              governorates: governorates,
              areas: areas,
              selectedAreaIds: selectedAreaIds,
              onAreaToggle: (id) {
                selectedAreaIds.contains(id) ? selectedAreaIds.remove(id) : selectedAreaIds.add(id);
                onAreasChanged();
              },
              onBulkChanged: onAreasChanged,
            ),
            loading: () => const Padding(
              padding: EdgeInsets.symmetric(vertical: 16),
              child: Center(child: CircularProgressIndicator()),
            ),
            error: (_, __) => const _InlineError(message: 'تعذر تحميل قائمة المناطق'),
          ),
          loading: () => const Padding(
            padding: EdgeInsets.symmetric(vertical: 16),
            child: Center(child: CircularProgressIndicator()),
          ),
          error: (_, __) => const _InlineError(message: 'تعذر تحميل قائمة المحافظات'),
        ),
      ],
    );
  }
}

class _DocumentsStep extends ConsumerWidget {
  const _DocumentsStep({
    required this.onPersonalPhotoUploaded,
    required this.onNationalIdFrontUploaded,
    required this.onNationalIdBackUploaded,
  });

  final ValueChanged<String?> onPersonalPhotoUploaded;
  final ValueChanged<String?> onNationalIdFrontUploaded;
  final ValueChanged<String?> onNationalIdBackUploaded;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final uploadService = ref.watch(uploadServiceProvider);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ImageUploadTile(
          label: 'صورة شخصية',
          required: false,
          icon: Icons.face_outlined,
          uploadService: uploadService,
          category: UploadCategory.profilePhoto,
          onUploaded: onPersonalPhotoUploaded,
        ),
        const SizedBox(height: 16),
        ImageUploadTile(
          label: 'صورة البطاقة (الوجه الأمامي)',
          uploadService: uploadService,
          category: UploadCategory.nationalId,
          onUploaded: onNationalIdFrontUploaded,
        ),
        const SizedBox(height: 16),
        ImageUploadTile(
          label: 'صورة البطاقة (الوجه الخلفي)',
          uploadService: uploadService,
          category: UploadCategory.nationalId,
          onUploaded: onNationalIdBackUploaded,
        ),
      ],
    );
  }
}

class _ReviewStep extends StatelessWidget {
  const _ReviewStep({
    required this.fullName,
    required this.mobile,
    required this.serviceCount,
    required this.areaCount,
    required this.yearsOfExperience,
  });

  final String fullName;
  final String mobile;
  final int serviceCount;
  final int areaCount;
  final int? yearsOfExperience;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Theme.of(context).colorScheme.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _ReviewRow(label: 'الاسم', value: fullName),
          _ReviewRow(label: 'رقم الهاتف', value: mobile),
          _ReviewRow(label: 'سنوات الخبرة', value: yearsOfExperience == null ? '—' : '$yearsOfExperience سنة'),
          _ReviewRow(label: 'عدد الخدمات المختارة', value: '$serviceCount'),
          _ReviewRow(label: 'عدد المناطق المختارة', value: '$areaCount'),
          const SizedBox(height: 8),
          Text(
            'بالضغط على "إرسال الطلب" سيتم مراجعة حسابك من قبل الإدارة قبل تمكينك من تسجيل الدخول.',
            style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant, height: 1.6),
          ),
        ],
      ),
    );
  }
}

class _ReviewRow extends StatelessWidget {
  const _ReviewRow({required this.label, required this.value});
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurfaceVariant)),
          Text(value, style: const TextStyle(fontSize: 13, fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _InlineError extends StatelessWidget {
  const _InlineError({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Text(message, style: const TextStyle(color: AppColors.destructive, fontSize: 13));
  }
}

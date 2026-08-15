import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:image_picker/image_picker.dart';

import '../../../features/technician/providers/tech_providers.dart';
import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';
import '../../../widgets/common/experience_selector.dart';
import '../providers/profile_provider.dart';

/// Edit profile screen — shared between customer and technician roles.
///
/// Editable fields (all roles):
///   • Profile photo
///   • Full name
///   • Email (optional)
///   • Job title (optional)
///
/// Technician-only editable field:
///   • Years of experience
///
/// IMPORTANT — technicians cannot directly modify their registered services or
/// coverage areas.  A read-only display and a link to submit a
/// [RoutePaths.techServiceModification] request are shown instead.
class EditProfileScreen extends ConsumerStatefulWidget {
  const EditProfileScreen({super.key});

  @override
  ConsumerState<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends ConsumerState<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();

  late final TextEditingController _nameCtrl;
  late final TextEditingController _emailCtrl;
  late final TextEditingController _jobTitleCtrl;

  bool  _initialized = false;
  bool  _saving = false;
  String? _errorMessage;

  // Technician-only — years of experience (services & areas are read-only).
  bool _techInitialized = false;
  int? _yearsOfExperience;

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _jobTitleCtrl.dispose();
    super.dispose();
  }

  void _init(dynamic user) {
    if (_initialized) return;
    _nameCtrl    = TextEditingController(text: user.fullName as String);
    _emailCtrl   = TextEditingController(text: (user.email as String?) ?? '');
    _jobTitleCtrl =
        TextEditingController(text: (user.jobTitle as String?) ?? '');
    _initialized = true;
  }

  void _initTechnician(dynamic fullProfile) {
    if (_techInitialized) return;
    _yearsOfExperience = fullProfile.yearsOfExperience as int?;
    _techInitialized = true;
  }

  Future<void> _pickPhoto() async {
    final source = await showModalBottomSheet<ImageSource>(
      context: context,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const SizedBox(height: 8),
            Container(
              width: 40, height: 4,
              decoration: BoxDecoration(
                color: Colors.grey[300],
                borderRadius: BorderRadius.circular(2),
              ),
            ),
            const SizedBox(height: 12),
            ListTile(
              leading: const Icon(Icons.camera_alt_rounded, color: AppColors.gold),
              title: const Text('التقاط صورة'),
              onTap: () => Navigator.pop(ctx, ImageSource.camera),
            ),
            ListTile(
              leading: const Icon(Icons.photo_library_rounded, color: AppColors.gold),
              title: const Text('اختيار من المعرض'),
              onTap: () => Navigator.pop(ctx, ImageSource.gallery),
            ),
            const SizedBox(height: 12),
          ],
        ),
      ),
    );

    if (source == null) return;

    final picker = ImagePicker();
    final picked = await picker.pickImage(
        source: source, imageQuality: 85, maxWidth: 1200);
    if (picked == null || !mounted) return;

    setState(() => _errorMessage = null);
    await ref.read(profileProvider.notifier).uploadAndSetPhoto(picked.path);

    if (mounted) {
      final state = ref.read(profileProvider);
      if (state.hasError) {
        setState(() => _errorMessage =
            state.error.toString().replaceFirst('Exception: ', ''));
      }
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _saving = true; _errorMessage = null; });

    final user = ref.read(profileProvider).asData?.value;
    if (user == null) return;

    final newName     = _nameCtrl.text.trim();
    final newEmail    = _emailCtrl.text.trim();
    final newJobTitle = _jobTitleCtrl.text.trim();
    final isTechnician = user.role == 'technician';

    try {
      await ref.read(profileProvider.notifier).updateProfile(
            fullName:          newName.isNotEmpty ? newName : null,
            email:             newEmail.isNotEmpty ? newEmail : null,
            jobTitle:          newJobTitle.isNotEmpty ? newJobTitle : null,
            // Services and areas are NOT sent for technicians — they must go
            // through the service-modification-request flow instead.
            yearsOfExperience: isTechnician ? _yearsOfExperience : null,
          );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content:          Text('تم تحديث الملف الشخصي بنجاح'),
            backgroundColor:  AppColors.gold,
            behavior:         SnackBarBehavior.floating,
          ),
        );
        Navigator.of(context).pop();
      }
    } catch (e) {
      setState(
          () => _errorMessage = e.toString().replaceFirst('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark       = Theme.of(context).brightness == Brightness.dark;
    final profileAsync = ref.watch(profileProvider);

    return profileAsync.when(
      loading: () => const Scaffold(
        body: Center(child: CircularProgressIndicator(color: AppColors.gold)),
      ),
      error: (e, _) => Scaffold(
        appBar: AppBar(title: const Text('تعديل الملف الشخصي')),
        body: Center(
          child: Text(e.toString().replaceFirst('Exception: ', '')),
        ),
      ),
      data: (user) {
        _init(user);
        final isTechnician = user.role == 'technician';

        return Scaffold(
          appBar: AppBar(
            title: const Text('تعديل الملف الشخصي'),
            centerTitle: true,
            actions: [
              if (_saving)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Center(
                    child: SizedBox(
                      width: 20, height: 20,
                      child: CircularProgressIndicator(
                          color: AppColors.gold, strokeWidth: 2),
                    ),
                  ),
                )
              else
                TextButton(
                  onPressed: _save,
                  child: const Text(
                    'حفظ',
                    style: TextStyle(
                        color: AppColors.gold, fontWeight: FontWeight.w700),
                  ),
                ),
            ],
          ),
          body: SingleChildScrollView(
            padding: const EdgeInsets.fromLTRB(24, 24, 24, 40),
            child: Form(
              key: _formKey,
              child: Column(
                children: [
                  // ── Avatar picker ─────────────────────────────────────
                  GestureDetector(
                    onTap: _saving ? null : _pickPhoto,
                    child: Stack(
                      children: [
                        Hero(
                          tag: 'profile-avatar',
                          child: Container(
                            width: 100, height: 100,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              border: Border.all(color: AppColors.gold, width: 3),
                              color: AppColors.gold.withValues(alpha: 0.12),
                            ),
                            child: ClipOval(
                              child: user.profileImage?.isNotEmpty == true
                                  ? CachedNetworkImage(
                                      imageUrl: user.profileImage!,
                                      fit: BoxFit.cover,
                                      errorWidget: (_, __, ___) =>
                                          const Icon(Icons.person_rounded,
                                              color: AppColors.gold, size: 48),
                                    )
                                  : const Icon(Icons.person_rounded,
                                      color: AppColors.gold, size: 48),
                            ),
                          ),
                        ),
                        Positioned(
                          bottom: 2, left: 2,
                          child: Container(
                            padding: const EdgeInsets.all(6),
                            decoration: BoxDecoration(
                              color: AppColors.gold,
                              shape: BoxShape.circle,
                              border: Border.all(
                                color: isDark
                                    ? AppColors.darkBackground
                                    : Colors.white,
                                width: 2,
                              ),
                            ),
                            child: const Icon(Icons.camera_alt_rounded,
                                color: Colors.white, size: 14),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'اضغط لتغيير الصورة',
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark
                          ? AppColors.darkMutedForeground
                          : AppColors.lightMutedForeground,
                    ),
                  ),

                  const SizedBox(height: 32),

                  // ── Error banner ──────────────────────────────────────
                  if (_errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color:        AppColors.destructive.withValues(alpha: 0.10),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                            color: AppColors.destructive.withValues(alpha: 0.40)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.error_outline_rounded,
                              color: AppColors.destructive, size: 18),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              _errorMessage!,
                              style: const TextStyle(
                                  color: AppColors.destructive, fontSize: 13),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],

                  // ── Name ─────────────────────────────────────────────
                  _Field(
                    controller: _nameCtrl,
                    label: 'الاسم الكامل',
                    icon:  Icons.person_rounded,
                    validator: (v) =>
                        (v == null || v.trim().isEmpty)
                            ? 'الاسم مطلوب'
                            : null,
                  ),
                  const SizedBox(height: 16),

                  // ── Email ─────────────────────────────────────────────
                  _Field(
                    controller: _emailCtrl,
                    label:       'البريد الإلكتروني (اختياري)',
                    icon:        Icons.email_rounded,
                    keyboardType: TextInputType.emailAddress,
                  ),
                  const SizedBox(height: 16),

                  // ── Job title ─────────────────────────────────────────
                  _Field(
                    controller: _jobTitleCtrl,
                    label: 'المسمى الوظيفي (اختياري)',
                    icon:  Icons.work_rounded,
                  ),

                  // ── Technician-only extras ────────────────────────────
                  if (isTechnician) ...[
                    const SizedBox(height: 28),
                    _TechnicianExtras(
                      userId:            user.id,
                      yearsOfExperience: _yearsOfExperience,
                      isDark:            isDark,
                      onInitialized:     _initTechnician,
                      onYearsChanged:    (v) =>
                          setState(() => _yearsOfExperience = v),
                    ),
                  ],

                  const SizedBox(height: 32),

                  // ── Save button ───────────────────────────────────────
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: _saving ? null : _save,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.gold,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(14),
                        ),
                      ),
                      child: _saving
                          ? const SizedBox(
                              width: 22, height: 22,
                              child: CircularProgressIndicator(
                                  color: Colors.white, strokeWidth: 2.5),
                            )
                          : const Text(
                              'حفظ التغييرات',
                              style: TextStyle(
                                  fontWeight: FontWeight.w700, fontSize: 16),
                            ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

// ── Technician-only extras section ────────────────────────────────────────────

/// Shows for technicians only:
///   1. Years of experience selector (editable).
///   2. Current services (read-only display).
///   3. A button to submit a service-modification request.
///
/// Technicians CANNOT directly edit their registered services or coverage areas
/// (business rule).  Any change must go through the admin-reviewed
/// modification-request flow at [RoutePaths.techServiceModification].
class _TechnicianExtras extends ConsumerWidget {
  const _TechnicianExtras({
    required this.userId,
    required this.yearsOfExperience,
    required this.isDark,
    required this.onInitialized,
    required this.onYearsChanged,
  });

  final int                   userId;
  final int?                  yearsOfExperience;
  final bool                  isDark;
  final ValueChanged<dynamic> onInitialized;
  final ValueChanged<int>     onYearsChanged;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fullProfileAsync = ref.watch(technicianFullProfileProvider(userId));

    return fullProfileAsync.when(
      loading: () => const Padding(
        padding: EdgeInsets.symmetric(vertical: 24),
        child: Center(
          child: CircularProgressIndicator(color: AppColors.gold),
        ),
      ),
      error: (_, __) => const Padding(
        padding: EdgeInsets.symmetric(vertical: 8),
        child: Text(
          'تعذر تحميل بيانات الفني',
          style: TextStyle(color: AppColors.destructive, fontSize: 13),
        ),
      ),
      data: (full) {
        WidgetsBinding.instance.addPostFrameCallback(
            (_) => onInitialized(full));

        return Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Years of experience (editable) ───────────────────────
            _Label('سنوات الخبرة', isDark: isDark),
            const SizedBox(height: 10),
            ExperienceSelector(
              selectedYears: yearsOfExperience,
              onChanged:     onYearsChanged,
            ),

            const SizedBox(height: 28),

            // ── Current services (read-only) ─────────────────────────
            _Label('الخدمات المسجّلة حالياً', isDark: isDark),
            const SizedBox(height: 10),
            _ReadOnlyServicesCard(profile: full, isDark: isDark),

            const SizedBox(height: 16),

            // ── Modification request button ───────────────────────────
            _ModificationRequestBanner(isDark: isDark),
          ],
        );
      },
    );
  }
}

// ── Read-only services card ───────────────────────────────────────────────────

class _ReadOnlyServicesCard extends StatelessWidget {
  const _ReadOnlyServicesCard({required this.profile, required this.isDark});
  final dynamic profile;
  final bool    isDark;

  @override
  Widget build(BuildContext context) {
    final services = profile.services as List;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isDark ? AppColors.darkCard : AppColors.lightCard,
        borderRadius: BorderRadius.circular(AppDesign.radiusMD),
        border: Border.all(
          color: isDark ? AppColors.darkBorder : AppColors.lightBorder,
        ),
      ),
      child: services.isEmpty
          ? Text(
              'لم يتم تسجيل خدمات بعد',
              style: TextStyle(
                fontSize: 13,
                color: isDark
                    ? AppColors.darkMutedForeground
                    : AppColors.lightMutedForeground,
              ),
            )
          : Wrap(
              spacing: 8,
              runSpacing: 8,
              children: services.map((s) {
                return Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 12, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppColors.gold.withValues(alpha: 0.12),
                    borderRadius:
                        BorderRadius.circular(AppDesign.radiusFull),
                    border: Border.all(
                        color: AppColors.gold.withValues(alpha: 0.35)),
                  ),
                  child: Text(
                    s.nameAr as String,
                    style: const TextStyle(
                      color: AppColors.gold,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                );
              }).toList(),
            ),
    );
  }
}

// ── Modification request banner ───────────────────────────────────────────────

class _ModificationRequestBanner extends StatelessWidget {
  const _ModificationRequestBanner({required this.isDark});
  final bool isDark;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: () => context.push(RoutePaths.techServiceModification),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: isDark
              ? AppColors.darkCard
              : const Color(0xFFF0F9FF),
          borderRadius: BorderRadius.circular(AppDesign.radiusMD),
          border: Border.all(
            color: const Color(0xFF3B82F6).withValues(alpha: 0.35),
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: const Color(0xFF3B82F6).withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.edit_note_rounded,
                  color: Color(0xFF3B82F6), size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'تعديل الخدمات أو المناطق',
                    style: TextStyle(
                      fontWeight: FontWeight.w700,
                      fontSize: 13.5,
                      color: Color(0xFF3B82F6),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'لا يمكن تعديل الخدمات أو مناطق التغطية مباشرةً. '
                    'اضغط هنا لإرسال طلب تعديل للمراجعة.',
                    style: TextStyle(
                      fontSize: 11.5,
                      color: isDark
                          ? AppColors.darkMutedForeground
                          : const Color(0xFF64748B),
                      height: 1.45,
                    ),
                  ),
                ],
              ),
            ),
            const Icon(Icons.chevron_left_rounded,
                color: Color(0xFF3B82F6), size: 20),
          ],
        ),
      ),
    );
  }
}

// ── Form field helper ─────────────────────────────────────────────────────────

class _Field extends StatelessWidget {
  const _Field({
    required this.controller,
    required this.label,
    required this.icon,
    this.keyboardType,
    this.validator,
  });

  final TextEditingController        controller;
  final String                       label;
  final IconData                     icon;
  final TextInputType?               keyboardType;
  final String? Function(String?)?   validator;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller:   controller,
      keyboardType: keyboardType,
      validator:    validator,
      decoration: InputDecoration(
        labelText:  label,
        prefixIcon: Icon(icon, color: AppColors.gold),
      ),
    );
  }
}

// ── Label helper ──────────────────────────────────────────────────────────────

class _Label extends StatelessWidget {
  const _Label(this.text, {required this.isDark});
  final String text;
  final bool   isDark;

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontWeight: FontWeight.w700,
        fontSize:   14,
        color: isDark
            ? AppColors.darkMutedForeground
            : AppColors.lightMutedForeground,
      ),
    );
  }
}

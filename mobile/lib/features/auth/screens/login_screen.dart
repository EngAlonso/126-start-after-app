import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/branding/cms_provider.dart';
import '../../../core/branding/cms_settings.dart';
import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';
import '../../../utils/validators.dart';
import '../../../widgets/common/app_button.dart';
import '../../../widgets/common/app_text_field.dart';
import '../providers/auth_providers.dart';

/// Premium login screen — full custom layout with branded header,
/// form with Enter-key focus chaining, and "remember me" toggle.
///
/// Auth logic is unchanged from the original — only the visual layer and
/// keyboard UX are improved.
class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  final _formKey          = GlobalKey<FormState>();
  final _mobileController = TextEditingController();
  final _passwordController = TextEditingController();
  final _passwordFocus    = FocusNode();
  bool _rememberMe = true;
  bool _prefilled  = false;

  // ── Entrance animation ──────────────────────────────────────────────────────
  late final AnimationController _animCtrl;
  late final Animation<double>   _headerSlide;
  late final Animation<double>   _formFade;

  @override
  void initState() {
    super.initState();
    _animCtrl = AnimationController(
      vsync:    this,
      duration: const Duration(milliseconds: 700),
    )..forward();
    _headerSlide = Tween<double>(begin: -24, end: 0).animate(
      CurvedAnimation(
        parent: _animCtrl,
        curve:  const Interval(0.0, 0.55, curve: Curves.easeOut),
      ),
    );
    _formFade = CurvedAnimation(
      parent: _animCtrl,
      curve:  const Interval(0.30, 1.0, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _mobileController.dispose();
    _passwordController.dispose();
    _passwordFocus.dispose();
    _animCtrl.dispose();
    super.dispose();
  }

  Future<void> _prefillRememberedMobile() async {
    if (_prefilled) return;
    _prefilled = true;
    final mobile = await ref.read(authRepositoryProvider).getRememberedMobile();
    if (mobile != null && mounted) {
      setState(() => _mobileController.text = mobile);
    }
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    ref.read(authControllerProvider.notifier).login(
          mobile:     _mobileController.text.trim(),
          password:   _passwordController.text,
          rememberMe: _rememberMe,
        );
  }

  @override
  Widget build(BuildContext context) {
    _prefillRememberedMobile();

    final authState    = ref.watch(authControllerProvider);
    final isLoading    = authState.isLoading;
    final currentState = authState.asData?.value;
    final errorMessage = currentState is Unauthenticated ? currentState.errorMessage : null;
    final isDark       = Theme.of(context).brightness == Brightness.dark;
    final size         = MediaQuery.sizeOf(context);

    return Scaffold(
      resizeToAvoidBottomInset: true,
      body: Stack(
        children: [
          // ── Branded header (top ~38 % of screen) ──────────────────────
          AnimatedBuilder(
            animation: _headerSlide,
            builder:   (_, child) => Transform.translate(
              offset: Offset(0, _headerSlide.value),
              child:  child,
            ),
            child: _LoginHeader(size: size, isDark: isDark),
          ),

          // ── Scrollable form card ───────────────────────────────────────
          FadeTransition(
            opacity: _formFade,
            child: SingleChildScrollView(
              padding: EdgeInsets.only(
                bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
              ),
              child: Column(
                children: [
                  // Push form below the header area
                  SizedBox(height: size.height * 0.35 - 24),

                  // Form card — overlaps the header slightly
                  Container(
                    margin: const EdgeInsets.symmetric(horizontal: 16),
                    padding: const EdgeInsets.fromLTRB(
                      AppDesign.spaceXL,
                      AppDesign.spaceXL,
                      AppDesign.spaceXL,
                      AppDesign.spaceLG,
                    ),
                    decoration: BoxDecoration(
                      color: isDark ? AppColors.darkCard : AppColors.lightCard,
                      borderRadius: BorderRadius.circular(AppDesign.radiusXXL),
                      boxShadow: AppDesign.cardShadow(isDark: isDark),
                    ),
                    child: Form(
                      key:              _formKey,
                      autovalidateMode: AutovalidateMode.onUserInteraction,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Section title
                          const Text(
                            'تسجيل الدخول',
                            style: TextStyle(
                              fontSize:   22,
                              fontWeight: FontWeight.w800,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Text(
                            'مرحباً بعودتك! سجّل دخولك لمتابعة طلباتك',
                            style: TextStyle(
                              fontSize: 13,
                              color:    Theme.of(context).colorScheme.onSurfaceVariant,
                            ),
                          ),
                          const SizedBox(height: 24),

                          // Phone field — Enter moves to password
                          AppTextField(
                            label:           'رقم الهاتف',
                            controller:      _mobileController,
                            keyboardType:    TextInputType.phone,
                            textInputAction: TextInputAction.next,
                            prefixIcon:      Icons.phone_outlined,
                            autofillHints:   const [AutofillHints.telephoneNumber],
                            validator:       Validators.mobile,
                            onEditingComplete: () =>
                                FocusScope.of(context).requestFocus(_passwordFocus),
                          ),
                          const SizedBox(height: 14),

                          // Password field — Enter submits
                          AppPasswordField(
                            label:           'كلمة المرور',
                            controller:      _passwordController,
                            focusNode:       _passwordFocus,
                            textInputAction: TextInputAction.done,
                            autofillHints:   const [AutofillHints.password],
                            validator:       Validators.loginPassword,
                            onEditingComplete: _submit,
                          ),
                          const SizedBox(height: 4),

                          // Remember me
                          Row(
                            children: [
                              SizedBox(
                                width:  24,
                                height: 24,
                                child: Checkbox(
                                  value:      _rememberMe,
                                  onChanged:  (v) =>
                                      setState(() => _rememberMe = v ?? true),
                                  shape: RoundedRectangleBorder(
                                    borderRadius: BorderRadius.circular(5),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              const Text('تذكرني', style: TextStyle(fontSize: 13)),
                            ],
                          ),

                          // Error
                          if (errorMessage != null) ...[
                            const SizedBox(height: 12),
                            _ErrorBanner(message: errorMessage),
                          ],
                          const SizedBox(height: 18),

                          // Login button
                          AppButton(
                            label:     'دخول',
                            isLoading: isLoading,
                            icon:      Icons.arrow_back_ios_new_rounded,
                            onPressed: _submit,
                          ),

                          const SizedBox(height: AppDesign.spaceMD),

                          // Register link
                          Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'ليس لديك حساب؟',
                                style: TextStyle(
                                  fontSize: 13,
                                  color: Theme.of(context)
                                      .colorScheme
                                      .onSurfaceVariant,
                                ),
                              ),
                              TextButton(
                                onPressed: isLoading
                                    ? null
                                    : () => context.push(RoutePaths.registerChoice),
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 6, vertical: 4,
                                  ),
                                  minimumSize: Size.zero,
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                child: const Text(
                                  'إنشاء حساب جديد',
                                  style: TextStyle(fontWeight: FontWeight.w700),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // ── Back button ────────────────────────────────────────────────
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(AppDesign.spaceXS),
              child: IconButton(
                onPressed: () => context.canPop()
                    ? context.pop()
                    : context.go(RoutePaths.publicHome),
                icon: const Icon(Icons.arrow_forward_ios_rounded, size: 20),
                style: IconButton.styleFrom(
                  backgroundColor: Colors.white.withValues(alpha: 0.22),
                  foregroundColor: Colors.white,
                  padding:         const EdgeInsets.all(10),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Branded header ────────────────────────────────────────────────────────────

class _LoginHeader extends ConsumerWidget {
  const _LoginHeader({required this.size, required this.isDark});
  final Size size;
  final bool isDark;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final cms = ref.watch(cmsBrandingProvider).asData?.value
                ?? CmsSettings.defaults;

    return Container(
      width:  double.infinity,
      height: size.height * 0.38,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFFFFD700), Color(0xFFCF8F00)],
          begin:  Alignment.topLeft,
          end:    Alignment.bottomRight,
        ),
        borderRadius: const BorderRadius.vertical(
          bottom: Radius.circular(AppDesign.radiusXXL),
        ),
      ),
      child: SafeArea(
        bottom: false,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Logo mark — CMS image if set, else default icon
            Container(
              width:  92,
              height: 92,
              decoration: BoxDecoration(
                shape:     BoxShape.circle,
                color:     Colors.white.withValues(alpha: 0.22),
                boxShadow: [
                  BoxShadow(
                    color:      Colors.black.withValues(alpha: 0.15),
                    blurRadius: 24,
                    offset:     const Offset(0, 10),
                  ),
                ],
              ),
              child: cms.logoUrl != null
                  ? ClipOval(
                      child: Image.network(
                        cms.logoUrl!,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const Icon(
                          Icons.handyman_rounded,
                          size:  44,
                          color: Colors.white,
                        ),
                      ),
                    )
                  : const Icon(
                      Icons.handyman_rounded,
                      size:  44,
                      color: Colors.white,
                    ),
            ),
            const SizedBox(height: 14),
            Text(
              cms.appName,
              style: const TextStyle(
                fontSize:     32,
                fontWeight:   FontWeight.w900,
                color:        Colors.white,
                letterSpacing: -0.5,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              '#بضغطة_زرار',
              style: TextStyle(
                fontSize:   14,
                fontWeight: FontWeight.w600,
                color:      Colors.white.withValues(alpha: 0.80),
              ),
            ),
          ],
        ),
      ),
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
      width:   double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color:        AppColors.destructive.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(AppDesign.radiusSM),
        border: Border.all(
          color: AppColors.destructive.withValues(alpha: 0.30),
        ),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded,
              color: AppColors.destructive, size: 18),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(
                color:    AppColors.destructive,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

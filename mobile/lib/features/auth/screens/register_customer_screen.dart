import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../theme/app_colors.dart';
import '../../../utils/validators.dart';
import '../../../widgets/common/app_button.dart';
import '../../../widgets/common/app_text_field.dart';
import '../../../widgets/common/auth_shell.dart';
import '../providers/auth_providers.dart';

/// Customer registration — the backend logs the account in immediately
/// (returns tokens), so on success the router's redirect guard takes over
/// and lands the user on their home shell; there's no extra confirmation
/// step here (unlike technician registration).
class RegisterCustomerScreen extends ConsumerStatefulWidget {
  const RegisterCustomerScreen({super.key});

  @override
  ConsumerState<RegisterCustomerScreen> createState() => _RegisterCustomerScreenState();
}

class _RegisterCustomerScreenState extends ConsumerState<RegisterCustomerScreen> {
  final _formKey = GlobalKey<FormState>();
  final _fullNameController = TextEditingController();
  final _mobileController = TextEditingController();
  final _passwordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();
  final _referredByController = TextEditingController();

  @override
  void dispose() {
    _fullNameController.dispose();
    _mobileController.dispose();
    _passwordController.dispose();
    _confirmPasswordController.dispose();
    _referredByController.dispose();
    super.dispose();
  }

  void _submit() {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    FocusScope.of(context).unfocus();
    ref.read(authControllerProvider.notifier).registerCustomer(
          fullName: _fullNameController.text.trim(),
          mobile: _mobileController.text.trim(),
          password: _passwordController.text,
          referredBy: _referredByController.text.trim().isEmpty
              ? null
              : _referredByController.text.trim().toUpperCase(),
        );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authControllerProvider);
    final isLoading = authState.isLoading;
    final currentState = authState.asData?.value;
    final errorMessage = currentState is Unauthenticated ? currentState.errorMessage : null;

    return AuthShell(
      showBackButton: true,
      child: Form(
        key: _formKey,
        autovalidateMode: AutovalidateMode.onUserInteraction,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text(
              'حساب عميل جديد',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 24),
            AppTextField(
              label: 'الاسم الكامل',
              controller: _fullNameController,
              prefixIcon: Icons.person_outline,
              textInputAction: TextInputAction.next,
              validator: Validators.fullName,
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: 'رقم الهاتف',
              controller: _mobileController,
              keyboardType: TextInputType.phone,
              prefixIcon: Icons.phone_outlined,
              textInputAction: TextInputAction.next,
              validator: Validators.mobile,
            ),
            const SizedBox(height: 14),
            AppPasswordField(
              label: 'كلمة المرور',
              controller: _passwordController,
              textInputAction: TextInputAction.next,
              validator: Validators.password,
            ),
            const SizedBox(height: 14),
            AppPasswordField(
              label: 'تأكيد كلمة المرور',
              controller: _confirmPasswordController,
              textInputAction: TextInputAction.next,
              validator: Validators.confirmPassword(() => _passwordController.text),
            ),
            const SizedBox(height: 14),
            AppTextField(
              label: 'كود الإحالة (اختياري)',
              controller: _referredByController,
              prefixIcon: Icons.card_giftcard_outlined,
              textInputAction: TextInputAction.done,
            ),
            if (errorMessage != null) ...[
              const SizedBox(height: 12),
              Text(
                errorMessage,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.destructive, fontSize: 13),
              ),
            ],
            const SizedBox(height: 24),
            AppButton(label: 'إنشاء الحساب', isLoading: isLoading, onPressed: _submit),
          ],
        ),
      ),
    );
  }
}

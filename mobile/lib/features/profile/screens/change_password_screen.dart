import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../theme/app_colors.dart';
import '../providers/profile_provider.dart';

class ChangePasswordScreen extends ConsumerStatefulWidget {
  const ChangePasswordScreen({super.key});

  @override
  ConsumerState<ChangePasswordScreen> createState() =>
      _ChangePasswordScreenState();
}

class _ChangePasswordScreenState extends ConsumerState<ChangePasswordScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentCtrl = TextEditingController();
  final _newCtrl = TextEditingController();
  final _confirmCtrl = TextEditingController();

  bool _showCurrent = false;
  bool _showNew = false;
  bool _showConfirm = false;
  bool _saving = false;
  bool _success = false;
  String? _error;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _newCtrl.dispose();
    _confirmCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await ref.read(profileProvider.notifier).changePassword(
            currentPassword: _currentCtrl.text,
            newPassword: _newCtrl.text,
          );
      if (mounted) {
        setState(() {
          _success = true;
          _saving = false;
        });
        // Auto-pop after brief success display
        await Future.delayed(const Duration(seconds: 2));
        if (mounted) Navigator.of(context).pop();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _error = e.toString().replaceFirst('Exception: ', '');
          _saving = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(title: const Text('تغيير كلمة المرور')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 32, 24, 40),
        child: _success ? _SuccessView() : _FormView(
          formKey: _formKey,
          currentCtrl: _currentCtrl,
          newCtrl: _newCtrl,
          confirmCtrl: _confirmCtrl,
          showCurrent: _showCurrent,
          showNew: _showNew,
          showConfirm: _showConfirm,
          onToggleCurrent: () =>
              setState(() => _showCurrent = !_showCurrent),
          onToggleNew: () => setState(() => _showNew = !_showNew),
          onToggleConfirm: () =>
              setState(() => _showConfirm = !_showConfirm),
          saving: _saving,
          error: _error,
          isDark: isDark,
          onSubmit: _submit,
        ),
      ),
    );
  }
}

// ─── Form view ────────────────────────────────────────────────────────────────

class _FormView extends StatelessWidget {
  const _FormView({
    required this.formKey,
    required this.currentCtrl,
    required this.newCtrl,
    required this.confirmCtrl,
    required this.showCurrent,
    required this.showNew,
    required this.showConfirm,
    required this.onToggleCurrent,
    required this.onToggleNew,
    required this.onToggleConfirm,
    required this.saving,
    required this.error,
    required this.isDark,
    required this.onSubmit,
  });

  final GlobalKey<FormState> formKey;
  final TextEditingController currentCtrl;
  final TextEditingController newCtrl;
  final TextEditingController confirmCtrl;
  final bool showCurrent;
  final bool showNew;
  final bool showConfirm;
  final VoidCallback onToggleCurrent;
  final VoidCallback onToggleNew;
  final VoidCallback onToggleConfirm;
  final bool saving;
  final String? error;
  final bool isDark;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return Form(
      key: formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Icon + intro
          const Center(
            child: Icon(Icons.lock_reset_rounded,
                color: AppColors.gold, size: 56),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(
              'أدخل كلمة المرور الحالية ثم اختر كلمة مرور جديدة قوية',
              style: TextStyle(
                color: isDark
                    ? AppColors.darkMutedForeground
                    : AppColors.lightMutedForeground,
                fontSize: 13,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 32),

          // Error
          if (error != null) ...[
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFFEF4444).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                    color: const Color(0xFFEF4444).withValues(alpha: 0.4)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline_rounded,
                      color: Color(0xFFEF4444), size: 18),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      error!,
                      style: const TextStyle(
                          color: Color(0xFFEF4444), fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          // Current password
          _PasswordField(
            controller: currentCtrl,
            label: 'كلمة المرور الحالية',
            obscure: !showCurrent,
            onToggle: onToggleCurrent,
            validator: (v) =>
                (v == null || v.isEmpty) ? 'هذا الحقل مطلوب' : null,
          ),
          const SizedBox(height: 16),

          // New password
          _PasswordField(
            controller: newCtrl,
            label: 'كلمة المرور الجديدة',
            obscure: !showNew,
            onToggle: onToggleNew,
            validator: (v) {
              if (v == null || v.isEmpty) return 'هذا الحقل مطلوب';
              if (v.length < 8) return 'يجب أن تكون 8 أحرف على الأقل';
              return null;
            },
          ),
          const SizedBox(height: 16),

          // Confirm password
          _PasswordField(
            controller: confirmCtrl,
            label: 'تأكيد كلمة المرور الجديدة',
            obscure: !showConfirm,
            onToggle: onToggleConfirm,
            validator: (v) {
              if (v == null || v.isEmpty) return 'هذا الحقل مطلوب';
              if (v != newCtrl.text) return 'كلمتا المرور غير متطابقتين';
              return null;
            },
          ),
          const SizedBox(height: 32),

          // Submit
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: saving ? null : onSubmit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.gold,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              child: saving
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2.5),
                    )
                  : const Text(
                      'تغيير كلمة المرور',
                      style: TextStyle(
                          fontWeight: FontWeight.w700, fontSize: 16),
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Success view ─────────────────────────────────────────────────────────────

class _SuccessView extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const SizedBox(height: 40),
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFF22C55E).withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.check_circle_rounded,
                color: Color(0xFF22C55E), size: 64),
          ),
          const SizedBox(height: 24),
          const Text(
            'تم تغيير كلمة المرور بنجاح',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 8),
          Text(
            'سيتم إعادة توجيهك تلقائياً',
            style: TextStyle(
              color: Theme.of(context).brightness == Brightness.dark
                  ? AppColors.darkMutedForeground
                  : AppColors.lightMutedForeground,
            ),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ─── Password field ───────────────────────────────────────────────────────────

class _PasswordField extends StatelessWidget {
  const _PasswordField({
    required this.controller,
    required this.label,
    required this.obscure,
    required this.onToggle,
    this.validator,
  });

  final TextEditingController controller;
  final String label;
  final bool obscure;
  final VoidCallback onToggle;
  final String? Function(String?)? validator;

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      obscureText: obscure,
      validator: validator,
      decoration: InputDecoration(
        labelText: label,
        prefixIcon: const Icon(Icons.lock_rounded, color: AppColors.gold),
        suffixIcon: IconButton(
          icon: Icon(
            obscure ? Icons.visibility_rounded : Icons.visibility_off_rounded,
            color: AppColors.gold,
          ),
          onPressed: onToggle,
        ),
      ),
    );
  }
}

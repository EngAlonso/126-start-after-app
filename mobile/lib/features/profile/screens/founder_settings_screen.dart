import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../theme/app_colors.dart';
import '../providers/profile_provider.dart';

/// Founder-only screen: change password and/or phone number via
/// PATCH /api/founder/settings. Both are optional but currentPassword
/// is always required. Completely hidden from non-founder accounts
/// (the route is only added to the settings tile when isFounder == true).
class FounderSettingsScreen extends ConsumerStatefulWidget {
  const FounderSettingsScreen({super.key});

  @override
  ConsumerState<FounderSettingsScreen> createState() =>
      _FounderSettingsScreenState();
}

class _FounderSettingsScreenState
    extends ConsumerState<FounderSettingsScreen> {
  final _formKey = GlobalKey<FormState>();
  final _currentCtrl = TextEditingController();
  final _newPassCtrl = TextEditingController();
  final _confirmPassCtrl = TextEditingController();
  final _newPhoneCtrl = TextEditingController();

  bool _showCurrent = false;
  bool _showNew = false;
  bool _showConfirm = false;
  bool _saving = false;
  bool _success = false;
  String? _error;

  @override
  void dispose() {
    _currentCtrl.dispose();
    _newPassCtrl.dispose();
    _confirmPassCtrl.dispose();
    _newPhoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;

    final hasNewPass = _newPassCtrl.text.isNotEmpty;
    final hasNewPhone = _newPhoneCtrl.text.trim().isNotEmpty;

    if (!hasNewPass && !hasNewPhone) {
      setState(() => _error =
          'أدخل كلمة مرور جديدة أو رقم هاتف جديد على الأقل');
      return;
    }

    setState(() {
      _saving = true;
      _error = null;
    });

    try {
      await ref.read(profileServiceProvider).updateFounderSettings(
            currentPassword: _currentCtrl.text,
            newPassword: hasNewPass ? _newPassCtrl.text : null,
            newPhone: hasNewPhone ? _newPhoneCtrl.text.trim() : null,
          );
      if (mounted) {
        setState(() {
          _success = true;
          _saving = false;
        });
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
      appBar: AppBar(
        title: const Text('إعدادات المؤسس'),
        actions: [
          Container(
            margin: const EdgeInsets.only(left: 16),
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.gold.withValues(alpha: 0.18),
              borderRadius: BorderRadius.circular(8),
            ),
            child: const Text(
              'مؤسس',
              style: TextStyle(
                color: AppColors.gold,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(24, 32, 24, 40),
        child: _success ? _SuccessView() : _buildForm(isDark),
      ),
    );
  }

  Widget _buildForm(bool isDark) {
    return Form(
      key: _formKey,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Intro
          Center(
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.gold.withValues(alpha: 0.12),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.admin_panel_settings_rounded,
                  color: AppColors.gold, size: 40),
            ),
          ),
          const SizedBox(height: 16),
          Center(
            child: Text(
              'يمكنك تغيير كلمة المرور أو رقم الهاتف أو كليهما معاً.\nكلمة المرور الحالية مطلوبة دائماً.',
              style: TextStyle(
                color: isDark
                    ? AppColors.darkMutedForeground
                    : AppColors.lightMutedForeground,
                fontSize: 13,
                height: 1.6,
              ),
              textAlign: TextAlign.center,
            ),
          ),
          const SizedBox(height: 32),

          // Error
          if (_error != null) ...[
            _ErrorBanner(message: _error!),
            const SizedBox(height: 20),
          ],

          // ── Required: current password ────────────────────────────────
          _SectionLabel('التحقق من الهوية'),
          const SizedBox(height: 12),
          _PasswordField(
            controller: _currentCtrl,
            label: 'كلمة المرور الحالية',
            obscure: !_showCurrent,
            onToggle: () => setState(() => _showCurrent = !_showCurrent),
            validator: (v) =>
                (v == null || v.isEmpty) ? 'هذا الحقل مطلوب' : null,
          ),

          const SizedBox(height: 28),

          // ── Optional: new password ────────────────────────────────────
          _SectionLabel('تغيير كلمة المرور (اختياري)'),
          const SizedBox(height: 12),
          _PasswordField(
            controller: _newPassCtrl,
            label: 'كلمة المرور الجديدة',
            obscure: !_showNew,
            onToggle: () => setState(() => _showNew = !_showNew),
            validator: (v) {
              if (v == null || v.isEmpty) return null; // optional
              if (v.length < 8) return 'يجب أن تكون 8 أحرف على الأقل';
              return null;
            },
          ),
          const SizedBox(height: 12),
          _PasswordField(
            controller: _confirmPassCtrl,
            label: 'تأكيد كلمة المرور الجديدة',
            obscure: !_showConfirm,
            onToggle: () =>
                setState(() => _showConfirm = !_showConfirm),
            validator: (v) {
              if (_newPassCtrl.text.isEmpty) return null; // optional
              if (v != _newPassCtrl.text) {
                return 'كلمتا المرور غير متطابقتين';
              }
              return null;
            },
          ),

          const SizedBox(height: 28),

          // ── Optional: new phone ───────────────────────────────────────
          _SectionLabel('تغيير رقم الهاتف (اختياري)'),
          const SizedBox(height: 12),
          TextFormField(
            controller: _newPhoneCtrl,
            keyboardType: TextInputType.phone,
            decoration: const InputDecoration(
              labelText: 'رقم الهاتف الجديد',
              prefixIcon:
                  Icon(Icons.phone_rounded, color: AppColors.gold),
            ),
            validator: (v) {
              if (v == null || v.trim().isEmpty) return null; // optional
              if (v.trim().length < 10) return 'رقم الهاتف غير صحيح';
              return null;
            },
          ),

          const SizedBox(height: 36),

          // ── Submit ────────────────────────────────────────────────────
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: _saving ? null : _submit,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.gold,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
              child: _saving
                  ? const SizedBox(
                      width: 22,
                      height: 22,
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
    );
  }
}

// ─── Success ──────────────────────────────────────────────────────────────────

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
            'تم حفظ الإعدادات بنجاح',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
            textAlign: TextAlign.center,
          ),
        ],
      ),
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  const _SectionLabel(this.text);
  final String text;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Text(
      text,
      style: TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w700,
        color: isDark
            ? AppColors.darkMutedForeground
            : AppColors.lightMutedForeground,
        letterSpacing: 0.4,
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
        color: const Color(0xFFEF4444).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(12),
        border:
            Border.all(color: const Color(0xFFEF4444).withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded,
              color: Color(0xFFEF4444), size: 18),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              message,
              style: const TextStyle(color: Color(0xFFEF4444), fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }
}

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
            obscure
                ? Icons.visibility_rounded
                : Icons.visibility_off_rounded,
            color: AppColors.gold,
          ),
          onPressed: onToggle,
        ),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../features/auth/providers/auth_providers.dart';
import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';

/// Simple support-ticket submission screen.
///
/// Calls POST /api/support/tickets with {subject, message}.
/// On success shows a confirmation dialog and pops back.
class SupportTicketScreen extends ConsumerStatefulWidget {
  const SupportTicketScreen({super.key});

  @override
  ConsumerState<SupportTicketScreen> createState() =>
      _SupportTicketScreenState();
}

class _SupportTicketScreenState extends ConsumerState<SupportTicketScreen> {
  final _formKey       = GlobalKey<FormState>();
  final _subjectCtrl   = TextEditingController();
  final _messageCtrl   = TextEditingController();
  bool  _isSubmitting  = false;

  @override
  void dispose() {
    _subjectCtrl.dispose();
    _messageCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!(_formKey.currentState?.validate() ?? false)) return;
    setState(() => _isSubmitting = true);

    try {
      final dio = ref.read(dioClientProvider).dio;
      await dio.post<void>(
        '/support/tickets',
        data: {
          'subject': _subjectCtrl.text.trim(),
          'message': _messageCtrl.text.trim(),
        },
      );

      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppDesign.radiusLG),
          ),
          title: const Row(
            children: [
              Icon(Icons.check_circle_rounded, color: AppColors.gold),
              SizedBox(width: 10),
              Text('تم الإرسال', style: TextStyle(fontWeight: FontWeight.w800)),
            ],
          ),
          content: const Text(
            'تم إرسال تذكرة الدعم بنجاح.\nسيقوم فريقنا بالرد عليك في أقرب وقت ممكن.',
            textAlign: TextAlign.right,
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(ctx).pop(),
              child: const Text(
                'حسناً',
                style: TextStyle(
                    color: AppColors.gold, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      );

      if (mounted) context.pop();
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            e.toString().replaceFirst('Exception: ', ''),
          ),
          backgroundColor: AppColors.destructive,
          behavior: SnackBarBehavior.floating,
        ),
      );
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.lightBackground,
      appBar: AppBar(
        backgroundColor: isDark ? AppColors.darkCard : AppColors.lightCard,
        elevation: 0,
        centerTitle: true,
        title: const Text(
          'فتح تذكرة دعم',
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 17),
        ),
        leading: BackButton(onPressed: () => context.pop()),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            // ── Info card ────────────────────────────────────────────────
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.gold.withValues(alpha: 0.10),
                borderRadius: BorderRadius.circular(AppDesign.radiusMD),
                border: Border.all(
                    color: AppColors.gold.withValues(alpha: 0.30)),
              ),
              child: const Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(Icons.info_outline_rounded,
                      color: AppColors.gold, size: 20),
                  SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      'يرجى وصف مشكلتك بالتفصيل حتى يتمكن فريق الدعم من مساعدتك بشكل أسرع.',
                      style: TextStyle(fontSize: 13, height: 1.5),
                    ),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 24),

            // ── Subject ──────────────────────────────────────────────────
            _buildLabel('موضوع التذكرة', isDark),
            const SizedBox(height: 8),
            TextFormField(
              controller: _subjectCtrl,
              textAlign:  TextAlign.right,
              decoration: _inputDec(
                hint:   'مثال: مشكلة في تسجيل الدخول',
                isDark: isDark,
              ),
              validator: (v) => (v == null || v.trim().isEmpty)
                  ? 'الرجاء إدخال موضوع التذكرة'
                  : null,
            ),

            const SizedBox(height: 20),

            // ── Message ──────────────────────────────────────────────────
            _buildLabel('تفاصيل المشكلة', isDark),
            const SizedBox(height: 8),
            TextFormField(
              controller: _messageCtrl,
              textAlign:  TextAlign.right,
              maxLines:   5,
              decoration: _inputDec(
                hint:   'اشرح مشكلتك بالتفصيل...',
                isDark: isDark,
              ),
              validator: (v) => (v == null || v.trim().length < 10)
                  ? 'الرجاء كتابة رسالة مفصّلة (١٠ أحرف على الأقل)'
                  : null,
            ),

            const SizedBox(height: 32),

            // ── Submit ───────────────────────────────────────────────────
            SizedBox(
              height: 54,
              child: ElevatedButton(
                onPressed: _isSubmitting ? null : _submit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.gold,
                  foregroundColor: Colors.white,
                  disabledBackgroundColor:
                      AppColors.gold.withValues(alpha: 0.5),
                  shape: RoundedRectangleBorder(
                    borderRadius:
                        BorderRadius.circular(AppDesign.radiusMD),
                  ),
                  elevation: 0,
                ),
                child: _isSubmitting
                    ? const SizedBox(
                        width: 22,
                        height: 22,
                        child: CircularProgressIndicator(
                            color: Colors.white, strokeWidth: 2.5),
                      )
                    : const Text(
                        'إرسال التذكرة',
                        style: TextStyle(
                            fontSize: 16, fontWeight: FontWeight.w700),
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLabel(String text, bool isDark) => Text(
        text,
        style: TextStyle(
          fontSize:   13,
          fontWeight: FontWeight.w700,
          color: isDark
              ? AppColors.darkMutedForeground
              : AppColors.lightMutedForeground,
        ),
      );

  InputDecoration _inputDec({required String hint, required bool isDark}) {
    final fill   = isDark ? AppColors.darkCard : AppColors.lightCard;
    final border = isDark ? AppColors.darkBorder : AppColors.lightBorder;
    return InputDecoration(
      hintText:       hint,
      filled:         true,
      fillColor:      fill,
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppDesign.radiusMD),
        borderSide:   BorderSide(color: border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppDesign.radiusMD),
        borderSide:   BorderSide(color: border),
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
        borderSide:
            const BorderSide(color: AppColors.destructive, width: 1.5),
      ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/common/app_button.dart';
import '../../../widgets/common/auth_shell.dart';

/// Shown right after a successful technician registration. Technician
/// accounts start in `status: "pending"` on the backend and cannot log in
/// until an admin approves them (no tokens are issued at registration
/// time — see `AuthService.registerTechnician`), so this replaces the
/// usual "you're now logged in" outcome with an explicit wait-for-approval
/// message, matching the web app's own post-registration screen.
class TechnicianPendingScreen extends StatelessWidget {
  const TechnicianPendingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: false,
      child: AuthShell(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              width: 84,
              height: 84,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.gold.withValues(alpha: 0.15),
              ),
              child: const Icon(Icons.hourglass_top_rounded, color: AppColors.gold, size: 40),
            ),
            const SizedBox(height: 24),
            const Text(
              'تم إرسال طلبك بنجاح',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 10),
            Text(
              'حسابك كفني قيد المراجعة من قبل الإدارة، سيتم إعلامك فور الموافقة عليه ويمكنك حينها تسجيل الدخول.',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 14, color: Theme.of(context).colorScheme.onSurfaceVariant, height: 1.6),
            ),
            const SizedBox(height: 32),
            AppButton(
              label: 'العودة لتسجيل الدخول',
              onPressed: () => context.go(RoutePaths.login),
            ),
          ],
        ),
      ),
    );
  }
}

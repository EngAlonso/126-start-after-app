import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/common/auth_shell.dart';

/// Mirrors the web app's `/register` account-type chooser — the customer
/// and technician registration forms collect different fields (a
/// technician needs documents + service/area coverage), so the user picks
/// a track before either form appears.
class RegisterChoiceScreen extends StatelessWidget {
  const RegisterChoiceScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return AuthShell(
      showBackButton: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'إنشاء حساب جديد',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            'اختر نوع الحساب المناسب لك',
            textAlign: TextAlign.center,
            style: TextStyle(fontSize: 14, color: Theme.of(context).colorScheme.onSurfaceVariant),
          ),
          const SizedBox(height: 32),
          _AccountTypeCard(
            icon: Icons.person_outline,
            title: 'عميل',
            description: 'أطلب خدمات الصيانة والفنيين المتخصصين',
            onTap: () => context.push(RoutePaths.registerCustomer),
          ),
          const SizedBox(height: 16),
          _AccountTypeCard(
            icon: Icons.handyman_outlined,
            title: 'فني',
            description: 'قدّم خدماتك واستقبل طلبات العملاء',
            onTap: () => context.push(RoutePaths.registerTechnician),
          ),
        ],
      ),
    );
  }
}

class _AccountTypeCard extends StatelessWidget {
  const _AccountTypeCard({
    required this.icon,
    required this.title,
    required this.description,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String description;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: Theme.of(context).colorScheme.outline),
          color: Theme.of(context).colorScheme.surface,
        ),
        child: Row(
          children: [
            Container(
              width: 52,
              height: 52,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.gold.withValues(alpha: 0.15),
              ),
              child: Icon(icon, color: AppColors.gold, size: 26),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                  const SizedBox(height: 4),
                  Text(
                    description,
                    style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurfaceVariant),
                  ),
                ],
              ),
            ),
            const Icon(Icons.arrow_back_ios_new, size: 16),
          ],
        ),
      ),
    );
  }
}

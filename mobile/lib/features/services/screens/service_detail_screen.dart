import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../routing/route_paths.dart';
import '../../../theme/app_colors.dart';
import '../../../widgets/common/app_button.dart';
import '../providers/services_providers.dart';
import '../widgets/service_card.dart';

/// Service detail page — reached from [ServicesScreen] (or any deep link).
/// Reads [serviceByIdProvider] so the data is always the same cached list
/// fetched on [ServicesScreen]; no extra network request.
class ServiceDetailScreen extends ConsumerWidget {
  const ServiceDetailScreen({super.key, required this.serviceId});

  final int serviceId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final service = ref.watch(serviceByIdProvider(serviceId));

    // While the service list loads (or if the id is invalid) show a skeleton.
    if (service == null) {
      return Scaffold(
        appBar: AppBar(
          leading: IconButton(
            icon: const Icon(Icons.arrow_forward),
            onPressed: () => context.pop(),
          ),
        ),
        body: const Center(
          child: CircularProgressIndicator(color: AppColors.gold),
        ),
      );
    }

    final color = serviceColor(service.id);
    final icon = serviceIcon(service.nameAr);

    return Scaffold(
      backgroundColor:
          isDark ? AppColors.darkBackground : AppColors.lightBackground,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_forward),
          onPressed: () => context.pop(),
        ),
      ),
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 24),

              // ── Hero icon ──────────────────────────────────────────────
              Center(
                child: Container(
                  width: 110,
                  height: 110,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: color.withValues(alpha: isDark ? 0.20 : 0.14),
                    boxShadow: [
                      BoxShadow(
                        color: color.withValues(alpha: 0.35),
                        blurRadius: 28,
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                  child: Icon(icon, color: color, size: 48),
                ),
              ),

              const SizedBox(height: 24),

              // ── Service name ───────────────────────────────────────────
              Text(
                service.nameAr,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                ),
              ),

              const SizedBox(height: 8),

              Text(
                service.name,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),

              const SizedBox(height: 32),

              // ── Availability badge ─────────────────────────────────────
              Center(
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  decoration: BoxDecoration(
                    color: service.isActive
                        ? AppColors.chartGreen.withValues(alpha: 0.12)
                        : AppColors.destructive.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        service.isActive
                            ? Icons.check_circle_rounded
                            : Icons.cancel_rounded,
                        size: 16,
                        color: service.isActive
                            ? AppColors.chartGreen
                            : AppColors.destructive,
                      ),
                      const SizedBox(width: 6),
                      Text(
                        service.isActive ? 'متاح الآن' : 'غير متاح حالياً',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: service.isActive
                              ? AppColors.chartGreen
                              : AppColors.destructive,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const Spacer(),

              // ── CTA ────────────────────────────────────────────────────
              if (service.isActive)
                AppButton(
                  label: 'اطلب هذه الخدمة الآن',
                  onPressed: () => context.push(
                    '${RoutePaths.createRequest}?serviceId=${service.id}',
                  ),
                ),

              if (!service.isActive)
                Center(
                  child: Text(
                    'هذه الخدمة غير متاحة حالياً، جرّب خدمة أخرى',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
                  ),
                ),

              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }
}

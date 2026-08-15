import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';
import '../../../theme/app_design.dart';
import 'section_header.dart';

/// A three-step visual flow that explains the Fnashha service-request journey:
///   1. Choose a service
///   2. Receive offers from technicians
///   3. Complete and enjoy
///
/// Steps are connected by an animated gradient line for a premium feel.
class HowItWorksSection extends StatelessWidget {
  const HowItWorksSection({super.key, this.onRequestTap});
  final VoidCallback? onRequestTap;

  static const _steps = [
    _Step(
      number:   '١',
      icon:     Icons.home_repair_service_rounded,
      title:    'اختر الخدمة',
      subtitle: 'تصفّح أكثر من ١٠٠ خدمة منزلية وحدد ما تحتاجه بدقة',
      color:    AppColors.gold,
    ),
    _Step(
      number:   '٢',
      icon:     Icons.groups_rounded,
      title:    'استلم العروض',
      subtitle: 'يتنافس الفنيون لتقديم أفضل الأسعار والشروط لطلبك',
      color:    Color(0xFF3B82F6),
    ),
    _Step(
      number:   '٣',
      icon:     Icons.verified_rounded,
      title:    'اكمل واستمتع',
      subtitle: 'اختر الأفضل وتابع تنفيذ خدمتك لحظة بلحظة حتى اكتمالها',
      color:    Color(0xFF10B981),
    ),
  ];

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: 'كيف يعمل التطبيق؟'),
        const SizedBox(height: 20),

        // Steps
        ...List.generate(_steps.length, (i) {
          final step    = _steps[i];
          final isLast  = i == _steps.length - 1;
          return Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Left column: number badge + connector line
              SizedBox(
                width: 42,
                child: Column(
                  children: [
                    // Number badge
                    Container(
                      width:  42,
                      height: 42,
                      decoration: BoxDecoration(
                        color:        step.color.withValues(alpha: 0.12),
                        shape:        BoxShape.circle,
                        border:       Border.all(
                          color: step.color.withValues(alpha: 0.35),
                          width: 1.5,
                        ),
                      ),
                      child: Center(
                        child: Text(
                          step.number,
                          style: TextStyle(
                            color:      step.color,
                            fontSize:   16,
                            fontWeight: FontWeight.w900,
                          ),
                        ),
                      ),
                    ),
                    // Connector line (not after last step)
                    if (!isLast)
                      Container(
                        width:  2,
                        height: 56,
                        margin: const EdgeInsets.symmetric(vertical: 4),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin:  Alignment.topCenter,
                            end:    Alignment.bottomCenter,
                            colors: [
                              step.color.withValues(alpha: 0.40),
                              _steps[i + 1].color.withValues(alpha: 0.25),
                            ],
                          ),
                          borderRadius: BorderRadius.circular(AppDesign.radiusFull),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 16),

              // Right column: step content
              Expanded(
                child: Padding(
                  padding: EdgeInsets.only(
                    bottom: isLast ? 0 : 24,
                    top:    4,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // Icon + title row
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color:        step.color.withValues(alpha: 0.10),
                              borderRadius: BorderRadius.circular(AppDesign.radiusSM),
                            ),
                            child: Icon(step.icon, color: step.color, size: 18),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              step.title,
                              style: const TextStyle(
                                fontSize:   15,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        step.subtitle,
                        style: TextStyle(
                          fontSize: 13,
                          color:    Theme.of(context).colorScheme.onSurfaceVariant,
                          height:   1.5,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          );
        }),

        const SizedBox(height: 20),

        // CTA button
        if (onRequestTap != null)
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: onRequestTap,
              icon:      const Icon(Icons.add_rounded),
              label:     const Text(
                'ابدأ طلبك الآن',
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
            ),
          ),
      ],
    );
  }
}

class _Step {
  const _Step({
    required this.number,
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.color,
  });
  final String number;
  final IconData icon;
  final String title;
  final String subtitle;
  final Color color;
}

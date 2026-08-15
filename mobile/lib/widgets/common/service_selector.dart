import 'package:flutter/material.dart';

import '../../models/service_model.dart';
import '../../theme/app_colors.dart';

/// Multi-select grid of [FilterChip]s for choosing services.
///
/// Extracted from the technician registration wizard (`register_technician_
/// screen.dart`) so the Technician Profile edit flow (Phase 11F) can reuse
/// the exact same picker instead of duplicating it.
class ServiceSelector extends StatelessWidget {
  const ServiceSelector({
    super.key,
    required this.services,
    required this.selectedIds,
    required this.onToggle,
  });

  final List<ServiceModel> services;
  final Set<int> selectedIds;
  final ValueChanged<int> onToggle;

  @override
  Widget build(BuildContext context) {
    if (services.isEmpty) {
      return const Text(
        'لا توجد خدمات متاحة حالياً',
        style: TextStyle(color: AppColors.destructive, fontSize: 13),
      );
    }
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: services.map((service) {
        final selected = selectedIds.contains(service.id);
        return FilterChip(
          label: Text(service.nameAr),
          selected: selected,
          onSelected: (_) => onToggle(service.id),
        );
      }).toList(),
    );
  }
}

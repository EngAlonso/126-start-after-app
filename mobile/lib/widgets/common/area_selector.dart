import 'package:flutter/material.dart';

import '../../models/area_model.dart';
import '../../models/governorate_model.dart';

/// Coverage-area picker grouped by governorate, with a per-governorate
/// "select all" toggle.
///
/// Extracted from the technician registration wizard (`register_technician_
/// screen.dart`) so the Technician Profile edit flow (Phase 11F) can reuse
/// the exact same picker instead of duplicating it.
class AreaSelector extends StatelessWidget {
  const AreaSelector({
    super.key,
    required this.governorates,
    required this.areas,
    required this.selectedAreaIds,
    required this.onAreaToggle,
    required this.onBulkChanged,
  });

  final List<GovernorateModel> governorates;
  final List<AreaModel> areas;
  final Set<int> selectedAreaIds;
  final ValueChanged<int> onAreaToggle;
  final VoidCallback onBulkChanged;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: governorates.map((governorate) {
        final areasInGov =
            areas.where((a) => a.governorateId == governorate.id).toList();
        if (areasInGov.isEmpty) return const SizedBox.shrink();
        final allSelected =
            areasInGov.every((a) => selectedAreaIds.contains(a.id));
        return ExpansionTile(
          tilePadding: EdgeInsets.zero,
          title: Row(
            children: [
              Expanded(
                child: Text(governorate.nameAr,
                    style: const TextStyle(
                        fontWeight: FontWeight.w600, fontSize: 13)),
              ),
              TextButton(
                onPressed: () {
                  for (final area in areasInGov) {
                    if (allSelected) {
                      selectedAreaIds.remove(area.id);
                    } else {
                      selectedAreaIds.add(area.id);
                    }
                  }
                  onBulkChanged();
                },
                child: Text(allSelected ? 'إلغاء الكل' : 'تحديد الكل',
                    style: const TextStyle(fontSize: 12)),
              ),
            ],
          ),
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: areasInGov.map((area) {
                final selected = selectedAreaIds.contains(area.id);
                return FilterChip(
                  label: Text(area.nameAr, style: const TextStyle(fontSize: 12)),
                  selected: selected,
                  onSelected: (_) => onAreaToggle(area.id),
                );
              }).toList(),
            ),
            const SizedBox(height: 8),
          ],
        );
      }).toList(),
    );
  }
}

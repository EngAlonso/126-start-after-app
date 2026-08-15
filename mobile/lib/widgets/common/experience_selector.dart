import 'package:flutter/material.dart';

/// Preset years-of-experience options offered to technicians, shared between
/// registration and profile editing so both flows stay in sync.
const kExperienceOptions = <int>[1, 2, 3, 5, 7, 10, 15, 20];

/// A row of [ChoiceChip]s for picking years of experience from
/// [kExperienceOptions].
///
/// Extracted from the technician registration wizard (`register_technician_
/// screen.dart`) so the Technician Profile edit flow (Phase 11F) can reuse
/// the exact same picker instead of duplicating it.
class ExperienceSelector extends StatelessWidget {
  const ExperienceSelector({
    super.key,
    required this.selectedYears,
    required this.onChanged,
  });

  final int? selectedYears;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: kExperienceOptions.map((years) {
        final selected = selectedYears == years;
        final isMax = years == kExperienceOptions.last;
        return ChoiceChip(
          label: Text(isMax ? '+$years سنة' : '$years سنة'),
          selected: selected,
          onSelected: (_) => onChanged(years),
        );
      }).toList(),
    );
  }
}

import 'package:flutter/material.dart';

import '../../../models/request_model.dart';

/// Small pill badge showing a request's Arabic status label, colour-coded
/// via [RequestStatusLabel.statusColorRgb]. Shared by the list cards, the
/// detail screen header, and the timeline.
class RequestStatusBadge extends StatelessWidget {
  const RequestStatusBadge({super.key, required this.status, this.dense = false});

  final String status;
  final bool dense;

  @override
  Widget build(BuildContext context) {
    final rgb = status.statusColorRgb;
    final color = Color.fromARGB(255, rgb.r, rgb.g, rgb.b);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: dense ? 8 : 10, vertical: dense ? 4 : 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.13),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.statusLabelAr,
        style: TextStyle(
          fontSize: dense ? 10.5 : 11,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }
}

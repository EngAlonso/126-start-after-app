import 'package:flutter/material.dart';

import '../../../models/offer_model.dart';

/// Colored pill for an offer's `offer_status` value — same visual language
/// as [RequestStatusBadge] but driven by [OfferStatusLabel].
class OfferStatusBadge extends StatelessWidget {
  const OfferStatusBadge({super.key, required this.status});

  final String status;

  @override
  Widget build(BuildContext context) {
    final rgb = status.offerStatusColorRgb;
    final color = Color.fromARGB(255, rgb.r, rgb.g, rgb.b);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.13),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Text(
        status.offerStatusLabelAr,
        style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: color),
      ),
    );
  }
}

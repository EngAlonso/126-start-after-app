import 'package:flutter/material.dart';

import '../../../theme/app_colors.dart';

/// A standalone notification illustration for a rejected price adjustment.
///
/// This is intentionally painted rather than using the supplied reference
/// image, so the notification keeps a small, crisp, app-native footprint.
class PriceRejectedNotificationIcon extends StatelessWidget {
  const PriceRejectedNotificationIcon({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 42,
      height: 42,
      child: CustomPaint(painter: _PriceRejectedIconPainter()),
    );
  }
}

class _PriceRejectedIconPainter extends CustomPainter {
  const _PriceRejectedIconPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.shortestSide / 42;
    canvas
      ..save()
      ..scale(scale);

    // A compact pair of banknotes anchors the price-adjustment concept.
    final notePaint = Paint()
      ..color = const Color(0xFFD8B36A)
      ..style = PaintingStyle.fill;
    final noteEdgePaint = Paint()
      ..color = const Color(0xFF8E642D)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.1;

    canvas.save();
    canvas.translate(1.5, 18.5);
    canvas.rotate(-0.14);
    final backNote = RRect.fromRectAndRadius(
      const Rect.fromLTWH(4, 4, 27, 12),
      const Radius.circular(2),
    );
    canvas
      ..drawRRect(backNote, notePaint)
      ..drawRRect(backNote, noteEdgePaint);
    canvas.restore();

    canvas.save();
    canvas.translate(4.5, 16);
    canvas.rotate(0.08);
    final frontNote = RRect.fromRectAndRadius(
      const Rect.fromLTWH(3, 3, 27, 12),
      const Radius.circular(2),
    );
    canvas
      ..drawRRect(frontNote, notePaint)
      ..drawRRect(frontNote, noteEdgePaint);
    final coinPaint = Paint()
      ..color = const Color(0xFFF6D98B)
      ..style = PaintingStyle.fill;
    canvas.drawCircle(const Offset(16.5, 9), 4, coinPaint);
    canvas.drawCircle(const Offset(16.5, 9), 4, noteEdgePaint);
    canvas.restore();

    // A simplified silver wrench crosses the notes, matching the service/
    // adjustment meaning without copying the reference artwork.
    final wrenchPaint = Paint()
      ..color = const Color(0xFFD7DCE3)
      ..style = PaintingStyle.fill;
    final wrenchEdgePaint = Paint()
      ..color = const Color(0xFF687382)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.2
      ..strokeJoin = StrokeJoin.round;

    canvas.save();
    canvas.translate(17, 19);
    canvas.rotate(-0.74);
    final wrench = Path()
      ..moveTo(1.5, 4)
      ..lineTo(8, 4)
      ..lineTo(8, 8)
      ..lineTo(22, 8)
      ..quadraticBezierTo(24, 8, 24, 10)
      ..lineTo(24, 13)
      ..quadraticBezierTo(24, 15, 22, 15)
      ..lineTo(8, 15)
      ..lineTo(8, 19)
      ..lineTo(1.5, 19)
      ..quadraticBezierTo(-1, 19, -1, 16.5)
      ..lineTo(-1, 6.5)
      ..quadraticBezierTo(-1, 4, 1.5, 4)
      ..close();
    canvas
      ..drawPath(wrench, wrenchPaint)
      ..drawPath(wrench, wrenchEdgePaint);

    final jawCutout = Path()
      ..moveTo(-1, 6)
      ..lineTo(4, 6)
      ..lineTo(7, 9.5)
      ..lineTo(4, 13)
      ..lineTo(-1, 13)
      ..close();
    canvas.drawPath(
      jawCutout,
      Paint()
        ..color = Colors.transparent
        ..style = PaintingStyle.fill
        ..blendMode = BlendMode.clear,
    );
    canvas.restore();

    // The prohibition mark is the strongest small-size signal: red ring plus
    // diagonal slash, kept inside the 42px footprint.
    final rejectPaint = Paint()
      ..color = AppColors.destructive
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.8
      ..strokeCap = StrokeCap.round;
    canvas
      ..drawCircle(const Offset(21, 21), 16.7, rejectPaint)
      ..drawLine(const Offset(9, 9), const Offset(33, 33), rejectPaint)
      ..restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}

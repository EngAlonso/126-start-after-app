import 'package:flutter/material.dart';

/// A standalone notification illustration for an approved price adjustment.
///
/// The artwork is painted locally instead of reusing the supplied reference
/// image, keeping it crisp and appropriately sized for the notification row.
class PriceApprovedNotificationIcon extends StatelessWidget {
  const PriceApprovedNotificationIcon({super.key});

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      width: 42,
      height: 42,
      child: CustomPaint(painter: _PriceApprovedIconPainter()),
    );
  }
}

class _PriceApprovedIconPainter extends CustomPainter {
  const _PriceApprovedIconPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final scale = size.shortestSide / 42;
    canvas
      ..save()
      ..scale(scale);

    // Stacked notes keep the icon tied to the approved price adjustment.
    final notePaint = Paint()
      ..color = const Color(0xFFD7B86C)
      ..style = PaintingStyle.fill;
    final noteEdgePaint = Paint()
      ..color = const Color(0xFF80612A)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.1;

    canvas.save();
    canvas.translate(2.5, 20);
    canvas.rotate(-0.1);
    final backNote = RRect.fromRectAndRadius(
      const Rect.fromLTWH(3, 3, 27, 11),
      const Radius.circular(2),
    );
    canvas
      ..drawRRect(backNote, notePaint)
      ..drawRRect(backNote, noteEdgePaint);
    canvas.restore();

    canvas.save();
    canvas.translate(5.5, 18);
    canvas.rotate(0.08);
    final frontNote = RRect.fromRectAndRadius(
      const Rect.fromLTWH(2, 2, 27, 11),
      const Radius.circular(2),
    );
    canvas
      ..drawRRect(frontNote, notePaint)
      ..drawRRect(frontNote, noteEdgePaint);
    canvas.drawCircle(
      const Offset(15.5, 7.5),
      3.5,
      Paint()
        ..color = const Color(0xFFF4D98F)
        ..style = PaintingStyle.fill,
    );
    canvas.drawCircle(const Offset(15.5, 7.5), 3.5, noteEdgePaint);
    canvas.restore();

    // A compact wrench suggests that the approved amount belongs to a
    // service request, while the checkmark communicates the decision.
    final wrenchPaint = Paint()
      ..color = const Color(0xFFD8DDE3)
      ..style = PaintingStyle.fill;
    final wrenchEdgePaint = Paint()
      ..color = const Color(0xFF68727D)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.15
      ..strokeJoin = StrokeJoin.round;

    canvas.save();
    canvas.translate(17, 19);
    canvas.rotate(-0.72);
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

    // The green approval ring and check are deliberately part of the artwork,
    // not a container added by the notification card.
    final approvalPaint = Paint()
      ..color = const Color(0xFF4F9E2F)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 4.2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawCircle(const Offset(21, 21), 16.7, approvalPaint);

    final checkPath = Path()
      ..moveTo(11, 21)
      ..lineTo(18, 28)
      ..lineTo(32, 13);
    canvas.drawPath(checkPath, approvalPaint);
    canvas.restore();
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
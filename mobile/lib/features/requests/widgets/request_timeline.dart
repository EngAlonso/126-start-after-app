import 'package:flutter/material.dart';

import '../../../models/request_model.dart' show RequestStatusLabel, cancelledStatuses;
import '../../../theme/app_colors.dart';

/// Beautiful vertical progress timeline for a request's real backend
/// status. Only two shapes exist:
///
/// - Normal lifecycle: pending → offers_received → technician_selected →
///   in_progress → waiting_approval → completed (price_change_requested is
///   folded visually into the in_progress step, since it's a sub-state of
///   an active job, not a separate stage).
/// - Cancelled/disputed: shows the normal steps reached so far, then a
///   single red "stopped here" step with the real status label.
class RequestTimeline extends StatelessWidget {
  const RequestTimeline({super.key, required this.status});

  final String status;

  static const _steps = <_TimelineStep>[
    _TimelineStep('pending', 'تم إنشاء الطلب', Icons.receipt_long_rounded),
    _TimelineStep('offers_received', 'وصلت عروض من الفنيين', Icons.local_offer_rounded),
    _TimelineStep('technician_selected', 'تم اختيار الفني', Icons.engineering_rounded),
    _TimelineStep('in_progress', 'جاري تنفيذ الخدمة', Icons.build_circle_rounded),
    _TimelineStep('waiting_approval', 'بانتظار تأكيدك', Icons.hourglass_bottom_rounded),
    _TimelineStep('completed', 'تم إنجاز الطلب', Icons.check_circle_rounded),
  ];

  bool get _isCancelled => cancelledStatuses.contains(status) || status == 'disputed';

  int get _currentIndex {
    final effective = status == 'price_change_requested' ? 'in_progress' : status;
    final i = _steps.indexWhere((s) => s.status == effective);
    return i == -1 ? 0 : i;
  }

  @override
  Widget build(BuildContext context) {
    final currentIndex = _currentIndex;
    // When cancelled, only steps strictly before the point of cancellation
    // are shown as "reached" — we don't know exactly where it stopped from
    // status alone, so conservatively show only "pending" as complete plus
    // the terminal cancelled marker, which is always true and never
    // overclaims progress that didn't happen.
    final reachedIndex = _isCancelled ? 0 : currentIndex;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < _steps.length; i++)
          _TimelineTile(
            step: _steps[i],
            isDone: i < reachedIndex || (!_isCancelled && i <= currentIndex && status == 'completed'),
            isCurrent: !_isCancelled && i == currentIndex,
            isLast: i == _steps.length - 1 && !_isCancelled,
          ),
        if (_isCancelled)
          _TimelineTile(
            step: _TimelineStep(status, _terminalLabelAr(status), Icons.cancel_rounded),
            isDone: false,
            isCurrent: true,
            isLast: true,
            isError: true,
          ),
      ],
    );
  }

  static String _terminalLabelAr(String status) => switch (status) {
        'cancelled_by_customer' => 'تم إلغاء الطلب',
        'cancelled_by_technician' => 'ألغى الفني الطلب',
        'cancelled_by_admin' => 'ألغت الإدارة الطلب',
        'disputed' => 'الطلب متنازع عليه',
        _ => status.statusLabelAr,
      };
}

class _TimelineStep {
  const _TimelineStep(this.status, this.label, this.icon);
  final String status;
  final String label;
  final IconData icon;
}

class _TimelineTile extends StatelessWidget {
  const _TimelineTile({
    required this.step,
    required this.isDone,
    required this.isCurrent,
    required this.isLast,
    this.isError = false,
  });

  final _TimelineStep step;
  final bool isDone;
  final bool isCurrent;
  final bool isLast;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    final active = isDone || isCurrent;
    final color = isError
        ? AppColors.destructive
        : active
            ? AppColors.gold
            : Theme.of(context).colorScheme.outlineVariant;

    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 250),
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: active ? color.withValues(alpha: 0.15) : Colors.transparent,
                  border: Border.all(color: color, width: 2),
                ),
                child: Icon(step.icon, size: 16, color: color),
              ),
              if (!isLast)
                Expanded(
                  child: Container(
                    width: 2,
                    margin: const EdgeInsets.symmetric(vertical: 2),
                    color: isDone ? AppColors.gold : Theme.of(context).colorScheme.outlineVariant,
                  ),
                ),
            ],
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(top: 6, bottom: 18),
              child: Text(
                step.label,
                style: TextStyle(
                  fontSize: 13.5,
                  fontWeight: isCurrent || isError ? FontWeight.w700 : FontWeight.w500,
                  color: active
                      ? Theme.of(context).colorScheme.onSurface
                      : Theme.of(context).colorScheme.onSurfaceVariant,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

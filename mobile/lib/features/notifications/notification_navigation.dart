import 'package:flutter/widgets.dart';
import 'package:go_router/go_router.dart';

import '../../models/notification_model.dart';
import '../../routing/route_paths.dart';

/// Shared deep-link resolver for [NotificationModel] taps — used by both the
/// customer and technician notification lists (same screen, same provider;
/// only the destination route differs per role for a few shared `type`
/// values). Keeping this in one place avoids forking the notifications
/// screen per role.
///
/// Backend type → recipient reference (see
/// `artifacts/api-server/src/routes/{requests,offers,messages,support,ratings}.ts`):
/// - `new_request`         → technicians only (an available job to bid on)
/// - `new_offer`           → customers only (an offer was submitted)
/// - `technician_selected` → technicians only (their offer was accepted)
/// - `status_change`       → both roles (job status, rating, offer outcome…)
/// - `new_message`         → both roles, same shared chat route
/// - `support_reply`       → both roles; `relatedId` is a support-ticket id,
///   not a request id — there is no ticket-detail screen yet, so this stays
///   a no-op exactly like the customer screen's prior behaviour.
/// - `platform_credit_*`   → customers only (loyalty coins wallet)
void navigateForNotification(
  BuildContext context,
  NotificationModel notif, {
  required bool isTechnician,
}) {
  final rid = notif.relatedId;
  if (rid == null) return;

  switch (notif.type) {
    case 'new_message':
      context.push(RoutePaths.chat(rid));
    case 'new_request':
      if (isTechnician) context.push(RoutePaths.technicianRequestDetail(rid));
    case 'new_offer':
      if (!isTechnician) context.push(RoutePaths.requestOffers(rid));
    case 'technician_selected':
    case 'price_adjustment':
    case 'status_change':
      if (isTechnician) {
        context.push(RoutePaths.technicianJobDetail(rid));
      } else {
        context.push(RoutePaths.requestDetail(rid));
      }
    case 'platform_credit_added':
    case 'platform_credit_paid':
      if (!isTechnician) context.push(RoutePaths.wallet);
    case 'support_reply':
    case 'announcement':
    default:
      // No deep link — notification detail is shown inline on the card.
      break;
  }
}

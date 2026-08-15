---
name: Fnashha Flutter Phase 11A — Technician Home
description: Architecture decisions and constraints for the technician home experience in the Flutter mobile app.
---

## Key decisions

**Router change:** `/technician` now resolves to `TechnicianHomeScreen` directly (not `HomeShellScreen`). Admin still uses `HomeShellScreen`. The `home_shell_screen.dart` is admin-only now.

**Points balance endpoint:** Technicians use `GET /api/points/balance` → `{ balance, reserved, available }` (model: `TechPointsModel`). NOT `/loyalty/wallet` which is customer-only.

**SSE pattern:** `techSseProvider` is `StreamProvider<void>` with `yield* events.when(...)` — identical to `notificationsSseProvider`. Anchored from `TechnicianHomeScreen` via `ref.watch(techSseProvider)`. Invalidates `techRequestsProvider`, `techLatestRequestsProvider`, `techPointsProvider` on `request_created` / `request_updated` / `status_changed`.

**Available requests:** `GET /api/requests` is shared — backend auto-filters by technician's services/areas. No extra query params needed for scoping; filters are user-initiated (status, serviceId).

**Offer submission:** `POST /api/requests/:requestId/offers` returns the created `OfferModel`. `PATCH` for edit. Own offer detected by filtering `offersProvider(requestId)` for `offer.technicianId == currentUser.id` (via `myOfferForRequestProvider`).

**Nested Scaffold prevention:** `TechRequestDetailScreen` returns each state (loading/error/data) as its own full `Scaffold` — no outer wrapper Scaffold. The data state uses `_DetailBody` which owns the AppBar.

**Bottom nav tabs:** Home/Requests use `TechnicianHomeScreen` + `TechRequestsScreen` (pushed). Wallet/Profile show "قريباً" snackbar until future phases.

## File locations

- `mobile/lib/services/technician_service.dart` — `fetchAvailableRequests`, `fetchPointsBalance`, `submitOffer`, `updateOffer`
- `mobile/lib/features/technician/providers/tech_providers.dart` — all providers: `technicianServiceProvider`, `techPointsProvider`, `techRequestsProvider` (paginated), `techLatestRequestsProvider` (dashboard 5), `myOfferForRequestProvider`, `techOfferProvider`
- `mobile/lib/features/technician/providers/tech_sse_provider.dart` — `techSseProvider`
- `mobile/lib/features/technician/screens/technician_home_screen.dart` — dashboard + bottom nav
- `mobile/lib/features/technician/screens/tech_requests_screen.dart` — full list + status tabs + service filter
- `mobile/lib/features/technician/screens/tech_request_detail_screen.dart` — detail + offer submit/edit panel
- `mobile/lib/features/technician/widgets/tech_request_card.dart` — request card for technician view
- `mobile/lib/features/technician/widgets/offer_sheet.dart` — `showOfferSheet(context, requestId, existingOffer?)` function + sheet

**Why:**
Technicians need their own home flow separate from customers. Points are commission-based (not loyalty coins). The shared SSE provider is the correct anchor point for all real-time updates.

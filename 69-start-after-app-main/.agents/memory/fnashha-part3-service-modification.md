---
name: Fnashha Part 3 — Service Modification Request Flow
description: Business rule and implementation for technician service/area modification requests (Part 3 Flutter mobile).
---

## Business Rule
Technicians CANNOT directly edit their registered services or coverage areas.
Any change must go through admin-reviewed modification request flow.

## What Was Already Built (DO NOT REBUILD)
All 5 tabs of TechnicianHomeScreen are fully implemented:
- TechMyPageTab, TechRequestsTab, TechWalletTab, MyAccountTab
- TechBottomNavBar, TechnicianAppBar
- All tech_providers.dart, tech_job_providers.dart, tech_sse_provider.dart

## What Was Implemented (Part 3)

### Backend
- New table: `tech_service_modification_requests` (bootstrap.ts alterDDL)
  - Fields: id, technician_id, request_type, details, status (pending/approved/rejected),
    admin_notes, reviewed_by, reviewed_at, created_at, updated_at
  - `request_type` CHECK: add_service, remove_service, change_areas, other
- New route file: `artifacts/api-server/src/routes/tech-modifications.ts`
  - POST /api/technicians/modification-requests (tech submits)
  - GET /api/technicians/modification-requests (admin=all, tech=own)
  - GET /api/technicians/modification-requests/:id (detail)
  - PATCH /api/technicians/modification-requests/:id (admin approve/reject)
- Registered in routes/index.ts
- Added to admin-database.ts ALL_TABLES + RESTORE_ORDER

### Flutter
- `ApiEndpoints.techModificationRequests` added to api_endpoints.dart
- `RoutePaths.techServiceModification` ('/technician/service-modification') added
- New service: `mobile/lib/features/technician/services/tech_modification_service.dart`
  - TechModificationService with submitRequest() and fetchMyRequests()
  - Provider: techModificationServiceProvider
- New screen: `mobile/lib/features/technician/screens/tech_service_modification_screen.dart`
  - Shows current services (read-only from technicianFullProfileProvider)
  - Info banner explaining the restriction
  - Type selector: add_service, remove_service, change_areas, other
  - Details text area (min 20 chars)
  - Success confirmation screen
- Route added to app_router.dart

### edit_profile_screen.dart (REWRITTEN)
- Removed: `_TechnicianEditSection` widget (services + areas editing for technicians)
- Removed: `serviceIds` and `areaIds` from `_save()` for technicians
- Added: `_TechnicianExtras` widget for technicians showing:
  - `ExperienceSelector` (yearsOfExperience — still editable)
  - `_ReadOnlyServicesCard` (current services, chip display)
  - `_ModificationRequestBanner` (button → RoutePaths.techServiceModification)
- Removed imports: area_selector.dart, service_selector.dart

### Bug Fixes (pre-existing)
- `tech_wallet_tab.dart`: fixed MetricCard import (balance_card.dart),
  WalletEmptyState params (message→title, hint→subtitle),
  TransactionTile params (type/points/date → icon/typeLabel/amount/isCredit/createdAt),
  removed invalid `highlight` param from MetricCard call.
  Added local `_iconForPointType()` (private fn can't be imported from tech_wallet_screen.dart).

## Critical Notes
- SQL comments in bootstrap.ts alterDDL must NOT contain semicolons — the splitter
  uses ";" as a delimiter and will break mid-statement if a comment contains one.
- `_iconForPointType` is a top-level private function in tech_wallet_screen.dart;
  it cannot be imported. Duplicate it locally in any other file that needs it.

---
name: Fnashha commission ranges system
description: Range-based commission calculation replacing the old flat commissionsTable lookup in offer submission.
---

## The System

**commission_ranges** table: `id, service_id (nullable), min_price, max_price, required_points, created_at, updated_at`
**areas.extra_points**: integer column added (default 0); set per area by admin.

## Calculation Formula

```
total_required_points = range.required_points + area.extra_points
```

- `range` = the matching row where `min_price <= laborPrice <= max_price`
- `area.extra_points` comes from `service_requests.area_id → areas.extra_points`
- Priority: service-specific range (service_id = serviceId) overrides global (service_id IS NULL)

## Helper in offers.ts

`resolveCommissionRange(serviceId, laborPrice, areaId)` → `number | null`
- Returns null if no range covers the labor price → offer submission blocked with 400
- Uses `sql` template literals for numeric comparison (not lte/gte) to avoid type issues

## Admin UI

- `/admin/commission-ranges` — CRUD for ranges (uses direct fetch, not generated hooks)
- `/admin/locations` — Areas tab shows extra_points badge; click pencil to inline-edit
- Nav item added to the "الإعدادات" group in layout.tsx

## Backward Compatibility

- Old `commissionsTable` and `/admin/commissions` page still exist but offers.ts no longer uses them for validation.
- Wallet history, commission transaction logging at completion, and point release on rejection are unchanged (they use `offer.reservedPoints` not commissionsTable).

**Why:** The flat commission system could not express price-bracket rules or area surcharges. The ranges system is fully dynamic — no hardcoded values.

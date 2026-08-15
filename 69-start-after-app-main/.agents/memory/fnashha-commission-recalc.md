---
name: Fnashha commission recalculation on price adjustment
description: How and where commission is recalculated when a customer accepts a price adjustment — the C-3 bug fix.
---

## Rule
When a customer accepts a price adjustment (`POST /requests/:id/price-adjustment/respond`, `approved: true`), the server must re-run `resolveCommissionRange` for the new labor price and reconcile `offers.reservedPoints` and `technician_profiles.reservedPoints`.

## How to apply
`resolveCommissionRange` is exported from `offers.ts` and imported by `requests.ts`. The reconciliation block runs in the `approved` branch, after the offer price is updated and before the adjustment status is updated. It:
1. Fetches the selected offer (status = 'selected') to read old `reservedPoints`
2. Fetches the technician profile for current `pointsBalance` / `reservedPoints`
3. Calls `resolveCommissionRange(request.serviceId, newLaborPrice, request.areaId ?? null)`
4. If `diff > 0`: increments `technicianProfilesTable.reservedPoints` by `min(diff, available)`, inserts a `debit` transaction, updates `offersTable.reservedPoints`
5. If `diff < 0`: decrements `technicianProfilesTable.reservedPoints` by `abs(diff)`, inserts a `release` transaction, updates `offersTable.reservedPoints`
6. If `diff = 0`: no DB writes needed

## Why
Without this, `offers.reservedPoints` remains at the original submission value. At completion, `offersTable.reservedPoints` is the deduction source, so the technician was always charged the original commission regardless of the final agreed price.

## Transaction types used
- Price **increased** → type `"debit"`, amount = diff (points added to reservation)
- Price **decreased** → type `"release"`, amount = abs(diff) (points freed from reservation)
- In both cases `balanceAfter = profile.pointsBalance` (pointsBalance itself never changes on reservation adjustments)

## Multiple adjustments
The design handles chained adjustments correctly because each call reads the _current_ `selectedOffer.reservedPoints` (not the original), so the delta is always relative to the most recent committed commission.

---
name: Fnashha point reservation system
description: How the technician point reservation and deduction system works
---

# Point Reservation System

## Fields
- `technicianProfilesTable.pointsBalance` — total balance (only changes on admin add/deduct or service completion)
- `technicianProfilesTable.reservedPoints` — total currently locked across all pending offers
- `offersTable.reservedPoints` — how many points were locked for THIS specific offer
- Available balance = `pointsBalance - reservedPoints`

## Flow
1. **Submit offer**: check `available >= requiredPoints`; then `reservedPoints += requiredPoints` on profile; store `requiredPoints` in `offer.reservedPoints`
2. **Edit offer price**: recalculate `newRequired`; diff = `newRequired - offer.reservedPoints`; adjust profile.reservedPoints by diff; update `offer.reservedPoints = newRequired`
3. **Select offer** (customer picks winner): reject other pending offers → release each loser's `offer.reservedPoints` from `profile.reservedPoints`; do NOT deduct `pointsBalance` yet
4. **Request cancelled**: release ALL pending offer reservations; if admin cancels after selection, also release selected offer's reservation
5. **Service completed**: permanently deduct `pointsBalance -= selectedOffer.reservedPoints`; `reservedPoints -= selectedOffer.reservedPoints`; record commission transaction in `pointTransactionsTable`

## Commission calculation
- Computed from `commissionsTable` where `serviceId` matches request
- Applied to LABOR price only (not spareParts)
- Fixed type: `value` = flat points; Percentage type: `ceil(price * value / 100)`

## Why
Prevents technicians from over-committing — reserved points cannot be used for other offers until released.
